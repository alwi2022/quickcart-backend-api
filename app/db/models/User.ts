//db/models/User.js
import mongoose, { Schema, type Model } from "mongoose";


const AddressSchema = new Schema(
    {
        label: String,
        receiver_name: String,
        phone: String,
        street: String,
        subdistrict: String,
        city: String,
        province: String,
        postal_code: String,
        country: { type: String, default: "ID" },
        is_default: { type: Boolean, default: false },
        geo: { lat: Number, lng: Number },
    },
    { _id: true }
);


const UserSchema = new Schema(
    {
        email: { type: String, index: true, unique: true, sparse: true },
        phone: { type: String, index: true, unique: true, sparse: true },
        name: String,
        password_hash: String,
        roles: { type: [String], default: ["customer"] },
        status: { type: String, enum: ["active", "blocked", "deleted"], default: "active" },
        default_address_id: { type: Schema.Types.ObjectId },
        addresses: [AddressSchema],
    },
    { timestamps: true }
);


const UserModel = (mongoose.models.User || mongoose.model("User", UserSchema)) as Model<Record<string, unknown>>;

export default UserModel;


