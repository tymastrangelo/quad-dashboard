"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// SWR-lite with a module-level cache: navigating away and back renders the
// cached data instantly, and the network is only hit again once the entry is
// older than staleMs (default 5 min) — keeps Supabase request volume down.
// Manual refresh() and refreshMs polling always fetch (and update the cache).
// ponytail: no cross-component subscription — each page uses distinct keys;
// add a subscriber set if two mounted components ever share a key.
type CacheEntry = { data: unknown; time: number };
const cache = new Map<string, CacheEntry>();
const DEFAULT_STALE_MS = 5 * 60_000;

export function useData<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts?: { refreshMs?: number; staleMs?: number }
) {
  const cached = cache.get(key);
  const [data, setData] = useState<T | undefined>(cached?.data as T | undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!cached); // no data yet
  const [refreshing, setRefreshing] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await fetcherRef.current();
      cache.set(key, { data: result, time: Date.now() });
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [key]);

  useEffect(() => {
    const entry = cache.get(key);
    if (entry) {
      setData(entry.data as T);
      setLoading(false);
      // Fresh enough — show as-is, no refetch, no reload flash.
      if (Date.now() - entry.time >= (opts?.staleMs ?? DEFAULT_STALE_MS)) void load();
    } else {
      setData(undefined);
      setLoading(true);
      void load();
    }
    if (opts?.refreshMs) {
      const id = setInterval(load, opts.refreshMs);
      return () => clearInterval(id);
    }
  }, [key, opts?.refreshMs, opts?.staleMs, load]);

  return { data, error, loading, refreshing, refresh: load };
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}
