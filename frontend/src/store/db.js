// ===== API CLIENT =====
// 替换原来的 localStorage，所有操作走后端 REST API

const BASE = '/api';

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

const get  = (path)        => req('GET',    path);
const post = (path, body)  => req('POST',   path, body);
const put  = (path, body)  => req('PUT',    path, body);
const del  = (path)        => req('DELETE', path);

// ===== GOALS =====
export async function getGoals()        { return get('/goals'); }
export async function getGoalById(id)   { const all = await get('/goals'); return all.find(g => g.id === id); }
export async function createGoal(data)  { return post('/goals', data); }
export async function updateGoal(id, p) { return put(`/goals/${id}`, p); }
export async function deleteGoal(id)    { return del(`/goals/${id}`); }

// ===== SUBTOPICS =====
export async function getSubtopics(goalId)     { return get('/subtopics' + (goalId ? `?goalId=${goalId}` : '')); }
export async function getSubtopicById(id)      { const all = await get('/subtopics'); return all.find(s => s.id === id); }
export async function createSubtopic(data)     { return post('/subtopics', data); }
export async function updateSubtopic(id, p)    { return put(`/subtopics/${id}`, p); }
export async function deleteSubtopic(id)       { return del(`/subtopics/${id}`); }

// ===== SOURCES =====
export async function getSources(goalId)    { return get('/sources' + (goalId ? `?goalId=${goalId}` : '')); }
export async function getSourceById(id)     { const all = await get('/sources'); return all.find(s => s.id === id); }
export async function createSource(data)    { return post('/sources', data); }
export async function updateSource(id, p)   { return put(`/sources/${id}`, p); }
export async function deleteSource(id)      { return del(`/sources/${id}`); }

// ===== NOTES =====
export async function getNotes(filter = {}) {
  const params = new URLSearchParams();
  if (filter.subtopicId) params.set('subtopicId', filter.subtopicId);
  if (filter.goalId)     params.set('goalId',     filter.goalId);
  if (filter.sourceId)   params.set('sourceId',   filter.sourceId);
  if (filter.keyword)    params.set('keyword',     filter.keyword);
  if (filter.tag)        params.set('tag',         filter.tag);
  const qs = params.toString();
  return get('/notes' + (qs ? `?${qs}` : ''));
}
export async function getNoteById(id)     { const all = await getNotes(); return all.find(n => n.id === id); }
export async function createNote(data)    { return post('/notes', data); }
export async function updateNote(id, p)   { return put(`/notes/${id}`, p); }
export async function deleteNote(id)      { return del(`/notes/${id}`); }

// ===== NOTE RELATIONS =====
export async function getNoteRelations(noteId) { return get(`/note-relations?noteId=${noteId}`); }
export async function createNoteRelation(data) { return post('/note-relations', data); }
export async function deleteNoteRelation(id)   { return del(`/note-relations/${id}`); }

// ===== STATS =====
export async function getStats() { return get('/stats'); }

// ===== EXPORT / IMPORT (仍走本地，生成文件) =====
export async function exportJSON() {
  const [goals, subtopics, sources, notes, noteRelations] = await Promise.all([
    getGoals(), getSubtopics(), getSources(), getNotes(), get('/note-relations'),
  ]);
  return JSON.stringify({ goals, subtopics, sources, notes, noteRelations }, null, 2);
}

export async function exportMarkdown() {
  const goals = await getGoals();
  const stats = await getStats();
  let md = '# Note Vault 导出\n\n';
  for (const g of goals) {
    md += `## ${g.title}\n`;
    if (g.description) md += `> ${g.description}\n\n`;
    md += `状态: ${g.status} | 进度: ${stats.goalProgress[g.id] || 0}%\n\n`;
    const subs = await getSubtopics(g.id);
    for (const s of subs) {
      md += `### ${s.title}\n\n`;
      const notes = await getNotes({ subtopicId: s.id });
      const srcs  = await getSources(g.id);
      for (const n of notes) {
        md += `- ${n.content}\n`;
        if (n.quote) md += `  > 原文: ${n.quote}\n`;
        if (n.tags?.length) md += `  标签: ${n.tags.join(', ')}\n`;
        const src = srcs.find(s => s.id === n.sourceId);
        if (src) md += `  来源: [${src.title}](${src.url})\n`;
        md += '\n';
      }
    }
  }
  return md;
}

export async function importJSON(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    // 逐条写入，避免 id 冲突
    for (const g of (data.goals || [])) await post('/goals', g).catch(() => {});
    for (const s of (data.subtopics || [])) await post('/subtopics', s).catch(() => {});
    for (const s of (data.sources || [])) await post('/sources', s).catch(() => {});
    for (const n of (data.notes || [])) await post('/notes', n).catch(() => {});
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
