import type { ContentType } from '../content-item/content-item.types';

export interface UploadImageInput {
  contentType: ContentType;
  buffer: Buffer;
  mimeType: string;
}

export interface UploadImageAtPathInput {
  objectKeyWithoutExtension: string;
  buffer: Buffer;
  mimeType: string;
}

export interface UploadImageResponse {
  url: string;
  objectKey: string;
}
