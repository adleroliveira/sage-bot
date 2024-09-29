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

export interface LLMServiceConfig {
  llmConfig: LLMConfig;
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
    this.llmTextProvider = this.createLLMTextProvider();
    this.llmImageProvider = this.createLLMImageProvider();
    this.publisher = new S3PublishingStrategy(
      process.env.AWS_REGION || "us-east-1",
      config.bucketName
    );
    this.config = config;
  }

  private createLLMTextProvider(): LLMProvider {
    return createLLMProvider({
      provider: this.config.llmConfig.llmTextProvider,
      config: {
        modelId: this.config.llmConfig.llmTextModelId,
        supportedModes: [LLMMode.TEXT],
      },
    });
  }

  private createLLMImageProvider(): LLMProvider {
    return createLLMProvider({
      provider: this.config.llmConfig.llmImageProvider,
      config: {
        modelId: this.config.llmConfig.llmImageModelId,
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
    return imagePath;
  }
}
