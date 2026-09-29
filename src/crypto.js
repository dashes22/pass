const argon2 = require('argon2');
const crypto = require('crypto');
function generatePepper() {
    return crypto.randomBytes(32).toString('hex');
}
async function hashPassword(password, pepper) {
    return await argon2.hash(password + pepper, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
    });
}
async function verifyPassword(hash, password, pepper) {
    return await argon2.verify(hash, password + pepper);
}
module.exports = { generatePepper, hashPassword, verifyPassword };