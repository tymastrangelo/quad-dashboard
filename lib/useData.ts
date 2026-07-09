"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// SWR-lite: keeps stale data visible while revalidating, optional polling.
export function useData<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts?: { refreshMs?: number }
) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // no data yet
  const [refreshing, setRefreshing] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
    if (opts?.refreshMs) {
      const id = setInterval(load, opts.refreshMs);
      return () => clearInterval(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, opts?.refreshMs]);

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
