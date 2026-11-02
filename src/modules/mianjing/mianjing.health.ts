import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { success, fail } from '../../utils/response';
import { guestSecret } from './mianjing.auth';
import { mianjingConfig } from './mianjing.config';

export async function health(_req: Request, res: Response) {
  res.set('Cache-Control', 'no-store');
  try {
    guestSecret();
    const commit = process.env.RELEASE_SHA || '';
    if (!/^[a-f0-9]{40}$/.test(commit) || !mianjingConfig.MIANJING_ADMIN_USER_ID)
      throw new Error('Configuration not ready');
    const admin = await prisma.user.findUnique({
      where: { id: mianjingConfig.MIANJING_ADMIN_USER_ID },
      select: { id: true },
    });
    if (!admin) throw new Error('Administrator not ready');
    await prisma.$queryRaw`SELECT (SELECT COUNT(*) FROM mianjing_questions) AS questions,
      (SELECT COUNT(*) FROM mianjing_companies) AS companies,
      (SELECT COUNT(*) FROM mianjing_occurrences) AS occurrences`;
    res.json(success({ status: 'ready', apiVersion: 1, commit }));
  } catch {
    res.status(503).json(fail('面经服务未就绪'));
  }
}
