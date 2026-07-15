import OSS from 'ali-oss';
import { crushDateConfig } from '../crush-date.config';

export const ossClient = new OSS({
  region: crushDateConfig.OSS_REGION,
  bucket: crushDateConfig.OSS_BUCKET,
  endpoint: crushDateConfig.OSS_ENDPOINT,
  accessKeyId: crushDateConfig.OSS_ACCESS_KEY_ID,
  accessKeySecret: crushDateConfig.OSS_ACCESS_KEY_SECRET,
  secure: true,
});
