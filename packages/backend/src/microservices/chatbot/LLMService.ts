import {
  ProviderType,
  createLLMProvider,
} from "../../aws-backend/bedrock/llmProviderFactory";
import {
  LLMProvider,
  LLMMode,
  LLMImageOptions,
} from "../../aws-backend/bedrock/LLMProvider";
import {
  AsyncMultiLanguagePrompt,
  SupportedLanguage,
} from "../../aws-backend/bedrock/AsyncMultiLanguagePrompt";
import { S3PublishingStrategy } from "../../aws-backend/S3PublishingStrategy";

export interface LLMConfig {
  llmTextProvider: ProviderType;
  llmImageProvider: ProviderType;
  llmTextModelId: string;
  llmImageModelId: string;
  maxTokens: number;
}

export interface LLMServiceConfig extends LLMConfig {
  defaultLanguage: SupportedLanguage;
  bucketName: string;
}

const defaultImageOptions: LLMImageOptions = {
  width: 512,
  height: 512,
  seed: 1337,
  outputFormat: "png",
};

export class LLMService {
  private llmTextProvider: LLMProvider;
  private llmImageProvider: LLMProvider;
  private config: LLMServiceConfig;
  private publisher: S3PublishingStrategy;

  constructor(config: LLMServiceConfig) {
    this.config = config;
    this.llmTextProvider = this.createLLMTextProvider();
    this.llmImageProvider = this.createLLMImageProvider();
    this.publisher = new S3PublishingStrategy(
      process.env.AWS_REGION || "us-west-2",
      config.bucketName
    );
  }

  private createLLMTextProvider(): LLMProvider {
    return createLLMProvider({
      provider: this.config.llmTextProvider,
      config: {
        modelId: this.config.llmTextModelId,
        supportedModes: [LLMMode.TEXT],
      },
    });
  }

  private createLLMImageProvider(): LLMProvider {
    return createLLMProvider({
      provider: this.config.llmImageProvider,
      config: {
        modelId: this.config.llmImageModelId,
        supportedModes: [LLMMode.IMAGE],
      },
    });
  }

  public async generateText(
    prompt: AsyncMultiLanguagePrompt<any>,
    language: SupportedLanguage,
    maxTokens: number
  ): Promise<string> {
    const response = await this.llmTextProvider.generateText(
      prompt,
      language || this.config.defaultLanguage,
      {
        maxTokens,
      }
    );
    if (!response.text) {
      throw new Error("No text generated");
    }
    return response.text;
  }

  public async generateImage(
    prompt: string,
    fileName: string,
    imageOptions?: LLMImageOptions
  ): Promise<string> {
    const { imageData } = await this.llmImageProvider.generateImage(prompt, {
      ...defaultImageOptions,
      ...imageOptions,
    });
    const imagePath = await this.publisher.publishTo(
      imageData,
      fileName,
      "image/png"
    );
    return fileName;
  }
}
