import { describe, expect, it } from 'vitest';

import { firstNameOf } from './first-name';

describe('firstNameOf', () => {
  it.each([
    ['Prishan Maduka', 'Prishan'],
    ['  Nadeesha   Jayasinghe ', 'Nadeesha'],
    ['Dr. Ruwan Mendis', 'Ruwan'],
    ['Mrs. A. Perera', 'Perera'],
    ['Amaya', 'Amaya'],
    ['Dr.', 'Dr.'],
    ['', ''],
  ])('%j gives %j', (name, expected) => {
    expect(firstNameOf(name)).toBe(expected);
  });
});
