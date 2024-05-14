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






// --------------------------------------------------------


// const crypto = require('crypto');

// const algorithm = 'aes-256-cbc'; // AES encryption with 256-bit key in CBC mode
// const encryptionKey = 'your-secret-key'; // Replace with your secret key
// const iv = crypto.randomBytes(16); // Initialization Vector (IV) for AES CBC mode

// // Encrypt a value
// function encryptField(value) {
//   const cipher = crypto.createCipheriv(algorithm, Buffer.from(encryptionKey), iv);
//   let encrypted = cipher.update(value, 'utf8', 'hex');
//   encrypted += cipher.final('hex');
//   return iv.toString('hex') + ':' + encrypted;
// }

// // Decrypt an encrypted value
// function decryptField(encryptedValue) {
//   const parts = encryptedValue.split(':');
//   const decipher = crypto.createDecipheriv(algorithm, Buffer.from(encryptionKey), Buffer.from(parts.shift(), 'hex'));
//   let decrypted = decipher.update(Buffer.from(parts.join(':'), 'hex'));
//   decrypted = Buffer.concat([decrypted, decipher.final()]);
//   return decrypted.toString('utf8');
// }

// module.exports = { encryptField, decryptField };
