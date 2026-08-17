import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../crush-date.config', () => ({
  crushDateConfig: {
    TENCENT_MAP_WEB_SERVICE_KEY: 'test-key-that-must-not-leak',
    TENCENT_MAP_API_BASE_URL: 'https://apis.map.qq.com',
    TENCENT_MAP_TIMEOUT_MS: 1000,
  },
}));

import { requestTencentPoiSuggestions } from './tencent-map.client';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('requestTencentPoiSuggestions', () => {
  it('安全编码参数并返回腾讯数据', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ status: 0, data: [{ id: 'poi-1' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestTencentPoiSuggestions('北京市', '海底捞 国贸')).resolves.toEqual([
      { id: 'poi-1' },
    ]);
    const requestedUrl = fetchMock.mock.calls[0][0] as URL;
    expect(requestedUrl.searchParams.get('region')).toBe('北京市');
    expect(requestedUrl.searchParams.get('keyword')).toBe('海底捞 国贸');
    expect(requestedUrl.searchParams.get('region_fix')).toBe('1');
    expect(requestedUrl.searchParams.get('page_size')).toBe('10');
  });

  it('将腾讯业务错误转换为不泄露 Key 的 502', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ status: 110, message: 'invalid key' }),
    }));

    const error = await requestTencentPoiSuggestions('北京市', '海底捞')
      .catch((caught) => caught);
    expect(error).toMatchObject({ statusCode: 502 });
    expect(error.message).not.toContain('test-key-that-must-not-leak');
  });

  it('超时返回 504', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_, init: RequestInit) => (
      new Promise((_, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })
    )));

    const request = requestTencentPoiSuggestions('北京市', '海底捞');
    const assertion = expect(request).rejects.toMatchObject({ statusCode: 504 });
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });
});
