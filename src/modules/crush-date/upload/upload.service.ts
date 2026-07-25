import { randomUUID } from 'node:crypto';
import { AppError } from '../../../utils/app-error';
import { crushDateConfig } from '../crush-date.config';
import { ossClient } from '../oss/oss.client';
import type {
  UploadImageAtPathInput,
  UploadImageInput,
  UploadImageResponse,
} from './upload.types';
import { detectImageMimeType } from './upload.validation';

const imageExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function buildObjectKeyWithoutExtension(input: UploadImageInput): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const directory = input.contentType === 'food' ? 'foods' : 'places';

  return `crush-date/${directory}/${year}/${month}/${randomUUID()}`;
}

export function buildPublicUrl(objectKey: string): string {
  const baseUrl = crushDateConfig.OSS_PUBLIC_BASE_URL.replace(/\/$/, '');
  const encodedKey = objectKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `${baseUrl}/${encodedKey}`;
}

export async function uploadImageAtPath(
  input: UploadImageAtPathInput,
): Promise<UploadImageResponse> {
  const detectedMimeType = detectImageMimeType(input.buffer);
  if (!detectedMimeType || detectedMimeType !== input.mimeType) {
    throw new AppError(400, '图片文件内容与格式不匹配');
  }

  const extension = imageExtensions[detectedMimeType];
  const objectKey = `${input.objectKeyWithoutExtension}.${extension}`;

  await ossClient.put(objectKey, input.buffer, {
    headers: {
      'Content-Type': detectedMimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });

  return {
    url: buildPublicUrl(objectKey),
    objectKey,
  };
}

export async function uploadImage(
  input: UploadImageInput,
): Promise<UploadImageResponse> {
  return uploadImageAtPath({
    objectKeyWithoutExtension: buildObjectKeyWithoutExtension(input),
    buffer: input.buffer,
    mimeType: input.mimeType,
  });
}

export async function deleteImage(objectKey: string): Promise<void> {
  await ossClient.delete(objectKey);
}

export async function deleteImageByPublicUrl(publicUrl: string): Promise<boolean> {
  const configuredBaseUrl = new URL(crushDateConfig.OSS_PUBLIC_BASE_URL);
  const imageUrl = new URL(publicUrl);
  const basePath = configuredBaseUrl.pathname.replace(/\/+$/, '');
  const objectKeyPrefix = `${basePath}/`;

  if (
    imageUrl.origin !== configuredBaseUrl.origin
    || !imageUrl.pathname.startsWith(objectKeyPrefix)
  ) {
    return false;
  }

  try {
    const objectKey = imageUrl.pathname
      .slice(objectKeyPrefix.length)
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .join('/');

    if (!objectKey.startsWith('crush-date/')) {
      return false;
    }

    await deleteImage(objectKey);
    return true;
  } catch (error) {
    if (error instanceof URIError) {
      return false;
    }
    throw error;
  }
}
