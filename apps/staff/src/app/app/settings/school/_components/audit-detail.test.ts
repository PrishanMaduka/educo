import { describe, expect, it } from 'vitest';

import { changesOf, detailsOf } from './audit-detail';

describe('changesOf (settings.updated: each field before and after)', () => {
  it('lists each changed field in the order stored', () => {
    expect(
      changesOf('settings.updated', {
        fields: ['officeEmail', 'address'],
        before: { officeEmail: null, address: 'Kandy' },
        after: { officeEmail: 'office@x.local', address: null },
      }),
    ).toEqual([
      { field: 'officeEmail', before: null, after: 'office@x.local' },
      { field: 'address', before: 'Kandy', after: null },
    ]);
  });

  it('is empty for other actions or a meta without fields', () => {
    expect(changesOf('user.invited', { fields: ['name'] })).toEqual([]);
    expect(changesOf('settings.updated', {})).toEqual([]);
  });
});

describe('detailsOf (the rest of meta, as text)', () => {
  it('shows text, numbers and yes/no as they are, and anything nested as JSON', () => {
    expect(
      detailsOf({ resent: false, rows: 2, key: 'medical', matrix: { fees: '10100' } }),
    ).toEqual([
      { key: 'resent', value: 'false' },
      { key: 'rows', value: '2' },
      { key: 'key', value: 'medical' },
      { key: 'matrix', value: '{"fees":"10100"}' },
    ]);
  });

  it('leaves out what changesOf already shows for a settings change', () => {
    expect(
      detailsOf({ fields: ['address'], before: {}, after: {}, extra: 'x' }, 'settings.updated'),
    ).toEqual([{ key: 'extra', value: 'x' }]);
  });
});
