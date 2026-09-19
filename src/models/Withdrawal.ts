import { Schema, model } from 'mongoose';

export type WithdrawalStatus = 'PENDING' | 'PAID' | 'REJECTED';

export interface IWithdrawal {
  id: string; // WD-YYYY-xxxxxx
  painterId: string;
  amount: number;
  upiId: string;
  status: WithdrawalStatus;
  transactionId: string | null;
  utr: string | null;
  requestedAt: string;
  paidAt: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IWithdrawal>(
  {
    id: { type: String, required: true, unique: true, index: true },
    painterId: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 500 },
    upiId: { type: String, required: true },
    status: { type: String, enum: ['PENDING', 'PAID', 'REJECTED'], default: 'PENDING', index: true },
    transactionId: { type: String, default: null },
    utr: { type: String, default: null },
    requestedAt: { type: String, required: true },
    paidAt: { type: String, default: null },
  },
  { timestamps: true }
);

schema.set('toJSON', {
  transform: (_d, ret: any) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Withdrawal = model<IWithdrawal>('Withdrawal', schema);
