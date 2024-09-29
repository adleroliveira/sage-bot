import {
  LLMProvider,
  LLMOptions,
  LLMTextResponse,
  LLMImageResponse,
  BaseProviderConfig,
  LLMMode,
} from "../LLMProvider";

export interface AmazonConfig extends BaseProviderConfig {
  // Add other Amazon-specific options here
}

export class AmazonTitanProvider extends LLMProvider {
  private modelId: string;

  constructor(config: AmazonConfig) {
    super(config);
    this.modelId = config.modelId;
  }

  generateTextPayload(prompt: string, options: LLMOptions): any {
    return {
      modelId: this.modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        inputText: prompt,
        textGenerationConfig: {
          maxTokenCount: options.maxTokens || 3072,
          stopSequences: options.stopSequences || [],
          temperature: options.temperature || 0.7,
          topP: options.topP || 0.9,
        },
      }),
    };
  }

  generateImagePayload(prompt: string, options: LLMOptions): any {
    throw new Error("Image generation is not supported by Amazon Titan models");
  }

  parseTextResponse(response: any): LLMTextResponse {
    return {
      text: response.results[0].outputText,
      usage: {
        inputTokens: response.inputTextTokenCount,
        outputTokens: response.results[0].tokenCount,
      },
    };
  }

  parseImageResponse(response: any): LLMImageResponse {
    throw new Error("Image generation is not supported by Amazon Titan models");
  }
}
