import type {
  CityCode,
  FoodCategoryFilterId,
  FoodCategoryId,
  PlaceCategoryFilterId,
  PlaceCategoryId,
} from './content-item.config';

export const contentTypes = ['food', 'place'] as const;

export type ContentType = (typeof contentTypes)[number];

export interface ContentLocation {
  provider: 'tencent';
  poiId: string;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  adcode: string;
}

export interface CreateContentLocationFields {
  poiProvider?: 'tencent';
  poiId?: string;
  poiTitle?: string;
  poiAddress?: string;
  poiLatitude?: number;
  poiLongitude?: number;
  poiAdcode?: string;
}

interface CreateContentItemBaseFields {
  cityCode: CityCode;
  name: string;
  type: string;
  comment: string;
}

export type CreateContentItemFields = CreateContentItemBaseFields
& CreateContentLocationFields & (
  | { contentType: 'food'; categoryId: FoodCategoryId }
  | { contentType: 'place'; categoryId: PlaceCategoryId }
);

export type CreateContentItemInput = CreateContentItemFields & {
  image: string;
};

export type CreateContentItemWithImageInput = CreateContentItemFields & {
  buffer: Buffer;
  mimeType: string;
};

export interface ContentItemResponse extends CreateContentItemBaseFields {
  id: string;
  contentType: ContentType;
  categoryId: FoodCategoryId | PlaceCategoryId;
  image: string;
  visited: boolean;
  visitedAt: string | null;
  location: ContentLocation | null;
}

export interface UpdateVisitedInput {
  visited: boolean;
}

export interface UpdateLocationInput {
  location: ContentLocation | null;
}

export interface ListContentItemsQuery {
  cityCode?: CityCode;
  visited?: boolean;
  categoryId?: FoodCategoryFilterId | PlaceCategoryFilterId;
  keyword?: string;
  page: number;
  pageSize: number;
}

export type ContentItemListItem = ContentItemResponse;

export interface ContentItemListResponse {
  list: ContentItemListItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
