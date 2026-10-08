import { describe, expect, it } from 'vitest';

import { cn } from './cn';

describe('cn', () => {
  it('joins and drops falsy values', () => {
    expect(cn('a', false, undefined, 'b', null, ['c'], { d: true, e: false })).toBe('a b c d');
  });

  it('lets the later token utility win inside the same group', () => {
    expect(cn('rounded-card', 'rounded-pill')).toBe('rounded-pill');
    expect(cn('shadow-card', 'shadow-lg')).toBe('shadow-lg');
    expect(cn('text-ink', 'text-ink-2')).toBe('text-ink-2');
    expect(cn('bg-surface', 'bg-brand-fill')).toBe('bg-brand-fill');
    expect(cn('border-line', 'border-line-strong')).toBe('border-line-strong');
  });

  it('knows the public site colours', () => {
    expect(cn('text-coral-ink', 'text-[15px]')).toBe('text-coral-ink text-[15px]');
    expect(cn('bg-wash-1', 'bg-wc-paper')).toBe('bg-wc-paper');
  });

  it('keeps colour and size utilities apart', () => {
    expect(cn('text-ink-2', 'text-[14.5px]')).toBe('text-ink-2 text-[14.5px]');
    expect(cn('text-sm', 'text-ink', 'text-xs')).toBe('text-ink text-xs');
    expect(cn('rounded-card', 'border', 'border-line')).toBe('rounded-card border border-line');
  });
});
