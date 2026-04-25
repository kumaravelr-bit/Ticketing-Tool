const DEFAULT_TTL = 30 * 1000;

const responseCache = new Map();
const inFlightRequests = new Map();

const sortObject = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;

  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = sortObject(value[key]);
      return acc;
    }, {});
};

const buildCacheKey = (url, options = {}) => {
  const params = sortObject(options.params || {});
  return JSON.stringify({ url, params });
};

export const clearQueryCache = (matcher) => {
  if (!matcher) {
    responseCache.clear();
    inFlightRequests.clear();
    return;
  }

  for (const key of responseCache.keys()) {
    if (key.includes(matcher)) responseCache.delete(key);
  }

  for (const key of inFlightRequests.keys()) {
    if (key.includes(matcher)) inFlightRequests.delete(key);
  }
};

export const getCached = async (requester, url, options = {}) => {
  const {
    params,
    ttl = DEFAULT_TTL,
    force = false,
    skipCache = false,
    ...requestOptions
  } = options;

  if (skipCache) {
    return requester(url, { ...requestOptions, params });
  }

  const cacheKey = buildCacheKey(url, { params });
  const now = Date.now();
  const cached = responseCache.get(cacheKey);

  if (!force && cached && now - cached.timestamp < ttl) {
    return cached.value;
  }

  if (!force && inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const requestPromise = requester(url, { ...requestOptions, params })
    .then((response) => {
      responseCache.set(cacheKey, { value: response, timestamp: Date.now() });
      return response;
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, requestPromise);
  return requestPromise;
};

export const prefetchCached = (requester, url, options = {}) =>
  getCached(requester, url, options).catch(() => null);
