/** The parts of a BullMQ job that say whether it will run again. */
export interface RetryableJob {
  readonly attemptsMade: number;
  readonly opts: { readonly attempts?: number };
}

/**
 * Whether a failed job has used its last attempt, so its failure is worth reporting. BullMQ
 * counts the failed attempt before it emits `failed`, and never retries an `UnrecoverableError`.
 * A failure without a job (BullMQ could not load it) is final too.
 */
export function isFinalAttempt(job: RetryableJob | undefined, error: Error): boolean {
  if (job === undefined || error.name === 'UnrecoverableError') return true;
  return job.attemptsMade >= (job.opts.attempts ?? 1);
}
