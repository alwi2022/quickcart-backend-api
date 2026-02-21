// models/Cart.js
import { Schema, model, models } from "mongoose";


const CartItemSchema = new Schema(
    {
        productId: { type: Schema.Types.ObjectId, ref: "Product" },
        variantId: { type: Schema.Types.ObjectId },
        sku: String,
        title: String,
        variantLabel: String,
        qty: { type: Number, default: 1 },
        priceSnapshot: { currency: String, unit: Number },
        addedAt: { type: Date, default: Date.now },
    },
    { _id: true }
);


const CartSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
        sessionId: { type: String, index: true }, // untuk guest
        items: [CartItemSchema],
        couponCodes: [String],
        notes: String,
    },
    { timestamps: true }
);


export default models.Cart || model("Cart", CartSchema);