import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildArb } from './build';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, '../../i18n/en.json');
const target = resolve(here, '../../../../apps/parent/lib/l10n/app_en.arb');

const messages = JSON.parse(readFileSync(source, 'utf8')) as Record<string, string>;
const arb = buildArb(messages);
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(arb, null, 2)}\n`);
console.log(`Wrote ${Object.keys(messages).length} strings to ${target}`);
