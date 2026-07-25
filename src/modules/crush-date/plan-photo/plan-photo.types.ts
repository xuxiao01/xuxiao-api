export interface CreatePlanPhotoInput {
  buffer: Buffer;
  mimeType: string;
}

export interface PlanPhotoResponse {
  id: string;
  url: string;
  sortOrder: number;
  createdAt: string;
}

export interface PlanPhotoListResponse {
  list: PlanPhotoResponse[];
}

export interface ReorderPlanPhotosInput {
  photoIds: string[];
}
