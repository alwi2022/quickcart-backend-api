import mongoose from 'mongoose';
import { dbConnect } from '../app/db/config/mongoose';
import UserModel from '../app/db/models/User';
import { hashPassword } from '../app/db/utils/bcrypt';

type SeedUser = {
  name: string;
  email: string;
  password: string;
  roles: string[];
};

async function seed(): Promise<void> {
  await dbConnect();

  const users: SeedUser[] = [
    { name: 'Admin User', email: 'admin@example.com', password: 'password123', roles: ['admin'] },
    { name: 'Seller User', email: 'seller@example.com', password: 'password123', roles: ['seller'] },
    { name: 'Customer User', email: 'customer@example.com', password: 'password123', roles: ['customer'] },
  ];

  for (const user of users) {
    const exists = await UserModel.findOne({ email: user.email });
    if (exists) {
      console.log(`Skip: ${user.email} already exists`);
      continue;
    }

    const password_hash = await hashPassword(user.password);
    await UserModel.create({
      name: user.name,
      email: user.email,
      password_hash,
      roles: user.roles,
      status: 'active',
    });
    console.log(`Inserted: ${user.email} [${user.roles.join(', ')}]`);
  }
}

void seed()
  .then(() => mongoose.disconnect())
  .catch((err: unknown) => {
    console.error('Seed error:', err);
    mongoose.disconnect();
    process.exit(1);
  });
