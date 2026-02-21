import { Schema, model, models } from "mongoose";


const CouponSchema = new Schema(
    {
        code: { type: String, unique: true, index: true },
        type: { type: String, enum: ["flat", "percent", "shipping", "bundle"], default: "flat" },
        value: Number,
        minOrder: { type: Number, default: 0 },
        maxDiscount: { type: Number, default: null },
        startAt: Date,
        endAt: Date,
        usageLimit: Number,
        usageCount: { type: Number, default: 0 },
        constraints: { brandIds: [Schema.Types.ObjectId], categoryIds: [Schema.Types.ObjectId], firstOrderOnly: { type: Boolean, default: false } },
        status: { type: String, enum: ["active", "inactive"], default: "active" },
    },
    { timestamps: true }
);


CouponSchema.index({ status: 1, startAt: 1, endAt: 1 });


export default models.Coupon || model("Coupon", CouponSchema);