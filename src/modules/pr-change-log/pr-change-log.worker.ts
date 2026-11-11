import type { PrismaClient } from '../../generated/client';
import { prisma } from '../../lib/prisma';
import { AnalysisError, type AnalysisRecord, type AnalysisResult } from './pr-change-log.ai';
import { analysisGuard, claimAnalysis } from './pr-change-log.service';
import { analysisResultSchema } from './pr-change-log.schema';

export async function runAnalysisOnce(
  analyze: (record: AnalysisRecord) => Promise<AnalysisResult>,
  db: PrismaClient = prisma,
  now = new Date(),
): Promise<'idle' | 'succeeded' | 'retry' | 'failed' | 'stale'> {
  const claim = await claimAnalysis(db, now);
  if (!claim) return 'idle';
  if (claim.exhausted) return 'failed';
  const record = claim.record;
  try {
    const result = await analyze(record);
    const validated = analysisResultSchema.parse({ changeType: result.changeType, changeSummary: result.changeSummary });
    if (typeof result.partial !== 'boolean') throw new AnalysisError(false);
    const updated = await db.prChangeLog.updateMany({
      where: analysisGuard(record), data: {
        analysisStatus: 'succeeded', changeType: validated.changeType,
        changeSummary: validated.changeSummary, analysisPartial: result.partial,
      },
    });
    return updated.count ? 'succeeded' : 'stale';
  } catch (error) {
    const retry = error instanceof AnalysisError && error.retryable && record.analysisAttempts < 2;
    const updated = await db.prChangeLog.updateMany({
      where: analysisGuard(record), data: { analysisStatus: retry ? 'pending' : 'failed' },
    });
    return !updated.count ? 'stale' : retry ? 'retry' : 'failed';
  }
}
