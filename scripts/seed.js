// scripts/seed.js  (ESM)
import mongoose from 'mongoose';
import { dbConnect } from '../app/db/config/mongoose.js';
import User from '../app/db/models/User.js';
import { hashPassword } from '../app/db/utils/bcrypt.js';

async function seed() {
  await dbConnect();

  const users = [
    { name: 'Admin User',    email: 'admin@example.com',    password: 'password123', roles: ['admin'] },
    { name: 'Seller User',   email: 'seller@example.com',   password: 'password123', roles: ['seller'] },
    { name: 'Customer User', email: 'customer@example.com', password: 'password123', roles: ['customer'] },
  ];

  for (const u of users) {
    const exists = await User.findOne({ email: u.email });
    if (exists) {
      console.log(`↩️  Skip: ${u.email} sudah ada`);
      continue;
    }
    const password_hash = await hashPassword(u.password);
    await User.create({
      name: u.name,
      email: u.email,
      password_hash,
      roles: u.roles,
      status: 'active',
    });
    console.log(`✅ Inserted: ${u.email} [${u.roles.join(', ')}]`);
  }
}

seed()
  .then(() => mongoose.disconnect())
  .catch((err) => {
    console.error('❌ Seed error:', err);
    mongoose.disconnect();
    process.exit(1);
  });
