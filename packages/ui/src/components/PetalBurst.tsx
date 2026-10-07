'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

const PETAL_COUNT = 28;
/** A little longer than the 1.9 s petal animation, so nothing is cut off. */
const CLEANUP_MS = 2300;
const COLOURS = ['bg-c1', 'bg-c2', 'bg-c3', 'bg-c5'] as const;

export interface PetalOrigin {
  /** Pixels from the left edge of the window. */
  x: number;
  /** Pixels from the top edge of the window. */
  y: number;
}

interface Petal {
  key: number;
  colour: (typeof COLOURS)[number];
  x: number;
  y: number;
  dx: number;
  rotate: number;
}

interface Burst {
  id: number;
  petals: Petal[];
}

export interface PetalBurstApi {
  /** Scatters petals for a good moment. From `origin` when given, otherwise across the top of the window. */
  burst: (origin?: PetalOrigin) => void;
}

const PetalBurstContext = createContext<PetalBurstApi | null>(null);

function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

function makePetals(origin: PetalOrigin | undefined): Petal[] {
  return Array.from({ length: PETAL_COUNT }, (_, key) => {
    const spread = Math.random() * 2 - 1;
    return {
      key,
      colour: COLOURS[key % COLOURS.length] ?? 'bg-c1',
      x: origin ? origin.x + spread * 24 : Math.random() * window.innerWidth,
      y: origin ? origin.y : -20,
      dx: Math.round(spread * (origin ? 220 : 120)),
      rotate: Math.round((Math.random() * 2 - 1) * 540),
    };
  });
}

export interface PetalBurstProviderProps {
  children: ReactNode;
}

/** Hosts the petal layer. Wrap the app once, then call `usePetalBurst().burst()` when something good happens. */
export function PetalBurstProvider({ children }: PetalBurstProviderProps) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const burst = useCallback((origin?: PetalOrigin) => {
    if (reducedMotion()) return;
    nextId.current += 1;
    const id = nextId.current;
    setBursts((all) => [...all, { id, petals: makePetals(origin) }]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setBursts((all) => all.filter((b) => b.id !== id));
    }, CLEANUP_MS);
    timers.current.add(timer);
  }, []);

  const api = useMemo<PetalBurstApi>(() => ({ burst }), [burst]);

  return (
    <PetalBurstContext.Provider value={api}>
      {children}
      {bursts.length > 0 ? (
        <div
          data-petals=""
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[200] overflow-hidden"
        >
          {bursts.flatMap((b) =>
            b.petals.map((p) => (
              <i
                key={`${b.id}-${p.key}`}
                data-petal=""
                className={`quad-petal absolute top-(--y) left-(--x) block h-3.5 w-2.5 rounded-[60%_0_60%_0] ${p.colour}`}
                style={
                  {
                    '--x': `${p.x}px`,
                    '--y': `${p.y}px`,
                    '--dx': `${p.dx}px`,
                    '--r': `${p.rotate}deg`,
                  } as CSSProperties
                }
              />
            )),
          )}
        </div>
      ) : null}
    </PetalBurstContext.Provider>
  );
}

export function usePetalBurst(): PetalBurstApi {
  const api = useContext(PetalBurstContext);
  if (!api) throw new Error('usePetalBurst must be used inside a PetalBurstProvider');
  return api;
}
