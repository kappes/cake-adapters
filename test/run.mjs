// Runs every adapter against the recorded fixtures in test/fixtures, like Cake does: each script
// in its own context that only has `cake.fetch` (limited to the adapter's hosts) and `cake.log`.
//
//   node test/run.mjs            offline, from the fixtures
//   node test/run.mjs --record   fetches the pages again and rewrites the fixtures' responses
//
// A fixture is { adapter, url, expect: { title, designer, license, files: [names], browse },
// responses: [{ method, url, body, status, text }] }.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = join(import.meta.dirname, '..');
const sites = JSON.parse(readFileSync(join(root, 'sites.json'), 'utf8'));
const record = process.argv.includes('--record');

/** Loads an adapter script the way Cake's JavaScriptCore runtime does. */
export function loadAdapter(adapter) {
  const script = readFileSync(join(root, 'src', adapter.file), 'utf8');
  const context = vm.createContext({});
  vm.runInContext(script, context, { filename: adapter.file });
  if (typeof context.resolve !== 'function') throw new Error(`${adapter.id} defines no resolve(url, cake)`);
  return context.resolve;
}

function allowed(adapter, url) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  return [...adapter.hosts, ...(adapter.fetchHosts ?? [])].includes(host);
}

/** `cake` for an adapter: answers from the fixture, or from the network while recording. */
function makeCake(adapter, fixture, recorded) {
  return {
    log: (message) => console.log(`  [${adapter.id}]`, message),
    async fetch(url, options = {}) {
      if (!allowed(adapter, url)) throw new Error(`Fetching ${url} is not allowed for this adapter.`);
      const method = options.method ?? 'GET';
      const body = options.body ?? null;
      if (record) {
        const response = await fetch(url, { method, headers: options.headers, body });
        const answer = { method, url, body, status: response.status, text: await response.text() };
        recorded.push(answer);
        return { status: answer.status, url: response.url, text: answer.text, headers: {} };
      }
      const answer = fixture.responses.find((r) => r.method === method && r.url === url && r.body === body);
      if (!answer) throw new Error(`No recorded response for ${method} ${url} ${body ?? ''}`);
      return { status: answer.status, url, text: answer.text, headers: {} };
    },
  };
}

const fixtures = readdirSync(join(root, 'test/fixtures')).filter((name) => name.endsWith('.json'));
let failed = 0;
for (const name of fixtures) {
  const path = join(root, 'test/fixtures', name);
  const fixture = JSON.parse(readFileSync(path, 'utf8'));
  const adapter = sites.adapters.find((a) => a.id === fixture.adapter);
  const recorded = [];
  try {
    assert.ok(adapter, `unknown adapter ${fixture.adapter}`);
    assert.ok(allowed(adapter, fixture.url), `${fixture.url} is not a page of ${adapter.id}`);
    const resolve = loadAdapter(adapter);
    // Through JSON, as in Cake; this also drops the script context's own prototypes.
    const result = JSON.parse(JSON.stringify(await resolve(fixture.url, makeCake(adapter, fixture, recorded))));
    const actual = {
      title: result.title, designer: result.designer, license: result.license,
      files: result.files.map((f) => f.name), browse: Boolean(result.browse),
    };
    for (const file of result.files) assert.match(file.url, /^https:\/\//, `${file.name} has no https URL`);
    assert.deepEqual(actual, fixture.expect);
    if (record) writeFileSync(path, JSON.stringify({ ...fixture, responses: recorded }, null, 2) + '\n');
    console.log(`ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL ${name}\n     ${String(error.message).split('\n').join('\n     ')}`);
  }
}
console.log(`${fixtures.length - failed} of ${fixtures.length} passed`);
process.exit(failed ? 1 : 0);
