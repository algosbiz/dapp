"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface TxState {
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  error: Error | null | undefined;
  reset?: () => void;
}

/**
 * Wraps a wagmi write-contract action with a toast lifecycle (wallet confirm -> on-chain
 * confirm -> success/error) and tracks which specific action is currently in flight, so a
 * panel with several buttons sharing one useWriteContract instance can show a spinner on
 * only the button the user actually clicked, not all of them.
 */
export function useTransactionToast({ isPending, isConfirming, isConfirmed, error, reset }: TxState) {
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const toastId = useRef<string | number | undefined>(undefined);
  const labelRef = useRef<string | null>(null);
  const prevPending = useRef(false);

  /** Call instead of invoking the write action directly: `run("Stake", () => stake(amount))`. */
  const run = (label: string, action: () => void) => {
    labelRef.current = label;
    setActiveLabel(label);
    action();
  };

  useEffect(() => {
    if (isPending && !prevPending.current) {
      toastId.current = toast.loading(`${labelRef.current ?? "Transaction"} — confirm in your wallet…`);
    }
    prevPending.current = isPending;
  }, [isPending]);

  useEffect(() => {
    if (isConfirming && toastId.current !== undefined) {
      toast.loading(`${labelRef.current ?? "Transaction"} — waiting for confirmation…`, {
        id: toastId.current,
      });
    }
  }, [isConfirming]);

  useEffect(() => {
    if (isConfirmed) {
      if (toastId.current !== undefined) {
        toast.success(`${labelRef.current ?? "Transaction"} confirmed`, { id: toastId.current });
      }
      toastId.current = undefined;
      labelRef.current = null;
      setActiveLabel(null);
      reset?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed]);

  useEffect(() => {
    if (error) {
      const raw = error.message || "Transaction failed";
      const message = raw.length > 140 ? `${raw.slice(0, 140)}…` : raw;
      if (toastId.current !== undefined) {
        toast.error(message, { id: toastId.current });
      } else {
        toast.error(message);
      }
      toastId.current = undefined;
      labelRef.current = null;
      setActiveLabel(null);
      reset?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  return { run, activeLabel };
}
