import { cityTencentRegions } from '../content-item/content-item.config';
import { crushDateConfig } from '../crush-date.config';
import { requestTencentPoiSuggestions } from './tencent-map.client';
import type {
  PoiSuggestion,
  PoiSuggestionsQuery,
  PoiSuggestionsResponse,
} from './map.types';

interface CacheEntry {
  expiresAt: number;
  value: PoiSuggestionsResponse;
}

const MAX_CACHE_ENTRIES = 500;
const cache = new Map<string, CacheEntry>();

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function setCache(key: string, value: PoiSuggestionsResponse): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  cache.set(key, {
    expiresAt: Date.now() + crushDateConfig.TENCENT_MAP_CACHE_TTL_SECONDS * 1000,
    value,
  });
}

export function clearPoiSuggestionsCache(): void {
  cache.clear();
}

export async function listPoiSuggestions(
  query: PoiSuggestionsQuery,
): Promise<PoiSuggestionsResponse> {
  const normalizedKeyword = query.keyword.trim();
  const cacheKey = `${query.cityCode}:${normalizedKeyword.toLocaleLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  if (cached) {
    cache.delete(cacheKey);
  }

  const items = await requestTencentPoiSuggestions(
    cityTencentRegions[query.cityCode],
    normalizedKeyword,
  );
  const list = items
    .map((item): PoiSuggestion | null => {
      const poiId = normalizeString(item.id);
      const title = normalizeString(item.title);
      const address = normalizeString(item.address);
      const latitude = normalizeNumber(item.location?.lat);
      const longitude = normalizeNumber(item.location?.lng);
      const rawAdcode = item.adcode ?? item.ad_info?.adcode;
      const adcode = rawAdcode === undefined
        ? ''
        : String(rawAdcode).trim();

      if (
        !poiId
        || !title
        || !address
        || latitude === null
        || latitude < -90
        || latitude > 90
        || longitude === null
        || longitude < -180
        || longitude > 180
        || !adcode
      ) {
        return null;
      }

      return {
        provider: 'tencent',
        poiId,
        title,
        address,
        latitude,
        longitude,
        adcode,
        city: normalizeString(item.city ?? item.ad_info?.city),
        district: normalizeString(item.district ?? item.ad_info?.district),
      };
    })
    .filter((item): item is PoiSuggestion => item !== null)
    .slice(0, 10);
  const result = { list };
  setCache(cacheKey, result);
  return result;
}
