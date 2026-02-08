// Contentful Management API 缓存系统
// Management API 调用较慢（需要 getSpace -> getEnvironment -> getEntries），需要缓存优化

const MGMT_CACHE_PREFIX = 'cf_mgmt_';
const MGMT_CACHE_TTL = 2 * 60 * 1000; // 2 分钟缓存（管理端数据变化更频繁，缓存时间较短）

interface MgmtCacheEntry<T> {
  data: T;
  timestamp: number;
}

const getCacheKey = (contentType: string, queryKey: string = ''): string => {
  return `${MGMT_CACHE_PREFIX}${contentType}${queryKey ? '_' + queryKey : ''}`;
};

// 读取缓存
const getCachedData = <T>(contentType: string, queryKey: string = ''): T | null => {
  try {
    const key = getCacheKey(contentType, queryKey);
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const entry: MgmtCacheEntry<T> = JSON.parse(cached);
    const age = Date.now() - entry.timestamp;

    // 如果缓存未过期，返回数据
    if (age < MGMT_CACHE_TTL) {
      console.log(`[MgmtCache] Hit: ${contentType}${queryKey ? ` (${queryKey})` : ''} (${Math.round(age / 1000)}s old)`);
      return entry.data;
    }

    // 缓存已过期
    return null;
  } catch {
    return null;
  }
};

// 保存缓存
const setCachedData = <T>(contentType: string, data: T, queryKey: string = ''): void => {
  try {
    const key = getCacheKey(contentType, queryKey);
    const entry: MgmtCacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    console.warn('[MgmtCache] Failed to cache:', error);
  }
};

// 清除特定缓存
export const clearMgmtCache = (contentType: string, queryKey: string = ''): void => {
  try {
    const key = getCacheKey(contentType, queryKey);
    localStorage.removeItem(key);
    console.log(`[MgmtCache] Cleared: ${contentType}${queryKey ? ` (${queryKey})` : ''}`);
  } catch {
    // ignore
  }
};

// 清除所有 Management API 缓存
export const clearAllMgmtCache = (): void => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(MGMT_CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log('[MgmtCache] All cache cleared');
  } catch {
    // ignore
  }
};

// 带缓存的获取函数
export async function fetchWithMgmtCache<T>(
  fetcher: () => Promise<T>,
  contentType: string,
  options: { queryKey?: string; skipCache?: boolean } = {}
): Promise<T> {
  const { queryKey = '', skipCache = false } = options;

  // 尝试读取缓存
  if (!skipCache) {
    const cached = getCachedData<T>(contentType, queryKey);
    if (cached !== null) {
      return cached;
    }
  }

  // 执行请求
  console.log(`[MgmtCache] Fetch: ${contentType}${queryKey ? ` (${queryKey})` : ''}`);
  const startTime = performance.now();
  const data = await fetcher();
  const duration = Math.round(performance.now() - startTime);
  console.log(`[MgmtCache] Fetched in ${duration}ms: ${contentType}`);

  // 保存缓存
  setCachedData(contentType, data, queryKey);

  return data;
}

// 乐观更新：先更新缓存，再执行请求
export async function optimisticUpdate<T>(
  updater: () => Promise<T>,
  contentType: string,
  getOptimisticData: () => T,
  queryKey: string = ''
): Promise<T> {
  // 先更新缓存为乐观数据
  const optimisticData = getOptimisticData();
  setCachedData(contentType, optimisticData, queryKey);

  try {
    // 执行实际请求
    const result = await updater();
    // 用真实结果更新缓存
    setCachedData(contentType, result, queryKey);
    // 清除相关列表缓存
    clearMgmtCache(contentType);
    return result;
  } catch (error) {
    // 请求失败，清除缓存（避免脏数据）
    clearMgmtCache(contentType, queryKey);
    throw error;
  }
}

// 在数据变更后清除相关缓存
export const invalidateMgmtCache = (contentType: string): void => {
  clearMgmtCache(contentType);
  // 同时清除 Delivery API 缓存
  try {
    const deliveryKey = `cf_cache_${contentType}`;
    localStorage.removeItem(deliveryKey);
    const deliveryTsKey = `cf_ts_${contentType}`;
    localStorage.removeItem(deliveryTsKey);
  } catch {
    // ignore
  }
};
