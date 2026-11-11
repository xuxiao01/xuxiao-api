import 'dotenv/config';
import { setTimeout as delay } from 'node:timers/promises';
import { prisma } from '../../lib/prisma';
import { aiEndpoint, analyzeWithAI } from './pr-change-log.ai';
import { prChangeLogConfig } from './pr-change-log.config';
import { runAnalysisOnce } from './pr-change-log.worker';

async function main() {
  aiEndpoint(prChangeLogConfig);
  let stopping = false;
  const controller = new AbortController();
  const stop = () => { stopping = true; controller.abort(); };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  console.log('PR analysis worker started');
  try {
    while (!stopping) {
      try {
        const result = await runAnalysisOnce((record) => analyzeWithAI(record, prChangeLogConfig));
        if (result !== 'idle') console.log(`PR analysis: ${result}`);
        if (result === 'idle' || result === 'retry') await delay(result === 'retry' ? 5000 : 2000, undefined, { signal: controller.signal });
      } catch {
        if (!stopping) {
          console.error('PR analysis worker unavailable; will retry');
          await delay(5000, undefined, { signal: controller.signal }).catch(() => undefined);
        }
      }
    }
  } finally { await prisma.$disconnect(); }
}

main().catch(() => {
  console.error('PR analysis worker configuration invalid or database unavailable');
  process.exitCode = 1;
});
