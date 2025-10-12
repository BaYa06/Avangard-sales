// /api/reset -> POST: truncate tables
import { ensureSchema } from '../db.js';
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST'); return res.status(405).end();
    }
    await ensureSchema();
    await sql`DELETE FROM events`;
    await sql`DELETE FROM managers`;
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
