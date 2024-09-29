import {
  LLMProvider,
  LLMOptions,
  LLMTextResponse,
  LLMImageResponse,
  BaseProviderConfig,
  LLMMode,
} from "../LLMProvider";

export interface MetaConfig extends BaseProviderConfig {
  // Add Meta-specific options here
}

export class MetaLlamaProvider extends LLMProvider {
  private modelId: string;

  constructor(config: MetaConfig) {
    super(config);
    this.modelId = config.modelId;
  }

  generateTextPayload(prompt: string, options: LLMOptions): any {
    return {
      modelId: this.modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        prompt,
        max_gen_len: options.maxTokens || 512,
        temperature: options.temperature || 0.5,
        top_p: options.topP || 0.9,
      }),
    };
  }

  generateImagePayload(prompt: string, options: LLMOptions): any {
    throw new Error("Image generation is not supported by Meta Llama models");
  }

  parseTextResponse(response: any): LLMTextResponse {
    return {
      text: response.generation,
      usage: {
        inputTokens: response.prompt_token_count,
        outputTokens: response.generation_token_count,
      },
    };
  }

  parseImageResponse(response: any): LLMImageResponse {
    throw new Error("Image generation is not supported by Meta Llama models");
  }
}
