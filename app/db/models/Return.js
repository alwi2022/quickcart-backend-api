import { Schema, model, models } from "mongoose";


const ReturnItemSchema = new Schema(
    { orderItemSku: String, qty: Number, reason: String },
    { _id: false }
);


const ReturnSchema = new Schema(
    {
        orderId: { type: Schema.Types.ObjectId, ref: "Order" },
        items: [ReturnItemSchema],
        status: { type: String, enum: ["requested", "approved", "rejected", "received", "refunded"], default: "requested" },
        refund: { amount: Number, method: { type: String, default: "original" } },
    },
    { timestamps: true }
);


export default models.Return || model("Return", ReturnSchema);