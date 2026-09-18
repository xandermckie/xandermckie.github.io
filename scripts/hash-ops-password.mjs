#!/usr/bin/env node
import { pbkdf2Sync, randomBytes } from 'node:crypto';

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-ops-password.mjs <password>');
  process.exit(1);
}

const iterations = 210_000;
const salt = randomBytes(16).toString('hex');
const hash = pbkdf2Sync(password, Buffer.from(salt, 'hex'), iterations, 32, 'sha256').toString('hex');
console.log(`OPS_PASSWORD_SALT=${salt}`);
console.log(`OPS_PASSWORD_HASH=${hash}`);
