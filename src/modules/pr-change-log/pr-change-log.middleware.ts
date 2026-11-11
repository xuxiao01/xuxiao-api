import { createHash, timingSafeEqual } from 'node:crypto';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/app-error';
import { fail } from '../../utils/response';
import { verifyToken } from '../weekly-lab/auth/jwt';
import { allowedRepositories, prChangeLogConfig } from './pr-change-log.config';

export const requireViewer: RequestHandler = async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new AppError(401, '请先登录');
    let payload;
    try { payload = verifyToken(header.slice(7)); } catch { throw new AppError(401, '登录已失效'); }
    if (typeof payload !== 'object' || payload === null || 'purpose' in payload || 'role' in payload) throw new AppError(401, '请使用用户账号登录');
    if (!Number.isInteger(payload.userId) || payload.userId < 1 || payload.userId > 2147483647) throw new AppError(401, '登录已失效');
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true } });
    if (!user) throw new AppError(401, '账号不存在');
    req.user = payload;
    next();
  } catch (error) { next(error); }
};

export const requireIngest: RequestHandler = (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const expected = prChangeLogConfig.PR_CHANGE_LOG_INGEST_TOKEN;
  if (!expected || expected.length < 32 || !allowedRepositories(prChangeLogConfig).length) {
    return next(new AppError(503, 'PR 上报入口尚未配置'));
  }
  const header = req.headers.authorization;
  const supplied = header?.startsWith('Bearer ') ? header.slice(7) : '';
  const digest = (value: string) => createHash('sha256').update(value).digest();
  if (!supplied || !timingSafeEqual(digest(supplied), digest(expected))) return next(new AppError(401, '上报凭证无效'));
  next();
};

export const bodyError: ErrorRequestHandler = (error, _req, res, next) => {
  if (error?.type === 'entity.too.large') return res.status(413).json(fail('PR 上报不能超过 8 MiB'));
  if (error?.type === 'entity.parse.failed') return res.status(400).json(fail('JSON 格式无效'));
  next(error);
};
