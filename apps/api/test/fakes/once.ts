import type { OnceStore } from '../../src/worker/jobs/once';

/** An in-memory `OnceStore`, for processor tests that run without Redis. */
export class MemoryOnce implements OnceStore {
  readonly done = new Set<string>();

  isDone(key: string): Promise<boolean> {
    return Promise.resolve(this.done.has(key));
  }

  markDone(key: string): Promise<void> {
    this.done.add(key);
    return Promise.resolve();
  }
}
