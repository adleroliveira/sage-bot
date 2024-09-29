import { Polly, VoiceId, LanguageCode } from "@aws-sdk/client-polly";
import {
  SynthesizeSpeechCommand,
  SynthesizeSpeechCommandInput,
} from "@aws-sdk/client-polly";
import { SdkStreamMixin } from "@aws-sdk/types";
import { sdkStreamMixin } from "@aws-sdk/util-stream-node";
import { Loggable } from "microservice-framework";

export interface BaseAudioGenerationConfig {}

export interface ITextToAudioStrategy<T extends BaseAudioGenerationConfig> {
  convertToAudio(input: string, config: T): Promise<Buffer>;
}

export interface AWSPollyConfig extends BaseAudioGenerationConfig {
  voiceId: VoiceId;
  engine?: "standard" | "neural" | "long-form" | "generative";
  languageCode?: LanguageCode;
  textType?: "text" | "ssml";
  outputFormat?: "mp3" | "json";
  speechMarkTypes?: Array<"word" | "sentence" | "ssml">;
}

export class AWSPollyStrategy
  extends Loggable
  implements ITextToAudioStrategy<AWSPollyConfig>
{
  private polly: Polly;

  constructor(private config: { region: string }) {
    super();
    this.polly = new Polly(this.config);
  }

  async convertToAudio(input: string, config: AWSPollyConfig): Promise<Buffer> {
    const params: SynthesizeSpeechCommandInput = {
      Text: input,
      OutputFormat: config.outputFormat || "mp3",
      VoiceId: config.voiceId,
      Engine: config.engine || "standard",
      LanguageCode: config.languageCode,
      TextType: config.textType,
      SpeechMarkTypes: config.speechMarkTypes,
    };

    const command = new SynthesizeSpeechCommand(params);
    const response = await this.polly.send(command);

    if (response.AudioStream instanceof Uint8Array) {
      return Buffer.from(response.AudioStream);
    } else if (response.AudioStream) {
      const stream = sdkStreamMixin(response.AudioStream as SdkStreamMixin);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } else {
      throw new Loggable.LoggableError("Failed to generate audio");
    }
  }
}
