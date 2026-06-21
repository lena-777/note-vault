// ===== STORE =====
// 本地 localStorage 持久化，数据结构：{ goals, subtopics, sources, notes, noteRelations }

const STORAGE_KEY = 'note-vault-data';

const defaultData = {
  goals: [],
  subtopics: [],
  sources: [],
  notes: [],
  noteRelations: [], // { id, fromId, toId, type: 'support'|'extend'|'conflict'|'sequence' }
};

let _data = null;

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    _data = raw ? { ...defaultData, ...JSON.parse(raw) } : { ...defaultData };
  } catch {
    _data = { ...defaultData };
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_data));
}

function getData() {
  if (!_data) load();
  return _data;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ===== GOALS =====
export function getGoals() { return getData().goals; }
export function getGoalById(id) { return getData().goals.find(g => g.id === id); }

export function createGoal({ title, description = '', status = 'active' }) {
  const g = { id: uid(), title, description, status, createdAt: Date.now(), updatedAt: Date.now() };
  getData().goals.push(g);
  save();
  return g;
}

export function updateGoal(id, patch) {
  const g = getData().goals.find(g => g.id === id);
  if (!g) return;
  Object.assign(g, patch, { updatedAt: Date.now() });
  save();
  return g;
}

export function deleteGoal(id) {
  const d = getData();
  d.goals = d.goals.filter(g => g.id !== id);
  const subIds = d.subtopics.filter(s => s.goalId === id).map(s => s.id);
  d.subtopics = d.subtopics.filter(s => s.goalId !== id);
  d.notes = d.notes.filter(n => !subIds.includes(n.subtopicId));
  d.sources = d.sources.filter(s => s.goalId !== id);
  save();
}

// ===== SUBTOPICS =====
export function getSubtopics(goalId) {
  const d = getData();
  return goalId ? d.subtopics.filter(s => s.goalId === goalId) : d.subtopics;
}
export function getSubtopicById(id) { return getData().subtopics.find(s => s.id === id); }

export function createSubtopic({ goalId, title, order = 0 }) {
  const s = { id: uid(), goalId, title, order, createdAt: Date.now() };
  getData().subtopics.push(s);
  save();
  return s;
}

export function updateSubtopic(id, patch) {
  const s = getData().subtopics.find(s => s.id === id);
  if (!s) return;
  Object.assign(s, patch);
  save();
  return s;
}

export function deleteSubtopic(id) {
  const d = getData();
  d.subtopics = d.subtopics.filter(s => s.id !== id);
  d.notes = d.notes.filter(n => n.subtopicId !== id);
  save();
}

// ===== SOURCES =====
export function getSources(goalId) {
  const d = getData();
  return goalId ? d.sources.filter(s => s.goalId === goalId) : d.sources;
}
export function getSourceById(id) { return getData().sources.find(s => s.id === id); }

export function createSource({ goalId, title, url = '', status = 'unread' }) {
  const s = { id: uid(), goalId, title, url, status, createdAt: Date.now(), updatedAt: Date.now() };
  getData().sources.push(s);
  save();
  return s;
}

export function updateSource(id, patch) {
  const s = getData().sources.find(s => s.id === id);
  if (!s) return;
  Object.assign(s, patch, { updatedAt: Date.now() });
  save();
  return s;
}

export function deleteSource(id) {
  const d = getData();
  d.sources = d.sources.filter(s => s.id !== id);
  save();
}

// ===== NOTES =====
export function getNotes({ subtopicId, goalId, sourceId, tag, keyword } = {}) {
  let notes = getData().notes;
  if (subtopicId) notes = notes.filter(n => n.subtopicId === subtopicId);
  if (goalId) {
    const subIds = getSubtopics(goalId).map(s => s.id);
    notes = notes.filter(n => subIds.includes(n.subtopicId));
  }
  if (sourceId) notes = notes.filter(n => n.sourceId === sourceId);
  if (tag) notes = notes.filter(n => (n.tags || []).includes(tag));
  if (keyword) {
    const kw = keyword.toLowerCase();
    notes = notes.filter(n => n.content.toLowerCase().includes(kw));
  }
  return notes;
}
export function getNoteById(id) { return getData().notes.find(n => n.id === id); }

export function createNote({ subtopicId, content, sourceId = null, tags = [], quote = '' }) {
  const n = { id: uid(), subtopicId, content, sourceId, tags, quote, createdAt: Date.now(), updatedAt: Date.now() };
  getData().notes.push(n);
  save();
  return n;
}

export function updateNote(id, patch) {
  const n = getData().notes.find(n => n.id === id);
  if (!n) return;
  Object.assign(n, patch, { updatedAt: Date.now() });
  save();
  return n;
}

export function deleteNote(id) {
  const d = getData();
  d.notes = d.notes.filter(n => n.id !== id);
  d.noteRelations = d.noteRelations.filter(r => r.fromId !== id && r.toId !== id);
  save();
}

// ===== NOTE RELATIONS =====
export function getNoteRelations(noteId) {
  return getData().noteRelations.filter(r => r.fromId === noteId || r.toId === noteId);
}

export function createNoteRelation({ fromId, toId, type }) {
  const d = getData();
  // 防重
  const exists = d.noteRelations.find(r =>
    (r.fromId === fromId && r.toId === toId) ||
    (r.fromId === toId && r.toId === fromId)
  );
  if (exists) { Object.assign(exists, { type }); save(); return exists; }
  const r = { id: uid(), fromId, toId, type, createdAt: Date.now() };
  d.noteRelations.push(r);
  save();
  return r;
}

export function deleteNoteRelation(id) {
  const d = getData();
  d.noteRelations = d.noteRelations.filter(r => r.id !== id);
  save();
}

// ===== STATS =====
export function getStats() {
  const d = getData();
  const noteCountBySubtopic = {};
  d.notes.forEach(n => {
    noteCountBySubtopic[n.subtopicId] = (noteCountBySubtopic[n.subtopicId] || 0) + 1;
  });
  const noteCountBySource = {};
  d.notes.forEach(n => {
    if (n.sourceId) noteCountBySource[n.sourceId] = (noteCountBySource[n.sourceId] || 0) + 1;
  });

  // Goal progress: ratio of subtopics with >=1 note
  const goalProgress = {};
  d.goals.forEach(g => {
    const subs = d.subtopics.filter(s => s.goalId === g.id);
    if (!subs.length) { goalProgress[g.id] = 0; return; }
    const filled = subs.filter(s => (noteCountBySubtopic[s.id] || 0) > 0).length;
    goalProgress[g.id] = Math.round((filled / subs.length) * 100);
  });

  return {
    totalGoals: d.goals.length,
    totalSubtopics: d.subtopics.length,
    totalSources: d.sources.length,
    totalNotes: d.notes.length,
    noteCountBySubtopic,
    noteCountBySource,
    goalProgress,
  };
}

// ===== IMPORT / EXPORT =====
export function exportJSON() {
  return JSON.stringify(getData(), null, 2);
}

export function exportMarkdown() {
  const d = getData();
  const stats = getStats();
  let md = '# Note Vault 导出\n\n';
  d.goals.forEach(g => {
    md += `## ${g.title}\n`;
    if (g.description) md += `> ${g.description}\n\n`;
    md += `状态: ${g.status} | 进度: ${stats.goalProgress[g.id] || 0}%\n\n`;
    const subs = d.subtopics.filter(s => s.goalId === g.id);
    subs.forEach(s => {
      md += `### ${s.title}\n\n`;
      const notes = d.notes.filter(n => n.subtopicId === s.id);
      notes.forEach(n => {
        md += `- ${n.content}\n`;
        if (n.quote) md += `  > 原文: ${n.quote}\n`;
        if (n.tags?.length) md += `  标签: ${n.tags.join(', ')}\n`;
        const src = n.sourceId ? d.sources.find(src => src.id === n.sourceId) : null;
        if (src) md += `  来源: [${src.title}](${src.url})\n`;
        md += '\n';
      });
    });
  });
  return md;
}

export function importJSON(jsonStr) {
  try {
    const imported = JSON.parse(jsonStr);
    const d = getData();
    // merge (append, avoid duplicate ids)
    ['goals', 'subtopics', 'sources', 'notes', 'noteRelations'].forEach(key => {
      if (!imported[key]) return;
      const existing = new Set(d[key].map(x => x.id));
      imported[key].forEach(item => {
        if (!existing.has(item.id)) d[key].push(item);
      });
    });
    save();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Init
load();
