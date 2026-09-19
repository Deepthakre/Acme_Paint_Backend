import { z } from 'zod';

export const sendOtpSchema = z.object({
  mobile: z.string().trim().regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number.'),
});

export const redeemVoucherSchema = z.object({
  dealer: z.string().trim().min(1),
  mobile: z.string().trim().regex(/^\d{10}$/),
  code: z.string().trim().min(4).max(20),
  discount: z.coerce.number().positive(),
});
