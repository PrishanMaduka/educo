import { FlowProducer } from 'bullmq';

import type { FlowJob, FlowJobEntry } from 'bullmq';

/**
 * `FlowProducer.addBulk` that does not ignore a refused job. The jobs go to Redis in one `MULTI`,
 * so they are all applied or, if the transaction never runs (the connection drops first), none
 * are. But `MULTI` does not roll back a command that fails while it runs (a Lua error), and
 * `addBulk` drops the per-command `[error, id]` results. `addAll` reads them and throws when any
 * job was not added, so the caller fails instead of resolving with a job missing. The other
 * jobs of that transaction stay queued.
 */
export class CheckedFlowProducer extends FlowProducer {
  async addAll(flows: FlowJob[]): Promise<void> {
    await this.waitUntilReady();
    const entries: FlowJobEntry[] = [];
    await this.addNodes(entries, flows);
    // Typed as a list, but ioredis answers null for a transaction that did not run.
    const answered: unknown = await this.getBackend().addFlow(entries);
    const results: readonly unknown[] = Array.isArray(answered) ? answered : [];
    const refused = entries.filter((_entry, index) => {
      const result = results[index];
      return !Array.isArray(result) || result[0] !== null || typeof result[1] !== 'string';
    });
    if (results.length !== entries.length || refused.length > 0) {
      throw new Error(
        `Redis did not add every job: ${String(Math.max(refused.length, 1))} not added.`,
      );
    }
  }
}
