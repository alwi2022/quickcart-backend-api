// models/Product.js
import { Schema, model, models } from "mongoose";


const MediaSchema = new Schema(
    { url: String, alt: String },
    { _id: false }
);


const VariantSchema = new Schema(
    {
        sku: { type: String, index: true, unique: true },
        options: { type: Schema.Types.Mixed }, // { color, size, dll }
        price: {
            currency: { type: String, default: "IDR" },
            list: { type: Number, required: true },
            sale: { type: Number, default: null },
            startAt: Date,
            endAt: Date,
        },
        weightGram: Number,
        dimensionsCm: { l: Number, w: Number, h: Number },
        barcode: String,
        status: { type: String, enum: ["active", "inactive"], default: "active" },
    },
    { _id: true }
);


const ProductSchema = new Schema(
    {
        slug: { type: String, unique: true, index: true },
        sku: String, // base
        title: { type: String, required: true },
        subtitle: String,
        brandId: { type: Schema.Types.ObjectId, ref: "Brand" },
        categoryIds: [{ type: Schema.Types.ObjectId, ref: "Category" }],
        descriptionHtml: String,
        media: [MediaSchema],
        attributes: Schema.Types.Mixed,
        variants: { type: [VariantSchema], validate: (v) => v.length > 0 },
        seo: { title: String, metaDescription: String },
        status: { type: String, enum: ["active", "draft", "archived"], default: "active" },
        rating: {
            avg: { type: Number, default: 0 },
            count: { type: Number, default: 0 },
        },
        soldCount: { type: Number, default: 0 },
        viewCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);


ProductSchema.index({ title: "text" });
ProductSchema.index({ brandId: 1 });
ProductSchema.index({ categoryIds: 1 });
ProductSchema.index({ status: 1 });
ProductSchema.index({ updatedAt: -1 });


export default models.Product || model("Product", ProductSchema);