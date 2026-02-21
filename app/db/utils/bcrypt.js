// utils/crypto.js
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function hashPassword(password) {
    if (!password || typeof password !== 'string') throw new Error('Invalid password');
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    return bcrypt.hash(password, salt);
}

export async function verifyPassword(password, hash) {
    if (!password || !hash) return false;
    return bcrypt.compare(password, hash);
}
