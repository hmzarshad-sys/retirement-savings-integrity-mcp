// Copyright (c) 2026 Humza Arshad. MIT License (see LICENSE).
// Small RFC 4180 CSV parser (quotes, escaped quotes, CRLF), plus column mapping.

export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some(v => v !== '')) rows.push(row);
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map(h => h.trim());
  const records = rows.slice(1).map((r, i) => {
    const o = { _line: i + 2 };
    headers.forEach((h, j) => { o[h] = (r[j] ?? '').trim(); });
    return o;
  });
  return { headers, records };
}

// Rename source columns to the checker's canonical names using a mapping
// profile: { canonical_name: "Source Column Header" }.
export function applyMapping(parsed, mapping = {}, required = []) {
  const reverse = new Map();
  for (const [canon, src] of Object.entries(mapping)) reverse.set(src, canon);
  const out = parsed.records.map((r) => {
    const o = { _line: r._line };
    for (const [k, v] of Object.entries(r)) {
      if (k === '_line') continue;
      o[reverse.get(k) || k] = v;
    }
    return o;
  });
  const present = new Set(parsed.headers.map(h => reverse.get(h) || h));
  const missing = required.filter(c => !present.has(c));
  return { records: out, missing };
}

export function num(v) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = Number(String(v).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}
