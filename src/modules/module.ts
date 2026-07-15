import type { Express } from 'express';

export interface ApiModule {
  register(app: Express): void;
}
