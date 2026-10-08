import nextPlugin from '@next/eslint-plugin-next';

import react from './react.mjs';

/** React config plus the Next.js rules (core web vitals). */
export default [
  ...react,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
];
