import {
  LLMProvider,
  LLMOptions,
  LLMTextResponse,
  LLMImageResponse,
  BaseProviderConfig,
  LLMMode,
} from "../LLMProvider";

export interface AnthropicConfig extends BaseProviderConfig {
  // Add other Anthropic-specific options here
}

export class AnthropicProvider extends LLMProvider {
  private modelId: string;

  constructor(config: AnthropicConfig) {
    super(config);
    this.modelId = config.modelId;
  }

  generateTextPayload(prompt: string, options: LLMOptions): any {
    return {
      modelId: this.modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: options.maxTokens || 500,
        messages: [{ role: "user", content: prompt }],
        temperature: options.temperature || 0.7,
        top_p: options.topP || 1,
        top_k: options.topK || 250,
        stop_sequences: options.stopSequences || [],
      }),
    };
  }

  generateImagePayload(prompt: string, options: LLMOptions): any {
    throw new Error("Image generation is not supported by Anthropic models");
  }

  parseTextResponse(response: any): LLMTextResponse {
    const text = response.content
      .filter((item: any) => item.type === "text")
      .map((item: any) => item.text)
      .join("\n")
      .trim();

    return {
      text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  parseImageResponse(response: any): LLMImageResponse {
    throw new Error("Image generation is not supported by Anthropic models");
  }
}
