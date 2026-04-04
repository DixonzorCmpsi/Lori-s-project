import { useState, useEffect, useCallback, useRef } from 'react';

interface UseApiResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  refetch: () => void;
}

// Simple in-memory cache — keyed by serialized deps, cleared on refetch
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL_MS = 30_000; // 30 seconds

export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
): UseApiResult<T> {
  const cacheKey = JSON.stringify(deps);
  const cached = cache.get(cacheKey);
  const isFresh = !!(cached && Date.now() - cached.ts < CACHE_TTL_MS);

  const [data, setData] = useState<T | null>(isFresh ? (cached!.data as T) : null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(!isFresh);
  const [trigger, setTrigger] = useState(0);
  const forceRefetch = useRef(false);

  const refetch = useCallback(() => {
    cache.delete(cacheKey);
    forceRefetch.current = true;
    setTrigger(t => t + 1);
  }, [cacheKey]);

  useEffect(() => {
    const key = cacheKey;
    const hit = cache.get(key);
    const fresh = !!(hit && Date.now() - hit.ts < CACHE_TTL_MS);

    if (fresh && !forceRefetch.current) {
      setData(hit!.data as T);
      setIsLoading(false);
      return;
    }
    forceRefetch.current = false;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetcher()
      .then(result => {
        if (!cancelled) {
          cache.set(key, { data: result, ts: Date.now() });
          setData(result);
        }
      })
      .catch(err => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, ...deps]);

  return { data, error, isLoading, refetch };
}
