import { Schema, model, models, type Model } from "mongoose";


const WishlistSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", unique: true },
        items: [
            {
                // String supaya bisa simpan ID produk legacy/non-ObjectId
                productId: { type: String, index: true },
                addedAt: { type: Date, default: Date.now },
            },
        ],
    },
    { timestamps: true }
);


const WishlistModel = (models.Wishlist || model("Wishlist", WishlistSchema)) as Model<Record<string, unknown>>;

export default WishlistModel;


