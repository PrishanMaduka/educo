import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadBlob } from './download';

describe('downloadBlob', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('clicks an attached, hidden link named for the file, then removes it and frees the URL', () => {
    vi.useFakeTimers();
    const create = vi.fn(() => 'blob:quad/1');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const clicked: HTMLAnchorElement[] = [];
    const connectedAtClick: boolean[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      connectedAtClick.push(this.isConnected);
      clicked.push(this);
    });

    downloadBlob(new Blob(['a,b\n']), 'quad-platform-audit.csv');

    expect(connectedAtClick).toEqual([true]);
    const [link] = clicked;
    expect(link?.download).toBe('quad-platform-audit.csv');
    expect(link?.href).toBe('blob:quad/1');
    expect(link?.hidden).toBe(true);
    expect(link?.isConnected).toBe(false);
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:quad/1');
  });
});
