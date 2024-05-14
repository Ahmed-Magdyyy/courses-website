const crypto = require('crypto');

// Encryption and decryption key (use a secure key, preferably from environment variables)
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;

// Encryption function
function encryptField(value) {
  const cipher = crypto.createCipher('aes-256-cbc', JWT_SECRET_KEY);
  let encryptedValue = cipher.update(value, 'utf8', 'hex');
  encryptedValue += cipher.final('hex');
  return encryptedValue;
}

// Decryption function
function decryptField(encryptedValue) {
  const decipher = crypto.createDecipher('aes-256-cbc', JWT_SECRET_KEY);
  let decryptedValue = decipher.update(encryptedValue, 'hex', 'utf8');
  decryptedValue += decipher.final('utf8');
  return decryptedValue;
}

module.exports = { encryptField, decryptField };
