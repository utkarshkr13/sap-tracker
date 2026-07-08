// Vercel serverless function — Postgres proxy for the Job Tree "Live Run" feature.
// Lets the browser test a connection and persist real rows into a client's Postgres
// database without exposing credentials or requiring a long-lived server.
//
// POST /api/pg  body: { connectionString, action, table?, rows?, sql?, params? }
//   action: 'test'    → SELECT 1, returns server version + current time
//           'insert'  → parameterized multi-row INSERT into `table` from `rows` (array of flat objects)
//           'query'   → run a read-only SELECT (must start with SELECT) for diagnostics
//
// A fresh pg.Client is opened and closed per request — safe for serverless, no pooling needed
// at this call volume (one job's persistence step at a time).

import pg from 'pg';
const { Client } = pg;

function sanitizeIdent(name) {
  // Postgres identifiers: letters, digits, underscore, must not start with a digit.
  const s = String(name || '').trim().replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[0-9]/.test(s) ? '_' + s : s;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  let payload = req.body;
  if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch (e) { payload = {}; } }
  const { connectionString, action = 'test', table, rows, sql, params } = payload || {};

  if (!connectionString) return res.status(400).json({ ok: false, error: 'connectionString is required' });

  const needsSsl = /sslmode=require/i.test(connectionString) || /\.(rds\.amazonaws\.com|render\.com|neon\.tech|supabase\.co)/i.test(connectionString);
  const client = new Client({ connectionString, ssl: needsSsl ? { rejectUnauthorized: false } : undefined, connectionTimeoutMillis: 8000, query_timeout: 15000 });

  try {
    await client.connect();

    if (action === 'test') {
      const r = await client.query('SELECT version() AS version, now() AS ts');
      return res.status(200).json({ ok: true, version: r.rows[0].version, ts: r.rows[0].ts });
    }

    if (action === 'query') {
      const s = String(sql || '').trim();
      if (!/^select\b/i.test(s)) return res.status(400).json({ ok: false, error: 'Only SELECT queries are allowed here' });
      const r = await client.query(s, params || []);
      return res.status(200).json({ ok: true, rows: r.rows, rowCount: r.rowCount });
    }

    if (action === 'insert') {
      if (!table) return res.status(400).json({ ok: false, error: 'table is required' });
      const list = Array.isArray(rows) ? rows : [];
      if (!list.length) return res.status(200).json({ ok: true, inserted: 0, note: 'No rows to insert' });

      const tbl = sanitizeIdent(table);
      // Union of keys across all rows, sanitized + deduped, capped to keep the statement sane.
      const keySet = new Set();
      list.forEach(r => Object.keys(r || {}).forEach(k => keySet.add(sanitizeIdent(k))));
      const cols = Array.from(keySet).slice(0, 60);
      if (!cols.length) return res.status(200).json({ ok: true, inserted: 0, note: 'No columns to insert' });

      const colList = cols.map(c => `"${c}"`).join(', ');
      const chunkSize = 200; // keep parameter count well under Postgres' limit
      let inserted = 0;
      for (let i = 0; i < list.length; i += chunkSize) {
        const chunk = list.slice(i, i + chunkSize);
        const valuesSql = [];
        const flatParams = [];
        chunk.forEach((row, ri) => {
          const ph = cols.map((c, ci) => `$${ri * cols.length + ci + 1}`);
          valuesSql.push(`(${ph.join(', ')})`);
          cols.forEach(c => {
            const orig = Object.keys(row || {}).find(k => sanitizeIdent(k) === c);
            let v = orig ? row[orig] : null;
            if (v && typeof v === 'object') v = JSON.stringify(v);
            flatParams.push(v === undefined ? null : v);
          });
        });
        const insertSql = `INSERT INTO "${tbl}" (${colList}) VALUES ${valuesSql.join(', ')} ON CONFLICT DO NOTHING`;
        const r = await client.query(insertSql, flatParams);
        inserted += r.rowCount || 0;
      }
      return res.status(200).json({ ok: true, inserted, attempted: list.length, columns: cols });
    }

    return res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e.message });
  } finally {
    try { await client.end(); } catch (e) {}
  }
}
