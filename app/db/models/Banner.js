import { Schema, model, models } from "mongoose";


const BannerSchema = new Schema(
    {
        slot: { type: String, index: true },
        title: String,
        imageUrl: String,
        linkUrl: String,
        startAt: Date,
        endAt: Date,
        priority: { type: Number, default: 0 },
        status: { type: String, enum: ["active", "inactive"], default: "active" },
    },
    { timestamps: true }
);


BannerSchema.index({ slot: 1, status: 1, startAt: 1, endAt: 1 });


export default models.Banner || model("Banner", BannerSchema);