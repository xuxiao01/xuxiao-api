import type { ErrorRequestHandler, RequestHandler } from 'express';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/app-error';
import { fail } from '../../utils/response';
import { verifyToken } from '../weekly-lab/auth/jwt';
import { verifyGuestToken } from './mianjing.auth';
import { isMianjingAdmin } from './mianjing.config';

export const authenticateMianjing: RequestHandler = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(new AppError(401, '请先登录'));
  const token = header.slice(7);
  if (verifyGuestToken(token)) {
    res.locals.mianjingRole = 'guest';
    return next();
  }
  try {
    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new AppError(401, '登录已失效，请重新登录');
    }
    const id = payload.userId;
    if (!Number.isInteger(id) || id < 1 || id > 2147483647) throw new AppError(401, '登录已失效');
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) throw new AppError(401, '账号不存在，请重新登录');
    if (!isMianjingAdmin(id)) throw new AppError(403, '此账号未开放面经台权限，请使用游客入口');
    req.user = payload;
    res.locals.mianjingRole = 'admin';
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user || !isMianjingAdmin(req.user.userId)) {
    return next(new AppError(403, '只有超级管理员可以修改题库'));
  }
  next();
};

export const mianjingBodyError: ErrorRequestHandler = (error, _req, res, next) => {
  if (error?.type === 'entity.too.large') {
    return res.status(413).json(fail('请求内容不能超过 2 MiB'));
  }
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json(fail('JSON 格式无效'));
  }
  next(error);
};
