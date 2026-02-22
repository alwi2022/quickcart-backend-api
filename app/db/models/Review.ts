// models/Review.js
import mongoose, { Schema, type Model } from "mongoose";


const ReviewSchema = new Schema(
    {
        product_id: { type: Schema.Types.ObjectId, ref: "Product", index: true },
        variant_id: { type: Schema.Types.ObjectId },
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


ReviewSchema.index({ status: 1, createdAt: -1 });


const ReviewModel = (mongoose.models.Review || mongoose.model("Review", ReviewSchema)) as Model<Record<string, unknown>>;

export default ReviewModel;


