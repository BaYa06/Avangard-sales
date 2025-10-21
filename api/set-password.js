// /api/set-password -> POST { managerId, newPassword }
import { sql } from '@vercel/postgres';
import { createHash } from 'node:crypto';

function hash(pwd = "") {
  return createHash('sha256').update(String(pwd)).digest('hex');
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body || {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }
  try {
    const b = parseBody(req);
    const managerId   = b.managerId?.trim();
    const newPassword = String(b.newPassword ?? "");

    if (!managerId || !newPassword) {
      return res.status(400).json({ error: 'managerId and newPassword required' });
    }

    await sql`UPDATE managers SET password_hash = ${hash(newPassword)} WHERE id = ${managerId}`;
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('SET-PASS ERROR:', e);
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
