#!/usr/bin/env node
// Decides whether deploy-staging.yml deploys (its `gate` job, D28):
//   node scripts/deploy-gate.mjs   (reads the environment below, writes deploy=true|false to
//                                   $GITHUB_OUTPUT, and exits 0 either way)
// It deploys only the current tip of main, so a slow or re-run workflow for an older commit never
// rolls staging back over a newer one, and only:
//   - after CI succeeded on a push to main of this repository (workflow_run), or
//   - by hand from main (workflow_dispatch) when CI has succeeded on a push of that commit.
// Environment: EVENT_NAME, REF, REPOSITORY, DEPLOY_SHA and, for workflow_run, RUN_CONCLUSION,
// RUN_EVENT, RUN_HEAD_REPOSITORY and RUN_HEAD_BRANCH; `gh` uses GH_TOKEN.
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * @typedef {{ conclusion: string, event: string, headRepository: string, headBranch: string }} TriggeringRun
 * @typedef {{ event: string, ref: string, repository: string, sha: string, run: TriggeringRun | undefined }} GateInput
 * @typedef {GateInput & { mainTip: string, ciPassed: boolean }} GateFacts
 * @typedef {(args: string[]) => { status: number | null, stdout: string, stderr?: string }} Gh
 */

const MAIN = 'main';

/**
 * Whether to deploy, and why.
 * @param {GateFacts} facts
 * @returns {{ deploy: boolean, reason: string }}
 */
export function deployDecision(facts) {
  const skip = (/** @type {string} */ reason) => ({ deploy: false, reason });
  if (facts.event === 'workflow_run') {
    const run = facts.run;
    if (run === undefined) return skip('The workflow_run event has no triggering run.');
    if (run.conclusion !== 'success') return skip(`CI did not succeed (${run.conclusion}).`);
    if (run.event !== 'push') return skip(`CI ran for a ${run.event}, not a push to main.`);
    if (run.headRepository !== facts.repository) {
      return skip(`CI ran for another repository (${run.headRepository}).`);
    }
    if (run.headBranch !== MAIN) return skip(`CI ran for ${run.headBranch}, not main.`);
  } else if (facts.event === 'workflow_dispatch') {
    if (facts.ref !== `refs/heads/${MAIN}`) return skip('Staging deploys by hand only from main.');
    if (!facts.ciPassed) return skip(`CI has not succeeded on a push of ${facts.sha} to main.`);
  } else {
    return skip(`Staging does not deploy on ${facts.event}.`);
  }
  if (facts.mainTip === '') return skip('The tip of main is unknown.');
  if (facts.mainTip !== facts.sha) {
    return skip(`${facts.sha} is not the tip of main: main is now at ${facts.mainTip}.`);
  }
  return { deploy: true, reason: `Deploying ${facts.sha}, the tip of main.` };
}

/**
 * The gate's input from the workflow's environment.
 * @param {Record<string, string | undefined>} env
 * @returns {GateInput}
 */
export function gateInputFromEnv(env) {
  const event = env.EVENT_NAME ?? '';
  return {
    event,
    ref: env.REF ?? '',
    repository: env.REPOSITORY ?? '',
    sha: env.DEPLOY_SHA ?? '',
    run:
      event === 'workflow_run'
        ? {
            conclusion: env.RUN_CONCLUSION ?? '',
            event: env.RUN_EVENT ?? '',
            headRepository: env.RUN_HEAD_REPOSITORY ?? '',
            headBranch: env.RUN_HEAD_BRANCH ?? '',
          }
        : undefined,
  };
}

/**
 * @param {Gh} gh
 * @param {string[]} args
 * @returns {string}
 */
function ask(gh, args) {
  const result = gh(args);
  if (result.status !== 0) {
    throw new Error(`gh ${args.join(' ')} failed: ${(result.stderr ?? '').trim()}`);
  }
  return result.stdout.trim();
}

/**
 * Gathers the facts from GitHub, decides, and writes `deploy=<bool>` through `output`. Returns 1
 * only when GitHub could not be asked; a decision not to deploy is not a failure.
 * @param {Record<string, string | undefined>} env
 * @param {Gh} gh
 * @param {(line: string) => void} output
 * @param {(line: string) => void} log
 * @returns {number}
 */
export function runGate(env, gh, output, log) {
  const input = gateInputFromEnv(env);
  try {
    const mainTip = ask(gh, [
      'api',
      `repos/${input.repository}/git/ref/heads/${MAIN}`,
      '--jq',
      '.object.sha',
    ]);
    const ciPassed =
      input.event === 'workflow_dispatch' &&
      Number(
        ask(gh, [
          'api',
          `repos/${input.repository}/actions/workflows/ci.yml/runs?head_sha=${input.sha}&branch=${MAIN}&event=push&status=success`,
          '--jq',
          '.total_count',
        ]),
      ) > 0;
    const decision = deployDecision({ ...input, mainTip, ciPassed });
    log(`${decision.reason}\n`);
    output(`deploy=${String(decision.deploy)}\n`);
    return 0;
  } catch (error) {
    log(`deploy-gate: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const outputFile = process.env.GITHUB_OUTPUT;
  process.exit(
    runGate(
      process.env,
      (args) => {
        const result = spawnSync('gh', args, { encoding: 'utf8' });
        if (result.error !== undefined) {
          return { status: 1, stdout: '', stderr: `could not run gh: ${result.error.message}` };
        }
        return { status: result.status, stdout: result.stdout, stderr: result.stderr };
      },
      (line) => {
        if (outputFile === undefined || outputFile === '') process.stdout.write(line);
        else appendFileSync(outputFile, line);
      },
      (line) => {
        process.stdout.write(line);
      },
    ),
  );
}
