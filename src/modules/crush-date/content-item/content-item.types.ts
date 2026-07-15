export const contentTypes = ['food', 'place'] as const;

export type ContentType = (typeof contentTypes)[number];

export interface CreateContentItemFields {
  contentType: ContentType;
  name: string;
  type: string;
  comment: string;
}

export interface CreateContentItemInput extends CreateContentItemFields {
  image: string;
}

export interface CreateContentItemWithImageInput extends CreateContentItemFields {
  buffer: Buffer;
  mimeType: string;
}

export interface ContentItemResponse extends CreateContentItemInput {
  id: string;
  visited: boolean;
  visitedAt: string | null;
}

export interface UpdateVisitedInput {
  visited: boolean;
}

export interface ListContentItemsQuery {
  page: number;
  pageSize: number;
}

export type ContentItemListItem = Omit<ContentItemResponse, 'contentType'>;

export interface ContentItemListResponse {
  list: ContentItemListItem[];
  total: number;
}
