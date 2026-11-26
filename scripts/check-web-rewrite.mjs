#!/usr/bin/env node
// Fails unless the built web app proxies /api/v1/* to the given API origin.
//
//   node scripts/check-web-rewrite.mjs https://api.example.com
//
// The rewrite is compiled into the build from API_ORIGIN (apps/web/next.config.js). If the
// variable doesn't reach `next build` (e.g. Turborepo's strict env mode filters it out), the
// build still succeeds but every API call from the deployed site 404s. Run after a build that
// had API_ORIGIN set to the same value.
import { readFileSync } from 'node:fs';

const origin = process.argv[2];
if (!origin) {
  console.error('Usage: node scripts/check-web-rewrite.mjs <api-origin>');
  process.exit(2);
}

const manifestPath = new URL('../apps/web/.next/routes-manifest.json', import.meta.url);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const rewrites = Array.isArray(manifest.rewrites)
  ? manifest.rewrites
  : [
      ...(manifest.rewrites?.beforeFiles ?? []),
      ...(manifest.rewrites?.afterFiles ?? []),
      ...(manifest.rewrites?.fallback ?? []),
    ];

const expected = `${origin.replace(/\/+$/, '')}/api/v1/:path*`;
const found = rewrites.some((r) => r.source === '/api/v1/:path*' && r.destination === expected);

if (!found) {
  console.error(`✗ The web build has no /api/v1 rewrite to ${expected}`);
  console.error(`  Rewrites in the build: ${JSON.stringify(rewrites)}`);
  console.error('  Was API_ORIGIN set, and passed through to `next build`?');
  process.exit(1);
}
console.log(`✓ The web build proxies /api/v1/* to ${expected}`);
