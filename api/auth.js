// /api/auth -> POST { managerId, password }
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
    const managerId = b.managerId?.trim();
    const password   = String(b.password ?? "");

    if (!managerId) return res.status(400).json({ error: 'managerId required' });

    const { rows } = await sql`SELECT id, name, password_hash FROM managers WHERE id = ${managerId}`;
    if (!rows.length) return res.status(404).json({ error: 'manager not found' });

    const m = rows[0];

    // Если пароль ещё не установлен — разрешим вход только с пустым паролем
    if (!m.password_hash) {
      if (password !== "") return res.status(401).json({ ok: false, error: 'password required' });
      return res.status(200).json({ ok: true, id: m.id, name: m.name });
    }

    const ok = m.password_hash === hash(password);
    if (!ok) return res.status(401).json({ ok: false, error: 'invalid password' });

    return res.status(200).json({ ok: true, id: m.id, name: m.name });
  } catch (e) {
    console.error('AUTH ERROR:', e);
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
