// models/Cart.js
import { Schema, model, models, type Model } from "mongoose";


const CartItemSchema = new Schema(
    {
        // String supaya kompatibel untuk produk legacy maupun ObjectId
        productId: { type: String, index: true },
        variantId: { type: String },
        sku: String,
        title: String,
        variantLabel: String,
        productImage: String,
        brand: String,
        category: String,
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


const CartModel = (models.Cart || model("Cart", CartSchema)) as Model<Record<string, unknown>>;

export default CartModel;


