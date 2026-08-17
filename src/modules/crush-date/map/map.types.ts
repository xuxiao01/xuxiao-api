import type { CityCode } from '../content-item/content-item.config';

export interface PoiSuggestionsQuery {
  cityCode: CityCode;
  keyword: string;
}

export interface PoiSuggestion {
  provider: 'tencent';
  poiId: string;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  adcode: string;
  city: string;
  district: string;
}

export interface PoiSuggestionsResponse {
  list: PoiSuggestion[];
}
