// Copyright (c) 2026 Humza Arshad. MIT License (see LICENSE).
// Reads only inside RSI_DATA_DIR; anything outside it is refused.

import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const MAX_MB = Number(process.env.RSI_MAX_MB || 100);

function fail(code, message, suggestion) {
  const e = new Error(message); e.code = code; e.suggestion = suggestion; return e;
}

export function dataDir() {
  return process.env.RSI_DATA_DIR ? resolve(process.env.RSI_DATA_DIR) : null;
}

export async function readDataFile(rel) {
  const base = dataDir();
  if (!base) throw fail('NO_DATA_DIR', 'RSI_DATA_DIR is not set, so files cannot be read.', 'Set RSI_DATA_DIR to the folder with your census and contribution exports (see README).');
  const abs = resolve(base, rel);
  if (abs !== base && !abs.startsWith(base + sep)) throw fail('PATH_OUTSIDE_DIR', `"${rel}" is outside the data folder.`, 'Use a path relative to RSI_DATA_DIR.');
  if (!existsSync(abs)) throw fail('FILE_NOT_FOUND', `File not found: ${rel}`, 'Paths are relative to RSI_DATA_DIR.');
  const s = await stat(abs);
  if (s.size > MAX_MB * 1048576) throw fail('FILE_TOO_LARGE', `${rel} is over ${MAX_MB} MB.`, 'Raise RSI_MAX_MB if expected.');
  return readFile(abs, 'utf8');
}

// Profiles: a file in RSI_DATA_DIR, or a bundled profile name from profiles/.
export async function readProfile(ref) {
  if (!ref) return {};
  if (/^[a-z0-9-]+$/.test(ref)) {
    const bundled = new URL(`../profiles/${ref}.json`, import.meta.url);
    if (existsSync(bundled)) return JSON.parse(await readFile(bundled, 'utf8'));
  }
  return JSON.parse(await readDataFile(ref));
}
