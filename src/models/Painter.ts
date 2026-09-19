import { Schema, model } from 'mongoose';

export interface IPainter {
  id: string; // PT-YYYY-xxxxxx business id
  name: string;
  mobile: string;
  upiId: string;
  city: string;
  state: string;
  experience: string;
  painterType: string;
  status: 'VERIFIED';
  walletBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IPainter>(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    mobile: { type: String, required: true, unique: true, index: true, match: /^\d{10}$/ },
    upiId: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z0-9._-]{2,}@[a-z0-9.-]{2,}$/ },
    city: { type: String, required: true, trim: true },
    state: { type: String, default: '', trim: true },
    experience: { type: String, default: '', trim: true },
    painterType: { type: String, default: 'Painter', trim: true },
    status: { type: String, enum: ['VERIFIED'], default: 'VERIFIED' },
    walletBalance: { type: Number, default: 0, min: 0 },
    totalEarned: { type: Number, default: 0, min: 0 },
    totalWithdrawn: { type: Number, default: 0, min: 0 },
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

export const Painter = model<IPainter>('Painter', schema);
