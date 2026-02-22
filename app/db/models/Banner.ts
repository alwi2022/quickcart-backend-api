import { Schema, model, models, type Model } from "mongoose";


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


const BannerModel = (models.Banner || model("Banner", BannerSchema)) as Model<Record<string, unknown>>;

export default BannerModel;


