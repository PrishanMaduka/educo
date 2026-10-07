'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { transition } from '../lib/motion';

const MAX_VISIBLE = 2;
const DURATION_MS = 2800;

interface ToastItem {
  id: number;
  message: string;
}

export interface ToastApi {
  /** Confirms what happened, for example "Fee plan saved". */
  show: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export interface ToastProviderProps {
  children: ReactNode;
  /** Accessible name of the live region. */
  label?: string;
  durationMs?: number;
}

export function ToastProvider({
  children,
  label = 'Notifications',
  durationMs = DURATION_MS,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // The list lives in a ref as well, so state updates stay pure and timers can be cleared when a toast is evicted.
  const current = useRef<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const show = useCallback(
    (message: string) => {
      nextId.current += 1;
      const id = nextId.current;
      const next = [...current.current, { id, message }];
      const kept = next.slice(-MAX_VISIBLE);
      for (const dropped of next.slice(0, next.length - kept.length)) {
        clearTimeout(timers.current.get(dropped.id));
        timers.current.delete(dropped.id);
      }
      current.current = kept;
      setToasts(kept);
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          current.current = current.current.filter((t) => t.id !== id);
          setToasts(current.current);
        }, durationMs),
      );
    },
    [durationMs],
  );

  const api = useMemo<ToastApi>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <section
        aria-label={label}
        aria-live="polite"
        className="pointer-events-none fixed bottom-5 left-1/2 z-[120] flex -translate-x-1/2 flex-col items-center gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`max-w-[min(520px,calc(100vw-32px))] rounded-[10px] bg-ink px-4 py-2.5 text-[13px] font-semibold text-surface shadow-lg starting:translate-y-2 starting:opacity-0 ${transition}`}
          >
            {toast.message}
          </div>
        ))}
      </section>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside a ToastProvider');
  return api;
}
