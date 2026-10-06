import { TYPE, parse, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';

type ArbEntry = string | { placeholders: Record<string, { type: string }> };

const camelCase = (key: string): string =>
  key
    .split(/[.\-_]+/)
    .filter(Boolean)
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');

const collect = (elements: MessageFormatElement[], out: Map<string, string>): void => {
  for (const el of elements) {
    switch (el.type) {
      case TYPE.literal:
      case TYPE.pound:
      case TYPE.tag:
        if (el.type === TYPE.tag) collect(el.children, out);
        break;
      case TYPE.argument:
        if (!out.has(el.value)) out.set(el.value, 'Object');
        break;
      case TYPE.number:
        out.set(el.value, 'num');
        break;
      case TYPE.date:
      case TYPE.time:
        out.set(el.value, 'DateTime');
        break;
      case TYPE.plural:
        out.set(el.value, 'num');
        for (const opt of Object.values(el.options)) collect(opt.value, out);
        break;
      case TYPE.select:
        out.set(el.value, 'String');
        for (const opt of Object.values(el.options)) collect(opt.value, out);
        break;
    }
  }
};

/** Validates each message as ICU and returns a Flutter ARB map (camelCase keys). */
export function buildArb(messages: Record<string, string>): Record<string, ArbEntry> {
  const arb: Record<string, ArbEntry> = { '@@locale': 'en' };
  for (const [key, message] of Object.entries(messages)) {
    let ast: MessageFormatElement[];
    try {
      ast = parse(message);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid ICU message for key "${key}": ${reason}`);
    }
    const name = camelCase(key);
    arb[name] = message;
    const args = new Map<string, string>();
    collect(ast, args);
    if (args.size > 0) {
      arb[`@${name}`] = {
        placeholders: Object.fromEntries([...args].map(([arg, type]) => [arg, { type }])),
      };
    }
  }
  return arb;
}
