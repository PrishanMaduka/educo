import { z } from 'zod';

/**
 * The public admissions enquiry form (spec 05 Tenant-less entry points; spec 06
 * `POST /public/enquiry/:embedKey`). The school comes only from `tenant_by_embed_key`; nothing in
 * the body names it. M4 adds each form's own fields (`enquiry_forms.fields`) and the captcha.
 */

/** `:embedKey`: the key in a school's embed code, 8 to 64 URL-safe characters. */
export const EmbedKeyParams = z.object({
  embedKey: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, { message: 'must be an embed key' }),
});
export type EmbedKeyParams = z.infer<typeof EmbedKeyParams>;

/** What a family sends from the form: who they are, and optionally their child and a note. */
export const EnquiryInput = z
  .object({
    parentName: z.string().trim().min(1, { message: 'Enter your name' }).max(120),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254)
      .email({ message: 'Enter a valid email address' }),
    phone: z.string().trim().max(40).optional(),
    childName: z.string().trim().max(120).optional(),
    message: z.string().trim().max(2000).optional(),
  })
  .strict();
export type EnquiryInput = z.infer<typeof EnquiryInput>;
