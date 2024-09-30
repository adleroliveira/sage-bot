import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

import { Readable } from "stream";

export interface IPublishingStrategy {
  publishTo(data: any, path: string, contentType: string): Promise<string>;
  readFrom(path: string): Promise<any>;
}

export class S3PublishingStrategy implements IPublishingStrategy {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(region: string, bucketName: string) {
    this.s3Client = new S3Client({ region });
    this.bucketName = bucketName;
  }

  async publishTo(
    data: any,
    path: string,
    ContentType: string
  ): Promise<string> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: path,
        Body: data,
        ContentType,
      })
    );

    return `s3://${this.bucketName}/${path}`;
  }

  async readFrom(path: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: path,
    });

    const response = await this.s3Client.send(command);

    if (!response.Body) {
      throw new Error("Empty response body");
    }

    const body = response.Body;

    // Check if body is a Readable stream
    if (body instanceof Readable) {
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        body.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        body.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
        body.on("error", reject);
      });
    } else if (body instanceof Blob) {
      // If it's a Blob (for browser environments)
      return await body.text();
    } else if (typeof body.transformToString === "function") {
      // If it's an SDK v3 stream with transformToString method
      return await body.transformToString();
    } else {
      // If it's another type of stream or unknown type
      const streamToString = async (stream: any): Promise<string> => {
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks).toString("utf-8");
      };
      return await streamToString(body);
    }
  }
}
