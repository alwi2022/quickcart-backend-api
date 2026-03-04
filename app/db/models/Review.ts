// models/Review.js
import mongoose, { Schema, type Model } from "mongoose";


const ReviewSchema = new Schema(
    {
        // String supaya mendukung productId dari katalog legacy
        product_id: { type: String, index: true },
        variant_id: { type: String },
        order_id: { type: Schema.Types.ObjectId, ref: "Order" },
        user_id: { type: Schema.Types.ObjectId, ref: "User" },
        rating: { type: Number, min: 1, max: 5 },
        title: String,
        content: String,
        media: [{ url: String }],
        helpful_count: { type: Number, default: 0 },
        status: { type: String, enum: ["pending", "published", "rejected"], default: "pending" },
    },
    { timestamps: true }
);


ReviewSchema.index({ product_id: 1, status: 1, createdAt: -1 });
ReviewSchema.index({ user_id: 1, createdAt: -1 });


const ReviewModel = (mongoose.models.Review || mongoose.model("Review", ReviewSchema)) as Model<Record<string, unknown>>;

export default ReviewModel;


