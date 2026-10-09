'use client';

import { SensitiveKey } from '@quad/contracts';
import { Switch } from '@quad/ui';
import { TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { sensitiveCopy } from './matrix-labels';
import { sensitiveLocked } from './role-draft';

export interface SensitiveSwitchesProps {
  /** The keys switched on in the draft. */
  value: readonly SensitiveKey[];
  /** The keys the role has now (from the API): those stay free to switch off. */
  stored: readonly SensitiveKey[];
  /** The keys the signed-in admin holds; any other key is locked off (spec 08). */
  held: readonly SensitiveKey[];
  /** A built-in role: every switch is shown but locked. */
  readOnly?: boolean;
  onChange: (key: SensitiveKey, on: boolean) => void;
}

/**
 * Sensitive access (spec 05; prototype step 4): off unless turned on, every use logged. A key the
 * admin lacks cannot be given, so its switch is locked with the reason under it.
 */
export function SensitiveSwitches({
  value,
  stored,
  held,
  readOnly = false,
  onChange,
}: SensitiveSwitchesProps) {
  const { t } = useTranslation();
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {SensitiveKey.options.map((key) => {
        const copy = sensitiveCopy(key);
        const notHeld = sensitiveLocked(key, held, stored);
        const hintId = `sensitive-${key}-hint`;
        return (
          <li
            key={key}
            className="flex items-center gap-3 border-b border-line px-[18px] py-3 last:border-b-0"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-warn-soft text-ink">
              <TriangleAlert aria-hidden="true" strokeWidth={2} className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[13.5px] font-bold text-ink">{t(copy.label)}</p>
              <p id={hintId} className="m-0 text-xs text-ink-2">
                {notHeld && !readOnly ? t('roles.sensitive.notHeld') : t(copy.hint)}
              </p>
            </div>
            <Switch
              aria-label={t(copy.label)}
              aria-describedby={hintId}
              checked={value.includes(key)}
              disabled={readOnly || (notHeld && !value.includes(key))}
              onCheckedChange={(on) => {
                onChange(key, on);
              }}
            />
          </li>
        );
      })}
    </ul>
  );
}
