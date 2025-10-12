const express = require('express');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const dataDir = path.join(__dirname, '..', 'data');
const dbFile = path.join(dataDir, 'sales.sqlite');
if(!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, {recursive:true});

let SQL, db;

// Load/initialize SQLite (sql.js)
async function openDb(){
  if(SQL && db) return db;
  SQL = await initSqlJs({
    locateFile: (file) => require.resolve('sql.js/dist/' + file)
  });
  if(fs.existsSync(dbFile)){
    const bytes = fs.readFileSync(dbFile);
    db = new SQL.Database(bytes);
  }else{
    db = new SQL.Database();
    bootstrap();
    persist();
  }
  return db;
}

function persist(){
  const data = db.export();
  fs.writeFileSync(dbFile, Buffer.from(data));
}

function bootstrap(){
  db.exec(`
    CREATE TABLE IF NOT EXISTS managers(
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      target INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS events(
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      manager_id TEXT REFERENCES managers(id) ON DELETE SET NULL,
      sales_count INTEGER NOT NULL DEFAULT 1,
      people INTEGER NOT NULL DEFAULT 0,
      tour TEXT,
      amount REAL DEFAULT 0,
      comment TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
    CREATE INDEX IF NOT EXISTS idx_events_manager ON events(manager_id);
  `);
  // seed
  const mgrs = [['Байырбек',50],['Айжан',40],['Нурбек',35]];
  const insM = db.prepare('INSERT OR IGNORE INTO managers(id,name,target) VALUES(?,?,?)');
  mgrs.forEach(([name, target]) => insM.run([randomUUID(), name, target]));
  insM.free();
  const today = new Date();
  function toYMD(d){ return d.toISOString().slice(0,10); }
  const ids = [];
  const stmtIds = db.prepare('SELECT id FROM managers ORDER BY name');
  while(stmtIds.step()){ ids.push(stmtIds.getAsObject().id); }
  stmtIds.free();
  const insE = db.prepare('INSERT INTO events(id,date,manager_id,sales_count,people,tour,amount,comment) VALUES(?,?,?,?,?,?,?,?)');
  for(let i=0;i<7;i++){
    const d = new Date(); d.setDate(today.getDate()-i);
    const date = toYMD(d);
    const sales = (i%3);
    for(let s=0;s<sales;s++){
      const mid = ids[(i+s)%ids.length];
      insE.run([randomUUID(), date, mid, 1, 1+((i+s)%3), '', 0, 'seed']);
    }
  }
  insE.free();
}

// Helper to run SELECT returning array of objects
function all(sql, params=[]){
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while(stmt.step()){
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}
// Helper to run write queries
function run(sql, params=[]){
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
}

// API endpoints
app.get('/api/managers', async (req,res)=>{
  await openDb();
  const rows = all('SELECT * FROM managers ORDER BY name');
  res.json(rows);
});
app.post('/api/managers', async (req,res)=>{
  await openDb();
  const {name, target=0} = req.body||{};
  if(!name) return res.status(400).send('name required');
  const id = randomUUID();
  try{
    run('INSERT INTO managers(id,name,target) VALUES(?,?,?)', [id, String(name), Number(target)||0]);
    persist();
    const row = all('SELECT * FROM managers WHERE id=?', [id])[0];
    res.json(row);
  }catch(e){ res.status(400).send(String(e.message||e)); }
});
app.put('/api/managers/:id', async (req,res)=>{
  await openDb();
  const id = req.params.id;
  const old = all('SELECT * FROM managers WHERE id=?', [id])[0];
  if(!old) return res.status(404).send('not found');
  const {name=old.name, target=old.target} = req.body||{};
  run('UPDATE managers SET name=?, target=? WHERE id=?', [String(name), Number(target)||0, id]);
  persist();
  res.json(all('SELECT * FROM managers WHERE id=?', [id])[0]);
});
app.delete('/api/managers/:id', async (req,res)=>{
  await openDb();
  run('DELETE FROM managers WHERE id=?', [req.params.id]);
  persist();
  res.json({ok:true});
});

function isYMD(s){ return /^\d{4}-\d{2}-\d{2}$/.test(s); }

app.get('/api/events', async (req,res)=>{
  await openDb();
  const {from='0001-01-01', to='9999-12-31', managerId=''} = req.query;
  if(!isYMD(from) || !isYMD(to)) return res.status(400).send('from/to must be YYYY-MM-DD');
  const rows = all(`
    SELECT e.id, e.date, e.sales_count as salesCount, e.people, e.tour, e.amount, e.comment,
           m.id as managerId, m.name as managerName
    FROM events e
    LEFT JOIN managers m ON m.id = e.manager_id
    WHERE e.date >= ? AND e.date <= ? AND (? = '' OR e.manager_id = ?)
    ORDER BY e.date DESC, e.created_at DESC
  `, [from, to, managerId, managerId]);
  res.json(rows);
});

app.post('/api/events', async (req,res)=>{
  await openDb();
  const {date, managerId=null, salesCount=1, people=0, tour='', amount=0, comment=''} = req.body||{};
  if(!isYMD(date)) return res.status(400).send('date must be YYYY-MM-DD');
  const id = randomUUID();
  run(`INSERT INTO events(id,date,manager_id,sales_count,people,tour,amount,comment)
       VALUES(?,?,?,?,?,?,?,?)`,
       [id, date, managerId, Number(salesCount)||1, Number(people)||0, String(tour||''), Number(amount)||0, String(comment||'')]);
  persist();
  const row = all('SELECT * FROM events WHERE id=?', [id])[0];
  res.json(row);
});

app.put('/api/events/:id', async (req,res)=>{
  await openDb();
  const id = req.params.id;
  const old = all('SELECT * FROM events WHERE id=?', [id])[0];
  if(!old) return res.status(404).send('not found');
  const {date, managerId, salesCount, people, tour, amount, comment} = req.body||{};
  const nd = (date && isYMD(date)) ? date : old.date;
  run(`UPDATE events SET date=?, manager_id=?, sales_count=?, people=?, tour=?, amount=?, comment=? WHERE id=?`,
      [nd, managerId ?? old.manager_id, Number(salesCount ?? old.sales_count), Number(people ?? old.people),
       tour ?? old.tour, Number(amount ?? old.amount), comment ?? old.comment, id]);
  persist();
  res.json(all('SELECT * FROM events WHERE id=?', [id])[0]);
});

app.delete('/api/events/:id', async (req,res)=>{
  await openDb();
  run('DELETE FROM events WHERE id=?', [req.params.id]);
  persist();
  res.json({ok:true});
});

app.get('/api/aggregates', async (req,res)=>{
  await openDb();
  const {from='0001-01-01', to='9999-12-31'} = req.query;
  if(!isYMD(from) || !isYMD(to)) return res.status(400).send('from/to must be YYYY-MM-DD');
  // managers with events
  const rows1 = all(`
    SELECT m.id as managerId, m.name as managerName, m.target as target,
           SUM(e.sales_count) as sales, SUM(e.people) as people
    FROM managers m
    LEFT JOIN events e ON e.manager_id = m.id AND e.date >= ? AND e.date <= ?
    GROUP BY m.id, m.name, m.target
    HAVING sales IS NOT NULL OR people IS NOT NULL
  `,[from,to]);
  // events with NULL manager (group as "—")
  const rows2 = all(`
    SELECT NULL as managerId, '—' as managerName, 0 as target,
           SUM(e.sales_count) as sales, SUM(e.people) as people
    FROM events e
    WHERE e.manager_id IS NULL AND e.date >= ? AND e.date <= ?
  `,[from,to]);
  const rows = rows1.concat(rows2).filter(r=>r.sales || r.people).sort((a,b)=> (b.people||0)-(a.people||0) || (b.sales||0)-(a.sales||0) || String(a.managerName).localeCompare(String(b.managerName)));
  res.json(rows);
});

app.get('/api/backup', async (req,res)=>{
  await openDb();
  const managers = all('SELECT * FROM managers');
  const events = all('SELECT * FROM events');
  res.json({managers, events});
});

app.post('/api/restore', async (req,res)=>{
  await openDb();
  const body = req.body || {};
  const managers = Array.isArray(body.managers) ? body.managers : [];
  const events = Array.isArray(body.events) ? body.events : [];
  db.exec('DELETE FROM events; DELETE FROM managers;');
  const insM = db.prepare('INSERT INTO managers(id,name,target) VALUES(?,?,?)');
  managers.forEach(m => insM.run([m.id || randomUUID(), String(m.name), Number(m.target)||0]));
  insM.free();
  const insE = db.prepare('INSERT INTO events(id,date,manager_id,sales_count,people,tour,amount,comment,created_at) VALUES(?,?,?,?,?,?,?,?,?)');
  events.forEach(e => insE.run([e.id || randomUUID(), e.date, e.manager_id || null, Number(e.sales_count)||1, Number(e.people)||0, String(e.tour||''), Number(e.amount||0), String(e.comment||''), e.created_at || new Date().toISOString()]));
  insE.free();
  persist();
  res.json({ok:true});
});

app.post('/api/reset', async (req,res)=>{
  await openDb();
  db.exec('DELETE FROM events;');
  persist();
  res.json({ok:true});
});

// SPA fallback
app.get('*', (req,res)=>{
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, async ()=>{
  await openDb();
  console.log('Server started on http://localhost:'+PORT);
});
