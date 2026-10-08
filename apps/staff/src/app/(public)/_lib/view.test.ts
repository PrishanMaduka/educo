import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

import { initialView, viewBootstrapScript, viewUrl } from './view';

describe('viewUrl', () => {
  it('adds ?view=parent for parents and keeps the rest of the address', () => {
    expect(viewUrl('https://quad-edu.com/?a=1#demo', 'parent')).toBe(
      'https://quad-edu.com/?a=1&view=parent#demo',
    );
  });

  it('drops the parameter for schools, the default', () => {
    expect(viewUrl('https://quad-edu.com/?view=parent', 'school')).toBe('https://quad-edu.com/');
  });
});

describe('initialView', () => {
  it.each([
    ['parent', null, 'parent'],
    ['school', 'parent', 'school'],
    [null, 'parent', 'parent'],
    [null, null, 'school'],
    ['teacher', null, 'school'],
  ] as const)('param %s and remembered %s open %s', (param, remembered, view) => {
    expect(initialView(param, remembered)).toBe(view);
  });
});

describe('viewBootstrapScript', () => {
  /** Runs the script against a stand-in page with this address and remembered view. */
  function bootstrap(search: string, remembered: string | null): string | undefined {
    const attributes: Record<string, string> = {};
    runInNewContext(viewBootstrapScript, {
      document: {
        documentElement: {
          setAttribute: (name: string, value: string) => {
            attributes[name] = value;
          },
        },
      },
      location: { search },
      localStorage: { getItem: () => remembered },
      URLSearchParams,
    });
    return attributes['data-view'];
  }

  it('sets data-view on <html> before paint, as initialView decides', () => {
    expect(bootstrap('?view=parent', null)).toBe('parent');
    expect(bootstrap('?view=school', 'parent')).toBe('school');
    expect(bootstrap('', 'parent')).toBe('parent');
    expect(bootstrap('', null)).toBe('school');
  });
});
