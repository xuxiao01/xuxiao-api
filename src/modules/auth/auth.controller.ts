import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/app-error';
import { fail, success } from '../../utils/response';
import { loginSchema, registerSchema, updateWeeklySettingsSchema } from './auth.schema';
import * as authService from './auth.service';

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? '参数校验失败';
      return res.status(400).json(fail(message));
    }

    const result = await authService.register(parsed.data);
    return res.status(201).json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? '参数校验失败';
      return res.status(400).json(fail(message));
    }

    const result = await authService.login(parsed.data);
    return res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError(401, '未授权');
    }

    const user = await authService.getMe(req.user.userId);
    return res.json(success(user));
  } catch (err) {
    next(err);
  }
}

export async function updateWeeklySettings(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError(401, '未授权');
    }

    const parsed = updateWeeklySettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? '参数校验失败';
      return res.status(400).json(fail(message));
    }

    const result = await authService.updateWeeklySettings(req.user.userId, parsed.data);
    return res.json(success(result));
  } catch (err) {
    next(err);
  }
}
