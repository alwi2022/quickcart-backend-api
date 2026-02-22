// models/Payment.js
import { Schema, model, models, type Model } from "mongoose";


const PaymentSchema = new Schema(
{
orderId: { type: Schema.Types.ObjectId, ref: "Order", unique: true },
provider: String, // Midtrans, Xendit, dsb
method: String, // va_bca, qris, cc, dll
amount: Number,
currency: { type: String, default: "IDR" },
status: { type: String, enum: ["pending", "paid", "failed", "expired", "refunded"], default: "pending" },
externalRef: { type: String, index: true },
vaNumber: String,
paidAt: Date,
raw: Schema.Types.Mixed,
},
{ timestamps: true }
);


PaymentSchema.index({ status: 1, createdAt: -1 });


const PaymentModel = (models.Payment || model("Payment", PaymentSchema)) as Model<Record<string, unknown>>;

export default PaymentModel;


