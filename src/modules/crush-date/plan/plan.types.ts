export const planStatuses = ['active', 'backup', 'completed'] as const;
export const creatablePlanStatuses = ['active', 'backup'] as const;
export const planScenarios = ['hot', 'cold', 'rainy', 'sunny', 'free'] as const;
export const planPeriods = ['morning', 'noon', 'afternoon', 'evening'] as const;

export type PlanStatus = (typeof planStatuses)[number];
export type CreatablePlanStatus = (typeof creatablePlanStatuses)[number];
export type PlanScenario = (typeof planScenarios)[number];
export type PlanPeriod = (typeof planPeriods)[number];
export type PlanItemType = 'food' | 'place';

export interface CreatePlanItemInput {
  type: PlanItemType;
  sourceId: string;
  period: PlanPeriod;
  note: string;
  order: number;
}

export interface UpdatePlanItemInput extends CreatePlanItemInput {
  id?: string;
}

export interface CreatePlanInput {
  title: string;
  status: CreatablePlanStatus;
  date: string | null;
  scenario: PlanScenario;
  scenarioText: string;
  note: string;
  items: CreatePlanItemInput[];
}

export interface UpdatePlanInput {
  title?: string;
  date?: string | null;
  scenario?: PlanScenario;
  scenarioText?: string;
  note?: string;
  items?: UpdatePlanItemInput[];
}

export type UpdatePlanStatusInput =
  | {
    status: 'active';
    date: string;
  }
  | {
    status: 'completed';
  }
  | {
    status: 'backup';
  };

export interface ReplanPlanInput {
  date: string;
}

export interface PlanItemResponse extends CreatePlanItemInput {
  id: string;
  title: string;
  image: string;
}

export interface PlanResponse {
  id: string;
  title: string;
  status: PlanStatus;
  date: string | null;
  scenario: PlanScenario;
  scenarioText: string;
  note: string;
  items: PlanItemResponse[];
  sourceBackupId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanListResponse {
  activePlan: PlanResponse | null;
  backupPlans: PlanResponse[];
  completedPlans: PlanResponse[];
}
