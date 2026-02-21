import { Schema, model, models } from "mongoose";


const EventSchema = new Schema(
    {
        type: { type: String, index: true },
        ref: { type: Schema.Types.Mixed },
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        meta: Schema.Types.Mixed,
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);


EventSchema.index({ "ref.orderId": 1, createdAt: -1 });
EventSchema.index({ createdAt: -1 });


export default models.Event || model("Event", EventSchema);