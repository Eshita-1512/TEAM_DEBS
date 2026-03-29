import { useState, useEffect, useRef, useCallback } from 'react';

const DEFAULT_POLL_INTERVAL = 15000;

interface UsePollingOptions<T> {
  fetcher: () => Promise<T>;
  interval?: number;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: unknown) => void;
}

interface UsePollingResult<T> {
  data: T | null;
  loading: boolean;
  error: unknown;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
}

export function usePolling<T>({
  fetcher,
  interval = DEFAULT_POLL_INTERVAL,
  enabled = true,
  onSuccess,
  onError,
}: UsePollingOptions<T>): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlightRef = useRef(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const doFetch = useCallback(async (isInitial = false) => {
    if (inFlightRef.current) return;

    if (isInitial) setLoading(true);
    inFlightRef.current = true;
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
      setLastUpdated(new Date());
      onSuccessRef.current?.(result);
    } catch (err) {
      setError(err);
      onErrorRef.current?.(err);
    } finally {
      inFlightRef.current = false;
      if (isInitial) setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await doFetch(false);
  }, [doFetch]);

  useEffect(() => {
    if (!enabled) return;

    doFetch(true);

    intervalRef.current = setInterval(() => {
      doFetch(false);
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, interval, doFetch]);

  return { data, loading, error, refresh, lastUpdated };
}
