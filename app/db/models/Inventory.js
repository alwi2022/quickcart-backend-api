// models/Inventory.js
import mongoose, { Schema } from "mongoose";


const InventorySchema = new Schema(
    {
        product_id: { type: Schema.Types.ObjectId, ref: "Product", index: true },
        variant_id: { type: Schema.Types.ObjectId, index: true },
        warehouse_id: { type: String, default: "JKT-01" },
        on_hand: { type: Number, default: 0 },
        reserved: { type: Number, default: 0 },
    },
    { timestamps: true }
);


InventorySchema.index({ product_id: 1, variant_id: 1, warehouse_id: 1 }, { unique: true });


export default mongoose.models.Inventory || mongoose.model("Inventory", InventorySchema);