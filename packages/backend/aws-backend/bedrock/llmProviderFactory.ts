import { LLMProvider, LLMMode } from "./LLMProvider";
import { AnthropicProvider, AnthropicConfig } from "./providers/Anthropic";
import { AmazonTitanProvider, AmazonConfig } from "./providers/Amazon";
import { MetaLlamaProvider, MetaConfig } from "./providers/Meta";
import {
  StabilityAIProvider,
  StabilityAIConfig,
} from "./providers/StabilityAI";
import { BaseProviderConfig } from "./LLMProvider";

export type ProviderType =
  | "anthropic"
  | "amazon"
  | "titan"
  | "meta"
  | "llama"
  | "stabilityai";

export type ProviderConfig =
  | { provider: "anthropic"; config: AnthropicConfig }
  | { provider: "amazon" | "titan"; config: AmazonConfig }
  | { provider: "meta" | "llama"; config: MetaConfig }
  | { provider: "stabilityai"; config: StabilityAIConfig };

type ProviderClass = new (config: BaseProviderConfig) => LLMProvider;

const defaultProviderClasses: Record<ProviderType, ProviderClass> = {
  anthropic: AnthropicProvider,
  amazon: AmazonTitanProvider,
  titan: AmazonTitanProvider,
  meta: MetaLlamaProvider,
  llama: MetaLlamaProvider,
  stabilityai: StabilityAIProvider,
};

export const createLLMProvider = (
  providerConfig: ProviderConfig,
  customProviderClasses: Partial<Record<ProviderType, ProviderClass>> = {}
): LLMProvider => {
  const providerClasses = {
    ...defaultProviderClasses,
    ...customProviderClasses,
  };
  const ProviderClass = providerClasses[providerConfig.provider];

  if (!ProviderClass) {
    throw new Error(`Unsupported provider: ${providerConfig.provider}`);
  }

  // Ensure that supportedModes is included in the config
  const configWithModes = {
    ...providerConfig.config,
    supportedModes: providerConfig.config.supportedModes || [LLMMode.TEXT],
  };

  const provider = new ProviderClass(configWithModes);

  return provider;
};
