import {
  AWSPollyConfig,
  AWSPollyStrategy,
} from "../../aws-backend/AWSPollyStrategy";
import { S3PublishingStrategy } from "../../aws-backend/S3PublishingStrategy";
import { Loggable } from "microservice-framework";

export class AudioService extends Loggable {
  private publisher: S3PublishingStrategy;
  private bucketName: string;
  private audioGenerator: AWSPollyStrategy;
  private baseAudioConfig: AWSPollyConfig = {
    voiceId: "Stephen",
    engine: "neural",
    languageCode: "en-US",
    textType: "text",
    outputFormat: "mp3",
  };

  constructor(bucketName: string) {
    super();
    this.bucketName = bucketName;
    this.audioGenerator = new AWSPollyStrategy({
      region: process.env.AWS_REGION || "us-wes-2",
    });
    this.publisher = new S3PublishingStrategy(
      process.env.AWS_REGION || "us-west-2",
      bucketName
    );
  }

  public async generateAudio(
    text: string,
    fileName: string,
    config?: AWSPollyConfig
  ) {
    const audioBuffer = await this.audioGenerator.convertToAudio(text, {
      ...this.baseAudioConfig,
      ...config,
    });
    const normalizedFileName = fileName.toLowerCase().endsWith(".mp3")
      ? fileName
      : `${fileName}.mp3`;

    const filePath = await this.publisher.publishTo(
      audioBuffer,
      `${normalizedFileName}`,
      "audio/mp3"
    );

    this.info(`Audio file ${filePath} generated`);

    return fileName;
  }
}
