import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/app-error';
import { success } from '../../utils/response';
import { putWeeklyReportSchema } from './weekly-report.schema';
import * as weeklyReportService from './weekly-report.service';

function getUserId(req: Request): number {
  if (!req.user) {
    throw new AppError(401, '未授权');
  }
  return req.user.userId;
}

function getWeekKeyParam(req: Request): string {
  const weekKey = req.params.weekKey;
  if (typeof weekKey !== 'string') {
    throw new AppError(400, 'week_key 格式非法');
  }
  return weekKey;
}

function getUsernameParam(req: Request): string {
  const username = req.params.username;
  if (typeof username !== 'string') {
    throw new AppError(400, '参数校验失败');
  }
  return decodeURIComponent(username);
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await weeklyReportService.listByUser(getUserId(req));
    return res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function getByWeekKey(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await weeklyReportService.getByWeekKey(getUserId(req), getWeekKeyParam(req));
    return res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function upsert(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = putWeeklyReportSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? '参数校验失败';
      throw new AppError(400, message);
    }

    const weekKey = getWeekKeyParam(req);
    const isNew = !(await weeklyReportService.existsForUser(getUserId(req), weekKey));

    const data = await weeklyReportService.upsert(getUserId(req), weekKey, parsed.data);

    return res.status(isNew ? 201 : 200).json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await weeklyReportService.deleteByWeekKey(getUserId(req), getWeekKeyParam(req));
    return res.json(success(null));
  } catch (err) {
    next(err);
  }
}

export async function getPublic(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await weeklyReportService.getPublicByUsernameAndWeekKey(
      getUsernameParam(req),
      getWeekKeyParam(req),
    );
    return res.json(success(data));
  } catch (err) {
    next(err);
  }
}
