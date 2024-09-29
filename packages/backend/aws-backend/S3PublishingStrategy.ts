import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

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

  async readFrom(path: string): Promise<any> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: path,
    });

    const response = await this.s3Client.send(command);

    if (!response.Body) {
      throw new Error("Empty response body");
    }

    // Convert the ReadableStream to a string
    const streamToString = (stream: ReadableStream) =>
      new Promise((resolve, reject) => {
        const chunks: Uint8Array[] = [];
        const reader = stream.getReader();
        reader
          .read()
          .then(function process({ done, value }): any {
            if (done) {
              return resolve(Buffer.concat(chunks).toString("utf-8"));
            }
            chunks.push(value);
            return reader.read().then(process);
          })
          .catch(reject);
      });

    return streamToString(response.Body as ReadableStream);
  }
}
