import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildThemeCss, buildTokensCss } from './css';
import { buildDart } from './dart';

const pkg = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dist = resolve(pkg, 'dist');
const dartFile = resolve(pkg, '../../apps/parent/lib/theme/tokens.g.dart');

function write(file: string, content: string): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

write(resolve(dist, 'theme.css'), buildThemeCss());
write(resolve(dist, 'tokens.css'), buildTokensCss());
write(dartFile, buildDart());
process.stdout.write(
  'tokens: wrote dist/theme.css, dist/tokens.css and apps/parent/lib/theme/tokens.g.dart\n',
);
