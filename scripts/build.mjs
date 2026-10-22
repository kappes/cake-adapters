// Builds the adapter package Cake loads: dist/manifest.json, the scripts, and with a key
// dist/manifest.sig plus dist/adapters.zip for the release.
//
//   node scripts/build.mjs                   unsigned, e.g. to bundle with the app
//   CAKE_ADAPTERS_KEY="$(cat key.pem)" node scripts/build.mjs
//   node scripts/build.mjs --copy-to ../Cake/Resources/Adapters
//
// The manifest lists the SHA-256 of every script; the Ed25519 signature of the manifest
// therefore covers the scripts too.

import { createHash, createPrivateKey, sign } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist');
const sites = JSON.parse(readFileSync(join(root, 'sites.json'), 'utf8'));

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);

const adapters = sites.adapters.map((adapter) => {
  const script = readFileSync(join(root, 'src', adapter.file));
  writeFileSync(join(dist, adapter.file), script);
  return { ...adapter, sha256: createHash('sha256').update(script).digest('hex') };
});
const manifest = Buffer.from(JSON.stringify({ version: sites.version, adapters }, null, 2) + '\n');
writeFileSync(join(dist, 'manifest.json'), manifest);

if (process.env.CAKE_ADAPTERS_KEY) {
  const key = createPrivateKey(process.env.CAKE_ADAPTERS_KEY);
  writeFileSync(join(dist, 'manifest.sig'), sign(null, manifest, key));
  execFileSync('zip', ['-q', '-j', 'adapters.zip', 'manifest.json', 'manifest.sig', ...adapters.map((a) => a.file)],
    { cwd: dist });
  console.log('Signed package: dist/adapters.zip');
}

const copyTo = process.argv.indexOf('--copy-to');
if (copyTo > 0) {
  const target = resolve(process.argv[copyTo + 1]);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  for (const file of ['manifest.json', ...adapters.map((a) => a.file)]) cpSync(join(dist, file), join(target, file));
  console.log(`Copied to ${target}`);
}
console.log(`Package version ${sites.version} with ${adapters.length} adapters`);
