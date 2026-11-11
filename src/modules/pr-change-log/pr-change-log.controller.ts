import type { Request, Response } from 'express';
import { AppError } from '../../utils/app-error';
import { success } from '../../utils/response';
import { allowedRepositories, prChangeLogConfig } from './pr-change-log.config';
import { idSchema, ingestSchema, listQuerySchema } from './pr-change-log.schema';
import * as service from './pr-change-log.service';

export function me(req: Request, res: Response) {
  res.json(success({ userId: req.user!.userId, canRead: true }));
}

export async function list(req: Request, res: Response) {
  res.json(success(await service.listRecords(listQuerySchema.parse(req.query))));
}

export async function detail(req: Request, res: Response) {
  res.json(success(await service.getRecord(idSchema.parse(req.params.id))));
}

export async function ingest(req: Request, res: Response) {
  const input = ingestSchema.parse(req.body);
  if (!allowedRepositories(prChangeLogConfig).includes(input.repository)) throw new AppError(403, '该仓库未开放上报');
  res.status(202).json(success(await service.ingest(input)));
}

export async function reanalyze(req: Request, res: Response) {
  idSchema.parse(req.params.id);
  throw new AppError(410, '已改为接收 PR-Agent 审查结果，请在 GitHub 更新或重新审查 PR');
}
