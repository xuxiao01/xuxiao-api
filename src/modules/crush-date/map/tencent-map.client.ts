import { crushDateConfig } from '../crush-date.config';
import { AppError } from '../../../utils/app-error';

interface TencentPoiItem {
  id?: unknown;
  title?: unknown;
  address?: unknown;
  location?: {
    lat?: unknown;
    lng?: unknown;
  };
  adcode?: unknown;
  city?: unknown;
  district?: unknown;
  ad_info?: {
    adcode?: unknown;
    city?: unknown;
    district?: unknown;
  };
}

interface TencentSuggestionResponse {
  status?: unknown;
  data?: unknown;
}

export async function requestTencentPoiSuggestions(
  region: string,
  keyword: string,
): Promise<TencentPoiItem[]> {
  if (!crushDateConfig.TENCENT_MAP_WEB_SERVICE_KEY) {
    throw new AppError(503, '腾讯地图搜索服务未配置');
  }

  const url = new URL(
    '/ws/place/v1/suggestion',
    crushDateConfig.TENCENT_MAP_API_BASE_URL,
  );
  url.searchParams.set('key', crushDateConfig.TENCENT_MAP_WEB_SERVICE_KEY);
  url.searchParams.set('keyword', keyword);
  url.searchParams.set('region', region);
  url.searchParams.set('region_fix', '1');
  url.searchParams.set('page_size', '10');
  url.searchParams.set('output', 'json');

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    crushDateConfig.TENCENT_MAP_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new AppError(502, '腾讯地图搜索服务异常');
    }

    let body: TencentSuggestionResponse;
    try {
      body = await response.json() as TencentSuggestionResponse;
    } catch {
      throw new AppError(502, '腾讯地图搜索服务响应异常');
    }

    if (body.status !== 0 || !Array.isArray(body.data)) {
      throw new AppError(502, '腾讯地图搜索服务异常');
    }

    return body.data as TencentPoiItem[];
  } catch (error) {
    if (controller.signal.aborted) {
      throw new AppError(504, '腾讯地图搜索服务超时');
    }
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(502, '腾讯地图搜索服务异常');
  } finally {
    clearTimeout(timeout);
  }
}
