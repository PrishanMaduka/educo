// Spec 03: colours come only from the tokens, so a Tailwind arbitrary colour (`bg-[#fff]`) or a literal
// colour in a `style` prop bypasses light/dark theming and the contrast checks.

const UTILITIES =
  'bg|text|border(?:-[xytrblse])?|ring(?:-offset)?|fill|stroke|from|via|to|outline|decoration|accent|caret|shadow|divide|placeholder';
const COLOUR_VALUE = String.raw`#|(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\(|color:`;

// The lookbehind keeps `stroked-[#fff]` out while still matching after a variant (`dark:bg-[`) or `!`.
const ARBITRARY_COLOUR = new RegExp(
  String.raw`(?<![\w-])(?:${UTILITIES})-\[\s*(?:${COLOUR_VALUE})`,
  'i',
);

const STYLE_PROPERTIES = new Set([
  'color',
  'background',
  'backgroundColor',
  'borderColor',
  'fill',
  'stroke',
  'outlineColor',
]);
const LITERAL_COLOUR = /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\(/i;
const KEYWORDS = new Set([
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
  'currentcolor',
  'transparent',
  'none',
]);

/** A literal colour: a hex or colour function anywhere (a `var()` fallback included), or a named colour. */
function isLiteralColour(value) {
  const trimmed = value.trim();
  if (LITERAL_COLOUR.test(trimmed)) return true;
  return /^[a-z]+$/i.test(trimmed) && !KEYWORDS.has(trimmed.toLowerCase());
}

function staticString(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? undefined;
  }
  return undefined;
}

function propertyName(property) {
  if (property.computed) return staticString(property.key);
  if (property.key.type === 'Identifier') return property.key.name;
  return staticString(property.key);
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Ban arbitrary and literal colours; use the token utilities.' },
    schema: [],
    messages: {
      classColour:
        'Use a token colour utility (bg-brand, text-ink-2, …) or bg-[var(--quad-…)], not an arbitrary colour value.',
      styleColour:
        'Use a token CSS variable (var(--quad-…)) for colours in style, not a literal colour.',
    },
  },
  create(context) {
    const checkText = (node, text) => {
      if (ARBITRARY_COLOUR.test(text)) context.report({ node, messageId: 'classColour' });
    };

    return {
      Literal(node) {
        if (typeof node.value === 'string') checkText(node, node.value);
      },
      TemplateElement(node) {
        checkText(node, node.value.cooked ?? node.value.raw);
      },
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'style') return;
        const expression =
          node.value?.type === 'JSXExpressionContainer' ? node.value.expression : null;
        if (expression?.type !== 'ObjectExpression') return;
        for (const property of expression.properties) {
          if (property.type !== 'Property') continue;
          const name = propertyName(property);
          if (name === undefined || !STYLE_PROPERTIES.has(name)) continue;
          const value = staticString(property.value);
          if (value !== undefined && isLiteralColour(value)) {
            context.report({ node: property.value, messageId: 'styleColour' });
          }
        }
      },
    };
  },
};
