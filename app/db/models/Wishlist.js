import { Schema, model, models } from "mongoose";


const WishlistSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", unique: true },
        items: [
            {
                productId: { type: Schema.Types.ObjectId, ref: "Product" },
                addedAt: { type: Date, default: Date.now },
            },
        ],
    },
    { timestamps: true }
);


export default models.Wishlist || model("Wishlist", WishlistSchema);