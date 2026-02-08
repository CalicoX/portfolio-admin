import { createClient } from 'contentful';

// 缓存存储键名前缀
const CACHE_KEY_PREFIX = 'cf_cache_';
const ETAG_KEY_PREFIX = 'cf_etag_';
const TIMESTAMP_KEY_PREFIX = 'cf_ts_';

// 缓存条目接口
interface CacheEntry<T> {
  data: T;
  etag: string | null;
  timestamp: number;
}

// 获取缓存键
const getCacheKey = (contentType: string, queryKey: string = ''): string => {
  return `${CACHE_KEY_PREFIX}${contentType}${queryKey ? '_' + queryKey : ''}`;
};

const getEtagKey = (contentType: string, queryKey: string = ''): string => {
  return `${ETAG_KEY_PREFIX}${contentType}${queryKey ? '_' + queryKey : ''}`;
};

const getTimestampKey = (contentType: string, queryKey: string = ''): string => {
  return `${TIMESTAMP_KEY_PREFIX}${contentType}${queryKey ? '_' + queryKey : ''}`;
};

// 从 localStorage 读取缓存
const getCachedData = <T>(contentType: string, queryKey: string = ''): CacheEntry<T> | null => {
  try {
    const cacheKey = getCacheKey(contentType, queryKey);
    const etagKey = getEtagKey(contentType, queryKey);
    const timestampKey = getTimestampKey(contentType, queryKey);

    const cached = localStorage.getItem(cacheKey);
    const etag = localStorage.getItem(etagKey);
    const timestamp = localStorage.getItem(timestampKey);

    if (!cached || !timestamp) return null;

    return {
      data: JSON.parse(cached) as T,
      etag,
      timestamp: parseInt(timestamp, 10),
    };
  } catch {
    return null;
  }
};

// 保存数据到缓存
const setCachedData = <T>(
  contentType: string,
  data: T,
  etag: string | null,
  queryKey: string = ''
): void => {
  try {
    const cacheKey = getCacheKey(contentType, queryKey);
    const etagKey = getEtagKey(contentType, queryKey);
    const timestampKey = getTimestampKey(contentType, queryKey);

    localStorage.setItem(cacheKey, JSON.stringify(data));
    if (etag) {
      localStorage.setItem(etagKey, etag);
    }
    localStorage.setItem(timestampKey, Date.now().toString());
  } catch (error) {
    console.warn('Failed to cache data:', error);
  }
};

// 清除特定内容的缓存
export const clearContentfulCache = (contentType: string, queryKey: string = ''): void => {
  try {
    const cacheKey = getCacheKey(contentType, queryKey);
    const etagKey = getEtagKey(contentType, queryKey);
    const timestampKey = getTimestampKey(contentType, queryKey);

    localStorage.removeItem(cacheKey);
    localStorage.removeItem(etagKey);
    localStorage.removeItem(timestampKey);
  } catch (error) {
    console.warn('Failed to clear cache:', error);
  }
};

// 清除所有 Contentful 缓存
export const clearAllContentfulCache = (): void => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(CACHE_KEY_PREFIX) ||
          key.startsWith(ETAG_KEY_PREFIX) ||
          key.startsWith(TIMESTAMP_KEY_PREFIX))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Failed to clear all cache:', error);
  }
};

// 获取缓存统计信息
export const getCacheStats = (): { contentType: string; age: number }[] => {
  const stats: { contentType: string; age: number }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(TIMESTAMP_KEY_PREFIX)) {
        const timestamp = localStorage.getItem(key);
        if (timestamp) {
          const contentType = key.replace(TIMESTAMP_KEY_PREFIX, '');
          const age = Date.now() - parseInt(timestamp, 10);
          stats.push({ contentType, age });
        }
      }
    }
  } catch {
    // ignore
  }
  return stats;
};

// 配置选项
interface FetchWithCacheOptions {
  contentType: string;
  queryKey?: string;
  maxAge?: number; // 最大缓存时间（毫秒），默认 5 分钟
  skipCache?: boolean; // 是否跳过缓存强制刷新
}

// 创建带有 ETag 支持的 Contentful 客户端
const createCachedClient = () => {
  return createClient({
    space: import.meta.env.VITE_CONTENTFUL_SPACE_ID || '',
    accessToken: import.meta.env.VITE_CONTENTFUL_ACCESS_TOKEN || '',
  });
};

// 带缓存的获取函数
export async function fetchWithCache<T>(
  fetcher: () => Promise<{ items: T[]; sys?: { type: string } }>,
  options: FetchWithCacheOptions
): Promise<T[]> {
  const { contentType, queryKey = '', maxAge = 5 * 60 * 1000, skipCache = false } = options;

  // 如果不跳过缓存，先尝试读取缓存
  if (!skipCache) {
    const cached = getCachedData<T[]>(contentType, queryKey);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      // 如果缓存未过期，直接返回缓存数据
      if (age < maxAge) {
        console.log(`[Cache] Hit: ${contentType}${queryKey ? ` (${queryKey})` : ''} (${Math.round(age / 1000)}s old)`);
        return cached.data;
      }
    }
  }

  // 执行实际请求
  try {
    console.log(`[Cache] Fetch: ${contentType}${queryKey ? ` (${queryKey})` : ''}`);
    const response = await fetcher();

    // 提取 ETag（如果存在）
    // 注意：Contentful JS SDK 不直接暴露 ETag，我们需要使用原始 HTTP 请求
    // 这里我们使用时间戳作为替代方案

    // 保存到缓存
    setCachedData(contentType, response.items, null, queryKey);

    return response.items;
  } catch (error) {
    console.error(`[Cache] Error fetching ${contentType}:`, error);

    // 如果请求失败，尝试返回过期缓存（作为降级方案）
    const cached = getCachedData<T[]>(contentType, queryKey);
    if (cached) {
      console.log(`[Cache] Fallback to stale cache for ${contentType}`);
      return cached.data;
    }

    throw error;
  }
}

// 获取单个条目的缓存版本
export async function fetchSingleWithCache<T>(
  fetcher: () => Promise<T>,
  options: FetchWithCacheOptions
): Promise<T | null> {
  const { contentType, queryKey = '', maxAge = 5 * 60 * 1000, skipCache = false } = options;

  // 如果不跳过缓存，先尝试读取缓存
  if (!skipCache) {
    const cached = getCachedData<T>(contentType, queryKey);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      // 如果缓存未过期，直接返回缓存数据
      if (age < maxAge) {
        console.log(`[Cache] Hit: ${contentType}${queryKey ? ` (${queryKey})` : ''} (${Math.round(age / 1000)}s old)`);
        return cached.data;
      }
    }
  }

  // 执行实际请求
  try {
    console.log(`[Cache] Fetch: ${contentType}${queryKey ? ` (${queryKey})` : ''}`);
    const response = await fetcher();

    if (!response) return null;

    // 保存到缓存
    setCachedData(contentType, response, null, queryKey);

    return response;
  } catch (error) {
    console.error(`[Cache] Error fetching ${contentType}:`, error);

    // 如果请求失败，尝试返回过期缓存（作为降级方案）
    const cached = getCachedData<T>(contentType, queryKey);
    if (cached) {
      console.log(`[Cache] Fallback to stale cache for ${contentType}`);
      return cached.data;
    }

    return null;
  }
}
