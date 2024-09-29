import {
  IServerConfig,
  MicroserviceFramework,
  IBackEnd,
  ITable,
  RequestHandler,
  IRequest,
  Loggable,
} from "microservice-framework";
import { LLMService, LLMServiceConfig } from "./LLMService";
import { v4 as uuidv4 } from "uuid";
import { AgentFrameworkPrompt } from "./AgentFramework";
import { MemoryCompressorPrompt } from "./MemoryCompressor";
import { SupportedLanguage } from "../../aws-backend/bedrock/AsyncMultiLanguagePrompt";
import { AudioService } from "./AudioService";

export interface ChatbotRequest {}
export interface ChatbotResponse {}
export interface ChatbotConfig extends IServerConfig {
  goal: string;
  memoryCompressionThreshold?: number; // string length
  retryDelay?: number;
  llmConfig: LLMServiceConfig;
  botResponseMaxTokens?: number;
  compressedMemoryMaxTokens?: number;
  bucketName: string;
}
export interface ChatbotBackend extends IBackEnd {
  createTable: (name: string) => ITable<any>;
  getTable: (name: string) => ITable<any> | undefined;
}

interface BotResponse {
  action: string;
  content: string;
  success?: boolean;
  language?: string;
}

interface OutputMessage {
  text: string;
  image?: string;
  audio?: string;
  diagram?: string;
  language?: string;
  code?: string;
  choice?: string[];
}

interface InputMessage {
  text: string;
}

interface BotInputMessage {
  source: "user" | "system";
  content: string;
}

export class ChatbotService extends MicroserviceFramework<
  ChatbotRequest,
  ChatbotResponse
> {
  private bucketName: string;
  private memoryTable: ITable;
  private goal: string;
  private memoryCompressionThreshold: number;
  private retryDelay: number;
  private llmService: LLMService;
  private botResponseMaxTokens: number;
  private compressedMemoryMaxTokens: number;
  private audioService: AudioService;

  constructor(backend: ChatbotBackend, config: ChatbotConfig) {
    super(backend, config);
    this.bucketName = config.bucketName;
    this.audioService = new AudioService(this.bucketName);
    this.memoryCompressionThreshold = config.memoryCompressionThreshold || 3000;
    this.memoryTable = backend.createTable("chatbot-memory");
    this.goal = config.goal;
    this.retryDelay = config.retryDelay || 7000; // 7s
    this.llmService = new LLMService(config.llmConfig);
    this.botResponseMaxTokens = config.botResponseMaxTokens || 1000;
    this.compressedMemoryMaxTokens = config.compressedMemoryMaxTokens || 5000;
  }

  @RequestHandler<IRequest<InputMessage>>("message")
  private async handleMessage(request: IRequest<InputMessage>) {
    const response = await this.interact(request.header.requesterAddress, {
      source: "user",
      content: request.body.text,
    });
    this.info("Interaction between user and bot", {
      request: request.body.text,
      response,
    });
    return response;
  }

  @Loggable.handleErrors
  private async interact(
    sessionId: string,
    input: BotInputMessage
  ): Promise<OutputMessage[]> {
    let memory = await this.getMemory(sessionId);
    memory += "\n" + `${input.source}: ${input.content}`;

    let response = await this.askBot(
      memory,
      JSON.stringify({ source: input.source, message: input.content })
    );

    this.info("Bot response", response);

    if (!response)
      return [
        {
          text: "I'm sorry, There was a problem while I tried to process that!",
        },
      ];

    try {
      const sanitizedResponse = sanitizeResponseContent(response);
      let parsedResponse = JSON.parse(sanitizedResponse);

      let botResponses: BotResponse[] = Array.isArray(parsedResponse)
        ? parsedResponse
        : [parsedResponse];

      const results: OutputMessage[] = [];
      for (const botResponse of botResponses) {
        const { result, memoryUpdate } = await this.processBotResponse(
          botResponse,
          sessionId
        );
        results.push(result);
        memory += memoryUpdate;
      }

      // Update memory after processing all responses
      this.info("Updated memory", memory);
      await this.updateMemory(sessionId, memory);

      this.info("Bot responses", results);
      return results;
    } catch (e: any) {
      this.warn(
        `An error occurred in the bot response, trying again in ${
          this.retryDelay / 1000
        } seconds`,
        { error: e, response }
      );
      this.scheduleRetry(sessionId);
      return [{ text: "Let me think for a bit. Please, be patient..." }];
    }
  }

  private scheduleRetry(sessionId: string): void {
    setTimeout(async () => {
      const interactionResponses = await this.interact(sessionId, {
        source: "system",
        content: `Your last message provoked a JSON parsing error. Make sure your responses won't throw JSON.parse() errors.`,
      });
      this.warn("Sending message to user after error", interactionResponses);
      this.sendToUser(sessionId, JSON.stringify(interactionResponses));
    }, this.retryDelay);
  }

  private async getMemory(sessionId: string): Promise<string> {
    return (await this.memoryTable.get(sessionId)) || "Agent: Hello there...";
  }

  private async updateMemory(sessionId: string, memory: string): Promise<void> {
    await this.memoryTable.set(sessionId, await this.compressMemory(memory));
  }

  private async processBotResponse(
    botResponse: BotResponse,
    sessionId: string
  ): Promise<{ result: OutputMessage; memoryUpdate: string }> {
    const { action, content, language } = botResponse;
    let result: OutputMessage = { text: "" };
    let memoryUpdate = "";

    // Decode the base64 content
    const decodedContent = Array.isArray(content)
      ? content.map(atob).join(",")
      : atob(content);

    switch (action) {
      case "send-text":
        result.text = decodedContent;
        memoryUpdate = "\nAgent: " + decodedContent;
        break;
      case "send-code":
        result.code = decodedContent;
        result.language = language;
        memoryUpdate = "\nAgent: [code]" + decodedContent + "[/code]";
        break;
      case "send-audio":
        const audioFilePath = await this.createAudio(
          decodedContent,
          `audio/${sessionId}-${uuidv4()}.mp3`
        );
        result.audio = audioFilePath;
        memoryUpdate = "\nAgent: [audio]" + decodedContent + "[/audio]";
        break;
      case "send-image":
        const imagePath = await this.createImage(
          decodedContent,
          `images/${sessionId}-${uuidv4()}.png`
        );
        result.image = imagePath;
        memoryUpdate = "\nAgent: [image]" + decodedContent + "[/image]";
        break;
      case "send-choice":
        result.choice = decodedContent.split(",");
        memoryUpdate = "\nAgent: [choice]" + decodedContent + "[/choice]";
        break;
      case "send-diagram":
        result.diagram = decodedContent;
        memoryUpdate = "\nAgent: [diagram]" + decodedContent + "[/diagram]";
        break;
      default:
        throw new Loggable.LoggableError(
          "Couldn't find an appropriate action",
          botResponse
        );
    }

    return { result, memoryUpdate };
  }

  @Loggable.handleErrors
  private async sendToUser(sessionId: string, text: string) {
    try {
      const result = await this.makeRequest<{ success: boolean }>({
        to: "websockets",
        requestType: "RELAY",
        body: { text, sessionId },
      });
      if (
        !result.body.success ||
        result.body.error ||
        !result.body.data.success
      ) {
        throw new Loggable.LoggableError(
          "Error sending message to user",
          result.body
        );
      }
    } catch (error) {
      this.memoryTable.delete(sessionId);
      this.warn("Error sending message to user, removing memory");
    }
  }

  @Loggable.handleErrors
  private async askBot(memory: string, text: string): Promise<string> {
    const prompt = new AgentFrameworkPrompt({
      goal: this.goal,
      memory,
      input: text,
    });

    const response = await this.llmService.generateText(
      prompt,
      SupportedLanguage.EN,
      this.botResponseMaxTokens
    );
    if (!response) throw new Error("No response from LLM");
    return response;
  }

  @Loggable.handleErrors
  private async compressMemory(memory: string): Promise<string> {
    if (memory.length < this.memoryCompressionThreshold) return memory;
    const prompt = new MemoryCompressorPrompt({
      input: memory,
      goal: this.goal,
    });

    const response = await this.llmService.generateText(
      prompt,
      SupportedLanguage.EN,
      this.compressedMemoryMaxTokens
    );
    if (!response) throw new Error("No response from LLM");
    return response;
  }

  @Loggable.handleErrors
  private async createImage(description: string, fileName: string) {
    const response = await this.llmService.generateImage(description, fileName);
    if (!response) throw new Error("No response from LLM");
    return response;
  }

  @Loggable.handleErrors
  private async createAudio(text: string, fileName: string): Promise<string> {
    const audioFileName = await this.audioService.generateAudio(text, fileName);
    return audioFileName;
  }

  protected async stopDependencies(): Promise<void> {
    const allSessions = await this.memoryTable.getAll();
    for (const [key] of allSessions) {
      await this.memoryTable.delete(key);
    }
  }
}

function sanitizeResponseContent(input: string): string {
  return input.replace(
    /"content"\s*:\s*("(?:\\.|[^"\\])*"|(\[[\s\S]*?\]))/g,
    (match: string, content: string) => {
      // Remove outer quotes if present
      const unquotedContent = content.replace(/^"|"$/g, "");

      // Replace content between CONTENT_START and CONTENT_END with base64
      const sanitizedContent = unquotedContent.replace(
        /CONTENT_START([\s\S]*?)CONTENT_END/g,
        (_match: string, innerContent: string) => btoa(innerContent.trim())
      );

      // Re-add quotes for string content, or leave as-is for array content
      return `"content":${
        content.startsWith("[") ? sanitizedContent : `"${sanitizedContent}"`
      }`;
    }
  );
}
