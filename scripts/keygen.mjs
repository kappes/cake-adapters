// Creates the Ed25519 key pair the packages are signed with.
// The private key (PEM) goes into the CAKE_ADAPTERS_KEY secret of the repository; the public
// key (base64 of the raw 32 bytes) goes into AdapterPackage.publicKey in Cake.

import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const raw = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url');
console.log(privateKey.export({ format: 'pem', type: 'pkcs8' }));
console.log('Public key for Cake:', raw.toString('base64'));
