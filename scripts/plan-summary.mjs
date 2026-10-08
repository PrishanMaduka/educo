#!/usr/bin/env node
// Summarizes a Terraform plan for infra.yml (D28) without any attribute values:
//   terraform show -json tfplan | node scripts/plan-summary.mjs --title <markdown> [--drift]
// prints the add/change/destroy counts and each resource address with its action, as Markdown.
// The repository is public, so job logs and PR comments are world-readable: the full plan, which
// can show values, is never printed or uploaded (I1, Task 15 fix round).
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** @typedef {{ address?: unknown, change?: { actions?: unknown } }} ResourceChange */

const MAX_ROWS = 200;

/**
 * One word for a change's actions, as terraform shows it.
 * @param {unknown} actions
 * @returns {string}
 */
export function actionOf(actions) {
  const list = Array.isArray(actions) ? actions.map(String) : [];
  if (list.length === 2 && list.includes('create') && list.includes('delete')) return 'replace';
  return list[0] ?? 'no-op';
}

/** @param {string} address */
const cell = (address) => address.replace(/\|/g, '\\|').replace(/`/g, "'");

/**
 * @param {number} count
 * @param {string} noun
 */
const plural = (count, noun) => `${String(count)} ${noun}${count === 1 ? '' : 's'}`;

/**
 * Markdown for a plan (`resource_changes`) or, with `drift`, a refresh-only plan
 * (`resource_drift`): counts, then a table of addresses and actions. No-ops and reads are left out.
 * @param {Record<string, unknown>} plan `terraform show -json` output
 * @param {{ title: string, drift?: boolean }} options
 * @returns {string}
 */
export function summarizePlan(plan, options) {
  const source = options.drift === true ? plan.resource_drift : plan.resource_changes;
  /** @type {ResourceChange[]} */
  const entries = Array.isArray(source) ? source : [];
  const rows = entries
    .map((entry) => ({
      address: String(entry.address ?? ''),
      action: actionOf(entry.change?.actions),
    }))
    .filter((row) => row.action !== 'no-op' && row.action !== 'read');

  const count = (/** @type {string[]} */ actions) =>
    rows.filter((row) => actions.includes(row.action)).length;
  const headline =
    options.drift === true
      ? `**${plural(rows.length, 'resource')} changed outside Terraform.**`
      : `**${String(count(['create', 'replace']))} to add, ${String(count(['update']))} to change, ${String(count(['delete', 'replace']))} to destroy.**`;

  const lines = [`### ${options.title}`, ''];
  if (rows.length === 0) {
    lines.push('No changes.');
    return `${lines.join('\n')}\n`;
  }
  lines.push(headline, '', '| Action | Resource |', '| --- | --- |');
  for (const row of rows.slice(0, MAX_ROWS))
    lines.push(`| ${row.action} | \`${cell(row.address)}\` |`);
  if (rows.length > MAX_ROWS) lines.push('', `… and ${String(rows.length - MAX_ROWS)} more.`);
  return `${lines.join('\n')}\n`;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const titleIndex = args.indexOf('--title');
  const title = titleIndex === -1 ? undefined : args[titleIndex + 1];
  if (title === undefined || title === '') {
    process.stderr.write(
      'Usage: terraform show -json tfplan | node scripts/plan-summary.mjs --title <markdown> [--drift]\n',
    );
    process.exit(2);
  }
  const parsed = /** @type {unknown} */ (JSON.parse(readFileSync(0, 'utf8')));
  const plan = typeof parsed === 'object' && parsed !== null ? parsed : {};
  process.stdout.write(
    summarizePlan(/** @type {Record<string, unknown>} */ (plan), {
      title,
      drift: args.includes('--drift'),
    }),
  );
}
