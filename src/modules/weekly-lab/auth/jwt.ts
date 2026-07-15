import jwt from 'jsonwebtoken';
import { weeklyLabConfig } from '../weekly-lab.config';

export interface JwtPayload {
  userId: number;
  email: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, weeklyLabConfig.JWT_SECRET, {
    expiresIn: weeklyLabConfig.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, weeklyLabConfig.JWT_SECRET) as JwtPayload;
}
