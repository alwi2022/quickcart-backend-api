//app/db/config/mongoose.js
import mongoose from "mongoose";


const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/GalaTech"
console.log(MONGODB_URI,'ini MONGODB_URI')

if (!MONGODB_URI) {
    throw new Error("Please define the MONGODB_URI env var in .env.local");
}


let cached = global.mongoose;
if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}


export async function dbConnect() {
    if (cached.conn) return cached.conn;
    if (!cached.promise) {
        cached.promise = mongoose
            .connect(MONGODB_URI, {
                bufferCommands: false,
                dbName: process.env.MONGODB_DB,
                maxPoolSize: 10,
            })
            .then((m) => m);
    }
    cached.conn = await cached.promise;
    return cached.conn;
}