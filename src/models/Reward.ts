import { Schema, model } from 'mongoose';

export interface IReward {
  id: string; // RW-YYYY-xxxxxxx
  painterId: string;
  productId: string;
  qrString: string;
  amount: number;
  type: 'BUCKET_REWARD';
  status: 'CREDITED';
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IReward>(
  {
    id: { type: String, required: true, unique: true, index: true },
    painterId: { type: String, required: true, index: true },
    productId: { type: String, required: true, unique: true, index: true }, // one reward per bucket, enforced at the DB level too
    qrString: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ['BUCKET_REWARD'], default: 'BUCKET_REWARD' },
    status: { type: String, enum: ['CREDITED'], default: 'CREDITED' },
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

export const Reward = model<IReward>('Reward', schema);
