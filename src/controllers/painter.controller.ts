import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { Painter ,type IPainter} from '../models/Painter';
import { Reward } from '../models/Reward';
import { Withdrawal } from '../models/Withdrawal';
import { Product } from '../models/Product';
import { nextPainterId, nextRewardId, nextWithdrawalId, extractSignedQrString, verifyQrString } from '../utils/ids';
import { parsePagination, paginate } from '../utils/pagination';
import { nowStr } from '../services/invoice.service';


export const registerPainter = asyncHandler(async (req: Request, res: Response) => {
  const { name, mobile, upiId, city, state, experience, painterType } = req.body;
  const existing = await Painter.findOne({ mobile });
  if (existing) return res.json({ success: true, data: { painter: existing.toJSON(), existing: true } });

  const countSeq = (await Painter.countDocuments()) + 1;
  const painter = await Painter.create({
    id: nextPainterId(countSeq),
    name,
    mobile,
    upiId,
    city,
    state: state || '',
    experience: experience || '',
    painterType: painterType || 'Painter',
    status: 'VERIFIED',
    walletBalance: 0,
    totalEarned: 0,
    totalWithdrawn: 0,
  });
  res.status(201).json({ success: true, data: { painter: painter.toJSON(), existing: false } });
});

export const getPainterDashboard = asyncHandler(async (req: Request, res: Response) => {
  const painter = await Painter.findOne({ id: req.params.painterId }).lean();
  if (!painter) throw ApiError.notFound('Painter account not found.');
  const [rewards, withdrawals] = await Promise.all([
    Reward.find({ painterId: painter.id }).sort('-createdAt').lean(),
    Withdrawal.find({ painterId: painter.id }).sort('-createdAt').lean(),
  ]);
  res.json({ success: true, data: { painter, rewards, withdrawals } });
});

export const claimPainterReward = asyncHandler(async (req: Request, res: Response) => {
  const { painterId, qrString } = req.body;
  const painter = await Painter.findOne({ id: painterId });
  if (!painter || painter.status !== 'VERIFIED') throw ApiError.badRequest('Painter account is not verified.');

  // ANTI-FRAUD: product IDs are sequential (PRD-2026-000001, 000002, ...),
  // so a claim MUST carry a valid HMAC signature — proof it came from an
  // actual printed/scanned QR — not just a guessable bare ID. Without this
  // check, anyone could loop through IDs via the API directly and farm
  // rewards on buckets they never touched.
  const rawQr = extractSignedQrString(qrString);
  const { valid, id } = verifyQrString(rawQr);
  if (!valid) {
    throw ApiError.badRequest('This QR could not be verified as genuine. Please scan the printed QR code directly rather than typing an ID.');
  }

  const product = await Product.findOne({ qr: id });
  if (!product) throw ApiError.badRequest('Product QR is invalid.');
  if (!product.active) throw ApiError.badRequest('This bucket has not been activated by the manufacturer yet.');
  if (product.status === 'RETURNED') throw ApiError.badRequest('This bucket was recorded as returned/defective and is not eligible for a reward.');

  const alreadyClaimed = await Reward.findOne({ productId: product.qr, status: 'CREDITED' }).lean();
  if (alreadyClaimed) throw ApiError.conflict('Reward already claimed for this bucket.');

  const rewardSeq = (await Reward.countDocuments()) + 1;
  const rewardTime = nowStr();

  let reward;
  try {
    reward = await Reward.create({
      id: nextRewardId(rewardSeq),
      painterId,
      productId: product.qr,
      qrString: product.qrString,
      amount: 50,
      type: 'BUCKET_REWARD',
      status: 'CREDITED',
    });
  } catch (err: any) {
    // Unique index on productId is the real race guard — count-based ids
    // above are just for a readable display id, not concurrency safety.
    if (err?.code === 11000) throw ApiError.conflict('Reward already claimed for this bucket.');
    throw err;
  }

  painter.walletBalance += reward.amount;
  painter.totalEarned += reward.amount;
  await painter.save();

  // A genuinely-signed, activated bucket being claimed by a painter is the
  // most reliable "this bucket has actually reached and been opened by an
  // end user" signal in the whole system — MORE reliable than the dealer
  // receipt-scan, which is optional and often skipped. So this is the one
  // place that marks a product SOLD/consumed regardless of what stage
  // (FACTORY/TRANSIT/DEALER) it was last recorded at, closing the loop
  // even when the dealer never scanned anything. Already-SOLD stays SOLD
  // (idempotent) — this never regresses a more specific state.
  const previousStatus = product.status;
  product.status = 'SOLD';
  product.holder = `Consumed via Painter: ${painter.name} (${painter.id})`;
  product.rewardClaimed = true;
  product.rewardClaimedBy = painter.id;
  product.rewardClaimedAt = rewardTime;
  product.log.push({
    event:
      previousStatus === 'SOLD'
        ? `PAINTER REWARD ₹${reward.amount} claimed by ${painter.name}`
        : `PAINTER REWARD ₹${reward.amount} claimed by ${painter.name} — marked SOLD (was ${previousStatus}; dealer chain not fully scanned)`,
    who: painter.id,
    time: rewardTime,
  });
  await product.save();

  res.status(201).json({ success: true, data: { reward: reward.toJSON(), painter: painter.toJSON() } });
});

export const requestPainterWithdrawal = asyncHandler(async (req: Request, res: Response) => {
  const { painterId, amount } = req.body;
  const requested = Number(amount);

  // Atomic conditional decrement of walletBalance prevents a double-submit
  // race from reserving the same rupee twice across two requests.
  const painter = await Painter.findOneAndUpdate(
    { id: painterId, walletBalance: { $gte: requested } },
    { $inc: { walletBalance: -requested } },
    { new: true }
  );
  if (!painter) {
    const existing = await Painter.findOne({ id: painterId }).lean();
    if (!existing) throw ApiError.notFound('Painter account not found.');
    throw ApiError.badRequest('Insufficient reward balance.');
  }

  const seq = (await Withdrawal.countDocuments()) + 1;
  const withdrawal = await Withdrawal.create({
    id: nextWithdrawalId(seq),
    painterId,
    amount: requested,
    upiId: painter.upiId,
    status: 'PENDING',
    transactionId: null,
    utr: null,
    requestedAt: nowStr(),
    paidAt: null,
  });

  res.status(201).json({ success: true, data: { withdrawal: withdrawal.toJSON(), painter: painter.toJSON() } });
});

export const getPainterByMobile = asyncHandler(async (req: Request, res: Response) => {
  const painter = await Painter.findOne({ mobile: req.params.mobile }).lean();
  res.json({ success: true, data: painter || null });
});

export const listWithdrawals = asyncHandler(async (req: Request, res: Response) => {
  const params = parsePagination(req.query as Record<string, unknown>);
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;
  const result = await paginate(Withdrawal.find(filter), Withdrawal.countDocuments(filter), params);
  res.json({ success: true, ...result });
});

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Admin: painters who have claimed the ₹50 bucket reward at least once
 * (totalEarned is credited on every successful claim), top earners first.
 * Paginated + searchable; each page is enriched with claim count and
 * first/last claim time straight from the Reward collection.
 */
export const listRewardPainters = asyncHandler(async (req: Request, res: Response) => {
  const params = parsePagination(req.query as Record<string, unknown>);
  const filter: Record<string, unknown> = { totalEarned: { $gt: 0 } };

  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 60) : '';
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ id: rx }, { name: rx }, { mobile: rx }, { city: rx }, { upiId: rx }];
  }

  // Fixed compound sort (most earned first, _id as tie-break) so "Show more"
  // pages never skip or repeat painters who have the same total.
  const result = await paginate(Painter.find(filter), Painter.countDocuments(filter), {
    ...params,
    sort: '-totalEarned -_id',
  });
  const painters = result.data as unknown as IPainter[];

  const ids = painters.map((p) => p.id);
  const stats = ids.length
    ? await Reward.aggregate<{ _id: string; claims: number; firstClaimedAt: Date; lastClaimedAt: Date }>([
        { $match: { painterId: { $in: ids }, status: 'CREDITED' } },
        {
          $group: {
            _id: '$painterId',
            claims: { $sum: 1 },
            firstClaimedAt: { $min: '$createdAt' },
            lastClaimedAt: { $max: '$createdAt' },
          },
        },
      ])
    : [];
  const byPainter = new Map(stats.map((s) => [s._id, s]));

  const data = painters.map((p) => {
    const s = byPainter.get(p.id);
    return {
      ...p,
      claims: s?.claims ?? 0,
      firstClaimedAt: s?.firstClaimedAt ?? null,
      lastClaimedAt: s?.lastClaimedAt ?? null,
    };
  });

  res.json({ success: true, data, pagination: result.pagination });
});

/** Admin: every individual reward claim (newest first), optionally for one painter. Feeds the Excel report. */
export const listRewards = asyncHandler(async (req: Request, res: Response) => {
  const params = parsePagination(req.query as Record<string, unknown>);
  const filter: Record<string, unknown> = {};
  if (typeof req.query.painterId === 'string' && req.query.painterId.trim()) filter.painterId = req.query.painterId.trim();
  const result = await paginate(Reward.find(filter), Reward.countDocuments(filter), { ...params, sort: '-_id' });
  res.json({ success: true, ...result });
});