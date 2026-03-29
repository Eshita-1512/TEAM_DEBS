import { useEffect, useRef, useState, useCallback } from 'react';
import { receipts } from '@/api/client';
import type { OcrResult } from '@/types/api';

const OCR_POLL_INTERVAL = 3000; // 3 seconds

interface UseOcrPollingOptions {
  receiptId: string | null;
  enabled?: boolean;
  onCompleted?: (result: OcrResult) => void;
  onFailed?: () => void;
}

interface UseOcrPollingResult {
  ocrResult: OcrResult | null;
  isPolling: boolean;
  error: unknown;
}

export function useOcrPolling({
  receiptId,
  enabled = true,
  onCompleted,
  onFailed,
}: UseOcrPollingOptions): UseOcrPollingResult {
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompletedRef = useRef(onCompleted);
  const onFailedRef = useRef(onFailed);

  useEffect(() => {
    onCompletedRef.current = onCompleted;
  }, [onCompleted]);

  useEffect(() => {
    onFailedRef.current = onFailed;
  }, [onFailed]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!receiptId || !enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const res = await receipts.getOcr(receiptId);
        const result = res.data;
        setOcrResult(result);

        if (result.status === 'completed') {
          stopPolling();
          onCompletedRef.current?.(result);
        } else if (result.status === 'failed') {
          stopPolling();
          onFailedRef.current?.();
        }
      } catch (err) {
        setError(err);
        // Keep polling on transient errors
      }
    };

    // Initial fetch
    poll();

    // Start interval
    intervalRef.current = setInterval(poll, OCR_POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [receiptId, enabled, stopPolling]);

  const isPolling = Boolean(receiptId && enabled && ocrResult?.status !== 'completed' && ocrResult?.status !== 'failed');

  return { ocrResult, isPolling, error };
}
