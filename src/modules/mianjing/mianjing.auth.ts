import jwt from 'jsonwebtoken';
import { AppError } from '../../utils/app-error';
import { mianjingConfig } from './mianjing.config';
import { weeklyLabConfig } from '../weekly-lab/weekly-lab.config';

export function guestSecret(): string {
  const secret = mianjingConfig.MIANJING_GUEST_JWT_SECRET;
  if (!secret || secret.length < 32 || secret === weeklyLabConfig.JWT_SECRET) {
    throw new AppError(
      503,
      '游客入口未就绪，请配置独立的 MIANJING_GUEST_JWT_SECRET（至少 32 字符）',
    );
  }
  return secret;
}
export function signGuestToken(): string {
  return jwt.sign({ role: 'guest', purpose: 'mianjing' }, guestSecret(), {
    algorithm: 'HS256',
    audience: 'mianjing',
    issuer: 'mianjing',
    expiresIn: '1h',
  });
}
export function verifyGuestToken(token: string): boolean {
  try {
    const payload = jwt.verify(token, guestSecret(), {
      algorithms: ['HS256'],
      audience: 'mianjing',
      issuer: 'mianjing',
      maxAge: '1h',
    });
    return (
      typeof payload !== 'string' && payload.role === 'guest' && payload.purpose === 'mianjing'
    );
  } catch {
    return false;
  }
}
