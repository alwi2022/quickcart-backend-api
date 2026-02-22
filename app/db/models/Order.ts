// app/db/models/Order.js
import { Schema, model, models, type Model } from "mongoose";

// === Item dalam order (snapshot produk di saat checkout)
const OrderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    variantId: { type: Schema.Types.ObjectId },
    sku: String,
    title: String,
    variantLabel: String,
    qty: { type: Number, required: true },
    price: {
      currency: { type: String, default: "IDR" },
      unit: { type: Number, required: true },
      subtotal: { type: Number, required: true },
    },
    weightGram: Number,
  },
  { _id: true }
);

// === Snapshot alamat saat order dibuat
const AddressSnapshotSchema = new Schema(
  {
    receiverName: String,
    phone: String,
    street: String,
    subdistrict: String,
    city: String,
    province: String,
    postalCode: String,
    country: String,
  },
  { _id: false }
);

// === Order
const OrderSchema = new Schema(
  {
    orderNo: { type: String, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    status: {
      type: String,
      enum: [
        "awaiting_payment",
        "paid",
        "processing",
        "shipped",
        "completed",
        "cancelled",
        "refunded",
      ],
      default: "awaiting_payment",
    },
    channel: { type: String, default: "web" },
    items: [OrderItemSchema],
    pricing: {
      subtotal: Number,
      discounts: [{ code: String, amount: Number }],
      shippingCost: Number,
      tax: Number,
      grandTotal: Number,
    },
    shippingAddress: AddressSnapshotSchema,
    billingAddress: AddressSnapshotSchema,
    payment: {
      paymentId: { type: Schema.Types.ObjectId, ref: "Payment" },
      method: String,
      status: {
        type: String,
        enum: ["pending", "paid", "failed", "expired"],
        default: "pending",
      },
    },
    shipment: {
      shipmentId: { type: Schema.Types.ObjectId, ref: "Shipment" },
      courier: String,
      service: String,
      trackingNo: String,
    },
    placedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Index
OrderSchema.index({ userId: 1, placedAt: -1 });
OrderSchema.index({ status: 1, placedAt: -1 });

const OrderModel = (models.Order || model("Order", OrderSchema)) as Model<Record<string, unknown>>;

export default OrderModel;


