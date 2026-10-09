import { SchoolUpdateInput } from '@quad/contracts';
import { z } from 'zod';

import type { School } from '@quad/contracts';

/** An empty field stands for "none": the API clears it with null. */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z
    .string()
    .transform((value) => (value.trim() === '' ? null : value))
    .pipe(schema);

const fields = SchoolUpdateInput.innerType().shape;

/** The General form, checked with the contract's own rules (`PATCH /school`). */
export const GeneralFormSchema = z.object({
  name: fields.name.unwrap(),
  officeEmail: optional(fields.officeEmail.unwrap()),
  officePhone: optional(fields.officePhone.unwrap()),
  address: optional(fields.address.unwrap()),
  smsSenderId: optional(fields.smsSenderId.unwrap()),
});
export type GeneralFormInput = z.input<typeof GeneralFormSchema>;
export type GeneralFormOutput = z.output<typeof GeneralFormSchema>;

/** The General fields a school changes itself, in form order. */
export const GENERAL_FIELDS = [
  'name',
  'officeEmail',
  'officePhone',
  'address',
  'smsSenderId',
] as const satisfies readonly (keyof GeneralFormOutput)[];

/** The school's General values as the form shows them (none is an empty field). */
export function generalValuesOf(school: School): GeneralFormInput {
  return {
    name: school.name,
    officeEmail: school.officeEmail ?? '',
    officePhone: school.officePhone ?? '',
    address: school.address ?? '',
    smsSenderId: school.smsSenderId ?? '',
  };
}

/** The `PATCH /school` body: only the fields that differ from what the school has now. */
export function changesFrom(values: GeneralFormOutput, school: School): SchoolUpdateInput {
  return Object.fromEntries(
    GENERAL_FIELDS.filter((key) => values[key] !== school[key]).map((key) => [key, values[key]]),
  );
}
