import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/app-error';
import { fail } from '../utils/response';

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(fail(err.message));
  }

  if (err instanceof ZodError) {
    const message = err.issues[0]?.message ?? '参数校验失败';
    return res.status(400).json(fail(message));
  }

  console.error(err);
  return res.status(500).json(fail('服务器内部错误'));
}
