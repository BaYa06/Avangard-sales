// db.js
import { sql } from '@vercel/postgres';

// Создаём таблицы лениво (первый вызов API)
export async function ensureSchema() {
  await sql`CREATE TABLE IF NOT EXISTS managers (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    target INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY,
    date DATE NOT NULL,
    manager_id UUID REFERENCES managers(id) ON DELETE SET NULL,
    sales_count INT NOT NULL DEFAULT 1,
    people INT NOT NULL DEFAULT 1,
    tour TEXT,
    amount NUMERIC(12,2) DEFAULT 0,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  )`;

  await sql`CREATE INDEX IF NOT EXISTS idx_events_date ON events(date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_events_manager ON events(manager_id)`;
}

export const db = {
  managers: {
    list: () => sql`SELECT * FROM managers ORDER BY created_at DESC`,
    insert: (m) => sql`INSERT INTO managers (id,name,target) VALUES (${m.id}, ${m.name}, ${m.target})`,
    delete: (id) => sql`DELETE FROM managers WHERE id = ${id}`
  },
  events: {
    listInRange: ({ from, to, managerId }) => {
        const has = managerId && String(managerId).trim() !== '';
        return has
        ? sql`SELECT * FROM events
                WHERE date >= ${from} AND date <= ${to} AND manager_id = ${managerId}
                ORDER BY date DESC, created_at DESC`
        : sql`SELECT * FROM events
                WHERE date >= ${from} AND date <= ${to}
                ORDER BY date DESC, created_at DESC`;
    },
    insert: (e) => sql`
        INSERT INTO events (id,date,manager_id,sales_count,people,tour,amount,comment)
        VALUES (${e.id}, ${e.date}, ${e.manager_id}, ${e.sales_count}, ${e.people}, ${e.tour}, ${e.amount}, ${e.comment})
    `,
    delete: (id) => sql`DELETE FROM events WHERE id = ${id}`
    }
};
