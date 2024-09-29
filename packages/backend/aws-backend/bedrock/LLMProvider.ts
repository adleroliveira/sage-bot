import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

import {
  AsyncMultiLanguagePrompt,
  SupportedLanguage,
  IPromptParams,
} from "./AsyncMultiLanguagePrompt";

import { ProviderType } from "./llmProviderFactory";
import { Loggable } from "microservice-framework";

export interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
}

export interface LLMImageOptions extends LLMOptions {
  width?: number;
  height?: number;
  samples?: number;
  cfgScale?: number;
  steps?: number;
  seed?: number;
  imageStrength?: number;
  stylePreset?:
    | "3d-model"
    | "analog-film"
    | "animé"
    | "cinematic"
    | "comic-book"
    | "digital-art"
    | "enhance"
    | "fantasy-art"
    | "isometric"
    | "line-art"
    | "low-poly"
    | "modeling-compound"
    | "neon-punk"
    | "origami"
    | "photographic"
    | "pixel-art"
    | "tile-texture";
  aspectRatio?: "1:1" | "4:3" | "3:4" | "16:9" | "9:16";
  outputFormat?: "png" | "jpeg";
}

export interface LLProviderImageOptions extends LLMImageOptions {
  llmProvider: ProviderType;
  modelId: string;
  maxTokens: number;
}

export interface LLMTextResponse {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface LLMImageResponse {
  imageData: Buffer;
  base64Image: string;
  usage: {
    inputTokens: number;
  };
}

export type LLMResponse = LLMTextResponse | LLMImageResponse;

export interface BaseProviderConfig {
  modelId: string;
  supportedModes: LLMMode[];
}

export enum LLMMode {
  TEXT = "text",
  IMAGE = "image",
}

export abstract class LLMProvider extends Loggable {
  protected client: BedrockRuntimeClient;
  protected supportedModes: LLMMode[];

  constructor(config: BaseProviderConfig) {
    super();
    this.client = new BedrockRuntimeClient();
    this.supportedModes = config.supportedModes;
  }

  abstract generateTextPayload(prompt: string, options: LLMOptions): any;
  abstract generateImagePayload(
    prompt: string,
    options: LLMOptions,
    inputImage?: string
  ): any;
  abstract parseTextResponse(response: any): LLMTextResponse;
  abstract parseImageResponse(response: string): LLMImageResponse;

  @Loggable.handleErrors
  async generateText<T extends IPromptParams>(
    promptInstance: AsyncMultiLanguagePrompt<T>,
    language: SupportedLanguage,
    options: LLMOptions = {}
  ): Promise<LLMTextResponse> {
    if (!this.supportedModes.includes(LLMMode.TEXT)) {
      throw new Loggable.LoggableError(
        "Text generation is not supported by this model"
      );
    }

    try {
      const prompt = await promptInstance.getPrompt(language);
      const payload = this.generateTextPayload(prompt, options);
      const command = new InvokeModelCommand(payload);
      const response = await this.client.send(command);

      if (!response.body) {
        throw new Loggable.LoggableError(
          "No response body received from Bedrock"
        );
      }

      let responseBody;
      try {
        responseBody = JSON.parse(new TextDecoder().decode(response.body));
      } catch (error) {
        throw new Loggable.LoggableError(
          "Failed to parse response body",
          error
        );
      }

      return this.parseTextResponse(responseBody);
    } catch (error: any) {
      if (error instanceof Loggable.LoggableError) {
        throw error;
      } else {
        throw new Loggable.LoggableError(error);
      }
    }
  }

  @Loggable.handleErrors
  async generateImage(
    prompt: string,
    options: LLMImageOptions = { width: 512, height: 512 },
    inputImage?: string
  ): Promise<LLMImageResponse> {
    if (!this.supportedModes.includes(LLMMode.IMAGE)) {
      throw new Loggable.LoggableError(
        "Image generation is not supported by this model"
      );
    }

    const payload = this.generateImagePayload(prompt, options, inputImage);
    const command = new InvokeModelCommand(payload);
    const response = await this.client.send(command);

    if (!response.body) {
      throw new Loggable.LoggableError(
        "No response body received from Bedrock"
      );
    }

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const base64ImageData = responseBody.images
      ? responseBody.images[0]
      : responseBody.artifacts[0].base64;

    return this.parseImageResponse(base64ImageData);
  }
}
