import type { Express } from 'express';
import type { ApiModule } from './module';

const moduleLoaders: Record<string, () => ApiModule> = {
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

  for (const moduleName of moduleNames) {
    moduleLoaders[moduleName]().register(app);
  }

  return moduleNames;
}
