import type { Request, Response } from 'express';
import crypto from 'crypto';
import { asyncHandler } from '../utils/asyncHandler';
import { Voucher } from '../models/Voucher';
import { nextSeq } from '../models/Counter';
import { nextVoucherId } from '../utils/ids';
import { parsePagination, paginate } from '../utils/pagination';
import { nowStr } from '../services/invoice.service';

/**
 * Sends (simulates) an OTP to a mobile number. A real deployment wires
 * this to an SMS gateway and returns ONLY a success flag — never the
 * code itself. This stub still never echoes the OTP back to keep that
 * contract honest even in development; wire your SMS provider here.
 */
export const sendVoucherOtp = asyncHandler(async (req: Request, res: Response) => {
  const { mobile } = req.body;
  const otp = String(crypto.randomInt(1000, 10000));
  // TODO: integrate an SMS provider (e.g. Twilio/MSG91) and send `otp` to `mobile`.
  // In development only, log it server-side so the flow is testable end to end.
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log(`[DEV OTP] ${mobile}: ${otp}`);
  }
  res.json({ success: true, data: { mobile, sent: true } });
});

export const redeemVoucher = asyncHandler(async (req: Request, res: Response) => {
  const { dealer, mobile, code, discount } = req.body;
  const seq = await nextSeq('voucher');
  const voucher = await Voucher.create({
    id: nextVoucherId(seq),
    dealer,
    mobile,
    code,
    discount,
    status: 'REDEEMED',
    date: nowStr(),
  });
  res.status(201).json({ success: true, data: voucher.toJSON() });
});

export const listVouchers = asyncHandler(async (req: Request, res: Response) => {
  const params = parsePagination(req.query as Record<string, unknown>);
  const filter = { dealer: req.params.dealer };
  const result = await paginate(Voucher.find(filter), Voucher.countDocuments(filter), params);
  res.json({ success: true, ...result });
});
