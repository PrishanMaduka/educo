import { describe, expect, it } from 'vitest';

import { initialSignIn, signInReducer, type SignInState } from './sign-in-steps';

const at = (step: SignInState['step'], email = 'prishan@school.lk'): SignInState => ({
  step,
  email,
});

describe('the sign-in steps', () => {
  it('starts at the work email, or at the password for a known address', () => {
    expect(initialSignIn()).toEqual(at({ name: 'email' }, ''));
    expect(initialSignIn('a@b.co')).toEqual(at({ name: 'password' }, 'a@b.co'));
  });

  it('always asks for the password after the email, looking nothing up', () => {
    expect(signInReducer(initialSignIn(), { type: 'email_entered', email: 'a@b.co' })).toEqual(
      at({ name: 'password' }, 'a@b.co'),
    );
  });

  it.each([
    ['two_step', { name: 'two_step' }],
    ['two_step_setup', { name: 'two_step_setup' }],
    ['choose_school', { name: 'choose_school' }],
    ['no_school', { name: 'no_school' }],
    ['done', { name: 'opening', school: null }],
  ] as const)('follows the API’s next step %s', (next, step) => {
    expect(signInReducer(at({ name: 'password' }), { type: 'answered', next })).toEqual(at(step));
  });

  it('shows the recovery codes once after setting up two-step, then goes on', () => {
    const codes = ['aaaaa-bbbbb'];
    const shown = signInReducer(at({ name: 'two_step_setup' }), {
      type: 'two_step_set_up',
      codes,
      next: 'choose_school',
    });
    expect(shown).toEqual(at({ name: 'recovery_codes', codes, then: 'choose_school' }));
    // Once saved, the page answers with the step the codes stood before.
    expect(signInReducer(shown, { type: 'answered', next: 'choose_school' })).toEqual(
      at({ name: 'choose_school' }),
    );
  });

  it('opens the school after the codes when set-up finished outside a sign-in step', () => {
    expect(
      signInReducer(at({ name: 'two_step_setup' }), {
        type: 'two_step_set_up',
        codes: [],
        next: null,
      }),
    ).toEqual(at({ name: 'recovery_codes', codes: [], then: 'done' }));
  });

  it('sets up two-step when the chosen school asks for it', () => {
    expect(signInReducer(at({ name: 'choose_school' }), { type: 'two_step_required' })).toEqual(
      at({ name: 'two_step_setup' }),
    );
  });

  it('says which school it is opening', () => {
    expect(
      signInReducer(at({ name: 'choose_school' }), { type: 'school_chosen', school: 'KHA' }),
    ).toEqual(at({ name: 'opening', school: 'KHA' }));
  });

  it('goes from forgot password to Check your inbox with the address used', () => {
    const forgot = signInReducer(at({ name: 'password' }), { type: 'forgot' });
    expect(forgot).toEqual(at({ name: 'forgot' }));
    expect(signInReducer(forgot, { type: 'reset_sent', email: 'other@b.co' })).toEqual(
      at({ name: 'check_inbox' }, 'other@b.co'),
    );
  });

  it('goes back to the start, keeping the address, from forgot, the inbox and no school', () => {
    for (const name of ['forgot', 'check_inbox', 'no_school'] as const) {
      expect(signInReducer(at({ name }), { type: 'back' })).toEqual(at({ name: 'email' }));
    }
  });

  it('changes the email from the password and code steps', () => {
    expect(signInReducer(at({ name: 'two_step' }), { type: 'change_email' })).toEqual(
      at({ name: 'email' }),
    );
  });
});
