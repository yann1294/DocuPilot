import type { S3EventRecord } from "aws-lambda";
import { S3Client } from "@aws-sdk/client-s3";

export const s3 = new S3Client({});

export interface S3Location {
  bucket: string;
  key: string;
}

export function getS3LocationFromRecord(record: S3EventRecord): S3Location {
  return {
    bucket: record.s3.bucket.name,
    key: decodeURIComponent(record.s3.object.key.replace(/\+/g, " "))
  };
}

export function buildS3Uri(location: S3Location): string {
  return `s3://${location.bucket}/${location.key}`;
}
