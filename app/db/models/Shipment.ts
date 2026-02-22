// models/Shipment.js
import { Schema, model, models, type Model } from "mongoose";


const ShipmentHistorySchema = new Schema(
    { status: String, at: Date },
    { _id: false }
);


const ShipmentSchema = new Schema(
    {
        orderId: { type: Schema.Types.ObjectId, ref: "Order", unique: true },
        warehouseId: { type: String, default: "MAIN" },
        courier: String,
        service: String,
        trackingNo: { type: String, unique: true, sparse: true },
        status: { type: String, enum: ["packed", "shipped", "in_transit", "delivered", "failed"], default: "packed" },
        history: [ShipmentHistorySchema],
    },
    { timestamps: true }
);


const ShipmentModel = (models.Shipment || model("Shipment", ShipmentSchema)) as Model<Record<string, unknown>>;

export default ShipmentModel;


