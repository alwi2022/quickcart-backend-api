// models/Brand.js
import mongoose, { Schema } from "mongoose";


const BrandSchema = new Schema(
    {
        slug: { type: String, unique: true, index: true },
        name: { type: String, required: true },
        logo_url: String,
        logo_public_id: { type: String, default: '' },
        country: String,
        status: { type: String, enum: ["active", "inactive"], default: "active" },
    },
    { timestamps: true }
);


BrandSchema.index({ name: "text" });


export default mongoose.models.Brand || mongoose.model("Brand", BrandSchema);