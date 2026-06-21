const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// 静态文件服务（前端）
app.use(express.static(path.join(__dirname, '..')));

// ===== DB 连接池 =====
const pool = mysql.createPool({
  host: '9.135.133.21',
  port: 3306,
  user: 'root',
  password: 'tegroot1',
  database: 'note_vault',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
});

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function now() { return Date.now(); }

// ===== 统一错误处理 =====
function wrap(fn) {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  };
}

// ===== GOALS =====
app.get('/api/goals', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM goals ORDER BY updated_at DESC');
  res.json(rows.map(goalFromRow));
}));

app.post('/api/goals', wrap(async (req, res) => {
  const { title, description = '', status = 'active' } = req.body;
  const id = uid();
  const ts = now();
  await pool.query(
    'INSERT INTO goals (id,title,description,status,created_at,updated_at) VALUES (?,?,?,?,?,?)',
    [id, title, description, status, ts, ts]
  );
  res.json({ id, title, description, status, createdAt: ts, updatedAt: ts });
}));

app.put('/api/goals/:id', wrap(async (req, res) => {
  const { title, description, status } = req.body;
  const ts = now();
  await pool.query(
    'UPDATE goals SET title=IFNULL(?,title), description=IFNULL(?,description), status=IFNULL(?,status), updated_at=? WHERE id=?',
    [title ?? null, description ?? null, status ?? null, ts, req.params.id]
  );
  const [[row]] = await pool.query('SELECT * FROM goals WHERE id=?', [req.params.id]);
  res.json(goalFromRow(row));
}));

app.delete('/api/goals/:id', wrap(async (req, res) => {
  const id = req.params.id;
  // 级联删除
  const [subs] = await pool.query('SELECT id FROM subtopics WHERE goal_id=?', [id]);
  const subIds = subs.map(r => r.id);
  if (subIds.length) {
    await pool.query('DELETE FROM note_relations WHERE from_id IN (SELECT id FROM notes WHERE subtopic_id IN (?)) OR to_id IN (SELECT id FROM notes WHERE subtopic_id IN (?))', [subIds, subIds]);
    await pool.query('DELETE FROM notes WHERE subtopic_id IN (?)', [subIds]);
    await pool.query('DELETE FROM subtopics WHERE goal_id=?', [id]);
  }
  await pool.query('DELETE FROM sources WHERE goal_id=?', [id]);
  await pool.query('DELETE FROM goals WHERE id=?', [id]);
  res.json({ ok: true });
}));

function goalFromRow(r) {
  return { id: r.id, title: r.title, description: r.description, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at };
}

// ===== SUBTOPICS =====
app.get('/api/subtopics', wrap(async (req, res) => {
  const { goalId } = req.query;
  const [rows] = goalId
    ? await pool.query('SELECT * FROM subtopics WHERE goal_id=? ORDER BY `order`', [goalId])
    : await pool.query('SELECT * FROM subtopics ORDER BY `order`');
  res.json(rows.map(subFromRow));
}));

app.post('/api/subtopics', wrap(async (req, res) => {
  const { goalId, title, order = 0 } = req.body;
  const id = uid();
  const ts = now();
  await pool.query(
    'INSERT INTO subtopics (id,goal_id,title,`order`,created_at) VALUES (?,?,?,?,?)',
    [id, goalId, title, order, ts]
  );
  res.json({ id, goalId, title, order, createdAt: ts });
}));

app.put('/api/subtopics/:id', wrap(async (req, res) => {
  const { title, order } = req.body;
  await pool.query(
    'UPDATE subtopics SET title=IFNULL(?,title), `order`=IFNULL(?,`order`) WHERE id=?',
    [title ?? null, order ?? null, req.params.id]
  );
  const [[row]] = await pool.query('SELECT * FROM subtopics WHERE id=?', [req.params.id]);
  res.json(subFromRow(row));
}));

app.delete('/api/subtopics/:id', wrap(async (req, res) => {
  const id = req.params.id;
  await pool.query('DELETE FROM note_relations WHERE from_id IN (SELECT id FROM notes WHERE subtopic_id=?) OR to_id IN (SELECT id FROM notes WHERE subtopic_id=?)', [id, id]);
  await pool.query('DELETE FROM notes WHERE subtopic_id=?', [id]);
  await pool.query('DELETE FROM subtopics WHERE id=?', [id]);
  res.json({ ok: true });
}));

function subFromRow(r) {
  return { id: r.id, goalId: r.goal_id, title: r.title, order: r.order, createdAt: r.created_at };
}

// ===== SOURCES =====
app.get('/api/sources', wrap(async (req, res) => {
  const { goalId } = req.query;
  const [rows] = goalId
    ? await pool.query('SELECT * FROM sources WHERE goal_id=? ORDER BY created_at DESC', [goalId])
    : await pool.query('SELECT * FROM sources ORDER BY created_at DESC');
  res.json(rows.map(srcFromRow));
}));

app.post('/api/sources', wrap(async (req, res) => {
  const { goalId = null, title, url = '', status = 'unread' } = req.body;
  const id = uid();
  const ts = now();
  await pool.query(
    'INSERT INTO sources (id,goal_id,title,url,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
    [id, goalId, title, url, status, ts, ts]
  );
  res.json({ id, goalId, title, url, status, createdAt: ts, updatedAt: ts });
}));

app.put('/api/sources/:id', wrap(async (req, res) => {
  const { title, url, goalId, status } = req.body;
  const ts = now();
  await pool.query(
    'UPDATE sources SET title=IFNULL(?,title), url=IFNULL(?,url), goal_id=IFNULL(?,goal_id), status=IFNULL(?,status), updated_at=? WHERE id=?',
    [title ?? null, url ?? null, goalId ?? null, status ?? null, ts, req.params.id]
  );
  const [[row]] = await pool.query('SELECT * FROM sources WHERE id=?', [req.params.id]);
  res.json(srcFromRow(row));
}));

app.delete('/api/sources/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM sources WHERE id=?', [req.params.id]);
  res.json({ ok: true });
}));

function srcFromRow(r) {
  return { id: r.id, goalId: r.goal_id, title: r.title, url: r.url, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at };
}

// ===== NOTES =====
app.get('/api/notes', wrap(async (req, res) => {
  const { subtopicId, goalId, sourceId, tag, keyword } = req.query;
  let sql = 'SELECT * FROM notes WHERE 1=1';
  const params = [];
  if (subtopicId) { sql += ' AND subtopic_id=?'; params.push(subtopicId); }
  if (sourceId)   { sql += ' AND source_id=?';   params.push(sourceId); }
  if (keyword)    { sql += ' AND content LIKE ?'; params.push(`%${keyword}%`); }
  if (goalId) {
    sql += ' AND subtopic_id IN (SELECT id FROM subtopics WHERE goal_id=?)';
    params.push(goalId);
  }
  sql += ' ORDER BY created_at DESC';
  const [rows] = await pool.query(sql, params);
  let result = rows.map(noteFromRow);
  if (tag) result = result.filter(n => (n.tags || []).includes(tag));
  res.json(result);
}));

app.post('/api/notes', wrap(async (req, res) => {
  const { subtopicId, content, sourceId = null, tags = [], quote = '' } = req.body;
  const id = uid();
  const ts = now();
  await pool.query(
    'INSERT INTO notes (id,subtopic_id,content,quote,source_id,tags,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',
    [id, subtopicId, content, quote, sourceId, JSON.stringify(tags), ts, ts]
  );
  res.json({ id, subtopicId, content, quote, sourceId, tags, createdAt: ts, updatedAt: ts });
}));

app.put('/api/notes/:id', wrap(async (req, res) => {
  const { content, quote, subtopicId, sourceId, tags } = req.body;
  const ts = now();
  await pool.query(
    'UPDATE notes SET content=IFNULL(?,content), quote=IFNULL(?,quote), subtopic_id=IFNULL(?,subtopic_id), source_id=IFNULL(?,source_id), tags=IFNULL(?,tags), updated_at=? WHERE id=?',
    [content ?? null, quote ?? null, subtopicId ?? null, sourceId ?? null, tags != null ? JSON.stringify(tags) : null, ts, req.params.id]
  );
  const [[row]] = await pool.query('SELECT * FROM notes WHERE id=?', [req.params.id]);
  res.json(noteFromRow(row));
}));

app.delete('/api/notes/:id', wrap(async (req, res) => {
  const id = req.params.id;
  await pool.query('DELETE FROM note_relations WHERE from_id=? OR to_id=?', [id, id]);
  await pool.query('DELETE FROM notes WHERE id=?', [id]);
  res.json({ ok: true });
}));

function noteFromRow(r) {
  let tags = [];
  try { tags = typeof r.tags === 'string' ? JSON.parse(r.tags) : (r.tags || []); } catch {}
  return { id: r.id, subtopicId: r.subtopic_id, content: r.content, quote: r.quote, sourceId: r.source_id, tags, createdAt: r.created_at, updatedAt: r.updated_at };
}

// ===== NOTE RELATIONS =====
app.get('/api/note-relations', wrap(async (req, res) => {
  const { noteId } = req.query;
  const [rows] = noteId
    ? await pool.query('SELECT * FROM note_relations WHERE from_id=? OR to_id=?', [noteId, noteId])
    : await pool.query('SELECT * FROM note_relations');
  res.json(rows.map(relFromRow));
}));

app.post('/api/note-relations', wrap(async (req, res) => {
  const { fromId, toId, type } = req.body;
  // 防重
  const [[existing]] = await pool.query(
    'SELECT id FROM note_relations WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?)',
    [fromId, toId, toId, fromId]
  );
  if (existing) {
    await pool.query('UPDATE note_relations SET type=? WHERE id=?', [type, existing.id]);
    res.json({ id: existing.id, fromId, toId, type });
    return;
  }
  const id = uid();
  const ts = now();
  await pool.query('INSERT INTO note_relations (id,from_id,to_id,type,created_at) VALUES (?,?,?,?,?)', [id, fromId, toId, type, ts]);
  res.json({ id, fromId, toId, type, createdAt: ts });
}));

app.delete('/api/note-relations/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM note_relations WHERE id=?', [req.params.id]);
  res.json({ ok: true });
}));

function relFromRow(r) {
  return { id: r.id, fromId: r.from_id, toId: r.to_id, type: r.type, createdAt: r.created_at };
}

// ===== STATS =====
app.get('/api/stats', wrap(async (req, res) => {
  const [[{ totalGoals }]]    = await pool.query('SELECT COUNT(*) as totalGoals FROM goals');
  const [[{ totalSubtopics }]]= await pool.query('SELECT COUNT(*) as totalSubtopics FROM subtopics');
  const [[{ totalSources }]]  = await pool.query('SELECT COUNT(*) as totalSources FROM sources');
  const [[{ totalNotes }]]    = await pool.query('SELECT COUNT(*) as totalNotes FROM notes');

  const [notesBySub] = await pool.query('SELECT subtopic_id, COUNT(*) as cnt FROM notes GROUP BY subtopic_id');
  const noteCountBySubtopic = {};
  notesBySub.forEach(r => { noteCountBySubtopic[r.subtopic_id] = r.cnt; });

  const [notesBySrc] = await pool.query('SELECT source_id, COUNT(*) as cnt FROM notes WHERE source_id IS NOT NULL GROUP BY source_id');
  const noteCountBySource = {};
  notesBySrc.forEach(r => { noteCountBySource[r.source_id] = r.cnt; });

  const [goals] = await pool.query('SELECT id FROM goals');
  const goalProgress = {};
  for (const g of goals) {
    const [subs] = await pool.query('SELECT id FROM subtopics WHERE goal_id=?', [g.id]);
    if (!subs.length) { goalProgress[g.id] = 0; continue; }
    const filled = subs.filter(s => (noteCountBySubtopic[s.id] || 0) > 0).length;
    goalProgress[g.id] = Math.round((filled / subs.length) * 100);
  }

  res.json({ totalGoals, totalSubtopics, totalSources, totalNotes, noteCountBySubtopic, noteCountBySource, goalProgress });
}));

// ===== 启动 =====
const PORT = 3456;
app.listen(PORT, () => {
  console.log(`✅ Note Vault 服务已启动: http://localhost:${PORT}`);
});
