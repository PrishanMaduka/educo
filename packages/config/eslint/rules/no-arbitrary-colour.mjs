// Spec 03: colours come only from the tokens, so a Tailwind arbitrary colour (`bg-[#fff]`) or a literal
// colour in a `style` prop bypasses light/dark theming and the contrast checks.

const UTILITIES = [
  'drop-shadow',
  'inset-shadow',
  'inset-ring',
  'text-shadow',
  'bg',
  'text',
  'border(?:-[xytrblse])?',
  'ring(?:-offset)?',
  'fill',
  'stroke',
  'from',
  'via',
  'to',
  'outline',
  'decoration',
  'accent',
  'caret',
  'shadow',
  'divide',
  'placeholder',
].join('|');

// Each arbitrary value of a colour-bearing utility. The lookbehind keeps `stroked-[…]` out while still
// matching after a variant (`dark:bg-[`) or `!`.
const ARBITRARY_VALUE = new RegExp(String.raw`(?<![\w-])(?:${UTILITIES})-\[([^\]\s]*)\]`, 'gi');

// A hex colour, a colour function or a `color:` type hint anywhere in a value. `color-mix()` over
// variables and `color:var(…)` are fine (the lookbehinds allow `_`, a space in arbitrary values); `url(#id)` is removed first so a fragment is not a hex.
const COLOUR =
  /#[\da-f]{3,8}(?![\w-])|(?<![a-z\d-])(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\(|(?<![a-z\d-])color:(?!\s*_?var\()/i;
const URL = /url\([^)]*\)/gi;

// CSS named colours (CSS Color 4), matched as whole words.
const NAMED_COLOURS = new Set(
  `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown
  burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan
  darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid
  darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet
  deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro
  ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki
  lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow
  lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray
  lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine
  mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen
  mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace
  olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred
  papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue
  saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey
  snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow
  yellowgreen`.split(/\s+/),
);

/** True when a CSS value (or an arbitrary value, with `_` for spaces) holds a literal colour. */
function hasLiteralColour(value) {
  const text = value.replace(URL, '');
  if (COLOUR.test(text)) return true;
  return text.split(/[\s_,()/]+/).some((word) => NAMED_COLOURS.has(word.toLowerCase()));
}

const STYLE_PROPERTIES = new Set(['boxShadow', 'textShadow', 'fill', 'stroke', 'color']);
const isColourProperty = (name) =>
  STYLE_PROPERTIES.has(name) ||
  name.endsWith('Color') ||
  /^(?:background|border|outline)(?:[A-Z]|$)/.test(name);

function staticString(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? undefined;
  }
  return undefined;
}

/** The literal text a style value can produce: string literals, template quasis, and both branches. */
function literalParts(node) {
  switch (node.type) {
    case 'Literal':
      return typeof node.value === 'string' ? [node.value] : [];
    case 'TemplateLiteral':
      return node.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw);
    case 'ConditionalExpression':
      return [...literalParts(node.consequent), ...literalParts(node.alternate)];
    case 'LogicalExpression':
      return [...literalParts(node.left), ...literalParts(node.right)];
    default:
      return [];
  }
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
      for (const match of text.matchAll(ARBITRARY_VALUE)) {
        if (hasLiteralColour(match[1] ?? '')) {
          context.report({ node, messageId: 'classColour' });
          return;
        }
      }
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
          if (name === undefined || !isColourProperty(name)) continue;
          if (literalParts(property.value).some(hasLiteralColour)) {
            context.report({ node: property.value, messageId: 'styleColour' });
          }
        }
      },
    };
  },
};
