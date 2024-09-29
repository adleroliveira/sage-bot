import {
  LLMProvider,
  LLMOptions,
  LLMTextResponse,
  LLMImageResponse,
  BaseProviderConfig,
  LLMMode,
  LLMImageOptions,
} from "../LLMProvider";
import { Buffer } from "buffer";

export interface StabilityAIConfig extends BaseProviderConfig {
  width?: number;
  height?: number;
  samples?: number;
  cfgScale?: number;
  steps?: number;
  filterStrength?: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  imageStrength?: number;
  stylePreset?: string;
  aspectRatio?: string;
  outputFormat?: string;
}

export class StabilityAIProvider extends LLMProvider {
  private modelId: string;
  private width: number;
  private height: number;
  private samples: number;
  private cfgScale: number;
  private steps: number;
  private stylePreset: string;
  private imageStrength: number;
  private aspectRatio: string;
  private outputFormat: string;

  constructor(config: StabilityAIConfig) {
    super({ ...config, supportedModes: [LLMMode.IMAGE] });
    this.modelId = config.modelId;
    this.width = config.width || 1024;
    this.height = config.height || 1024;
    this.samples = config.samples || 1;
    this.cfgScale = config.cfgScale || 7;
    this.steps = config.steps || 40;
    this.imageStrength = config.imageStrength || 0.35;
    this.stylePreset = config.stylePreset || "";
    this.aspectRatio = config.aspectRatio || "1:1";
    this.outputFormat = config.outputFormat || "jpeg";
  }

  generateTextPayload(prompt: string, options: LLMOptions): any {
    throw new Error("Text generation is not supported by StabilityAI models");
  }

  generateImagePayload(
    prompt: string,
    options: LLMImageOptions,
    inputImage?: string
  ): any {
    const isSD3 = this.modelId.includes("sd3") || this.modelId.includes("core");

    if (isSD3) {
      return {
        modelId: this.modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          prompt,
          mode: inputImage ? "image-to-image" : "text-to-image",
          aspect_ratio: options.aspectRatio || this.aspectRatio,
          output_format: options.outputFormat || this.outputFormat,
          seed: options.seed,
        }),
      };
    } else {
      const payload: any = {
        modelId: this.modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          text_prompts: [{ text: prompt }],
          cfg_scale: options.cfgScale || this.cfgScale,
          steps: options.steps || this.steps,
          width: options.width || this.width,
          height: options.height || this.height,
          samples: options.samples || this.samples,
          // image_strength: options.imageStrength || this.imageStrength,
          seed: options.seed,
          // style_preset: options.stylePreset || this.stylePreset,
        }),
      };

      // this.info("image payload", payload);

      if (inputImage) {
        payload.body = JSON.parse(payload.body);
        payload.body.init_image = inputImage;
        payload.body = JSON.stringify(payload.body);
      }
      return payload;
    }
  }

  parseTextResponse(response: any): LLMTextResponse {
    throw new Error("Text generation is not supported by StabilityAI models");
  }

  parseImageResponse(base64ImageData: string): LLMImageResponse {
    const imageData = Buffer.from(base64ImageData, "base64");
    return {
      imageData: imageData,
      base64Image: base64ImageData,
      usage: {
        inputTokens: 0, // StabilityAI doesn't provide token usage for image generation
      },
    };
  }
}
