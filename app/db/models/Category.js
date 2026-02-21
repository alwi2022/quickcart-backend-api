// models/Category.js
import mongoose, { Schema } from "mongoose";


const CategorySchema = new Schema(
    {
        slug: { type: String, unique: true, index: true },
        name: { type: String, required: true },
        image: { type: String, required: true },
        parent_id: { type: Schema.Types.ObjectId, ref: "Category", default: null },
        ancestors: [
            {
                _id: { type: Schema.Types.ObjectId, ref: "Category" },
                name: String,
                slug: String,
            },
        ],
        order: { type: Number, default: 0 },
    },
    { timestamps: true }
);


CategorySchema.index({ parent_id: 1, order: 1 });


export default mongoose.models.Category || mongoose.model("Category", CategorySchema);