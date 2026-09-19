import { z } from 'zod';

export const registerPainterSchema = z.object({
  name: z.string().trim().min(2, 'Enter the painter name.').max(120),
  mobile: z.string().trim().regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number.'),
  upiId: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{2,}@[a-z0-9.-]{2,}$/, 'Enter a valid UPI ID, e.g. name@upi.'),
  city: z.string().trim().min(1, 'City is required.').max(100),
  state: z.string().trim().max(100).optional(),
  experience: z.string().trim().max(60).optional(),
  painterType: z.string().trim().max(60).optional(),
});

export const claimRewardSchema = z.object({
  painterId: z.string().trim().min(1, 'painterId is required.'),
  qrString: z.string().trim().min(1),
});

export const withdrawalSchema = z.object({
  amount: z.coerce.number().min(500, 'Minimum withdrawal amount is ₹500.'),
});

export const painterIdParamSchema = z.object({ painterId: z.string().trim().min(1) });
export const mobileParamSchema = z.object({ mobile: z.string().trim().regex(/^\d{10}$/) });