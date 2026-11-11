import type { Express } from 'express';
import type { ApiModule } from './module';

const moduleLoaders: Record<string, () => ApiModule> = {
  'pr-change-log': () => {
    const { prChangeLogModule } = require('./pr-change-log/pr-change-log.module');
    return prChangeLogModule;
  },
  mianjing: () => {
    const { mianjingModule } = require('./mianjing/mianjing.module');
    return mianjingModule;
  },
  'crush-date': () => {
    const { crushDateModule } = require('./crush-date/crush-date.module');
    return crushDateModule;
  },
  'weekly-lab': () => {
    const { weeklyLabModule } = require('./weekly-lab/weekly-lab.module');
    return weeklyLabModule;
  },
};

function getEnabledModuleNames(): string[] {
  const configuredModules = process.env.APP_MODULES?.trim();
  if (!configuredModules || configuredModules === 'all') {
    return Object.keys(moduleLoaders);
  }

  const moduleNames = [...new Set(
    configuredModules
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
  )];

  const unknownModules = moduleNames.filter((name) => !moduleLoaders[name]);
  if (unknownModules.length > 0) {
    throw new Error(`Unknown APP_MODULES: ${unknownModules.join(', ')}`);
  }

  return moduleNames;
}

export function registerModules(app: Express): string[] {
  const moduleNames = getEnabledModuleNames();

  // Product modules reuse the existing account endpoints, registered exactly once.
  if (moduleNames.some((name) => ['mianjing', 'pr-change-log'].includes(name)) && !moduleNames.includes('weekly-lab')) {
    const authRoutes = require('./weekly-lab/auth/auth.routes').default;
    app.use('/api/auth', authRoutes);
  }

  for (const moduleName of moduleNames) {
    moduleLoaders[moduleName]().register(app);
  }

  return moduleNames;
}
