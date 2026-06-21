import {
  getNotes, createNote, updateNote, deleteNote,
  getNoteRelations, createNoteRelation, deleteNoteRelation,
  getSubtopics, getSubtopicById, getGoals, getSources, getGoalById
} from '../store/db.js';
import { toast, formatDate, relLabel, openModal, closeModal, renderTagInput, cSelect, initCustomSelects, getCSelectValue } from '../utils/helpers.js';
import { navigate } from '../app.js';

export async function renderNotes(filter = {}) {
  const [goals, notes] = await Promise.all([getGoals(), getNotes(filter)]);
  const subtopic = filter.subtopicId ? await getSubtopicById(filter.subtopicId) : null;
  const goal = subtopic ? await getGoalById(subtopic.goalId) : (filter.goalId ? await getGoalById(filter.goalId) : null);

  const goalOptions = [{ value: '', label: '全部目标' }, ...goals.map(g => ({ value: g.id, label: g.title }))];

  // 为每张卡片预加载 subtopic/goal/source 信息
  const allSubtopics = await getSubtopics();
  const allSources = await getSources();
  const subMap = Object.fromEntries(allSubtopics.map(s => [s.id, s]));
  const srcMap = Object.fromEntries(allSources.map(s => [s.id, s]));
  const goalMap = Object.fromEntries(goals.map(g => [g.id, g]));

  return `
    <div class="page-header">
      <div>
        <div class="page-title">重点卡片${subtopic ? ` — ${subtopic.title}` : ''}</div>
        <div class="page-subtitle">${goal ? `目标：${goal.title}` : '所有重点卡片，知识的最小单元'}</div>
      </div>
      <button class="btn btn-primary" id="btn-new-note">+ 记录重点</button>
    </div>
    ${subtopic ? `<div class="detail-back" id="back-to-goal">← 返回目标</div>` : ''}
    <div class="flex gap-8 mb-16" style="flex-wrap:wrap;align-items:center">
      ${cSelect('filter-goal-note', goalOptions, filter.goalId || '', { style: 'width:200px' })}
      <input class="form-input" id="filter-kw-note" placeholder="关键词搜索" style="width:180px" value="${filter.keyword || ''}" />
    </div>
    ${notes.length === 0 ? `<div class="empty-state"><div class="empty-icon">◇</div><div class="empty-text">还没有重点卡片</div></div>` : `
      <div class="grid-auto">
        ${notes.map(n => {
          const sub = subMap[n.subtopicId];
          const g = sub ? goalMap[sub.goalId] : null;
          const src = n.sourceId ? srcMap[n.sourceId] : null;
          return renderNoteCard(n, sub, g, src);
        }).join('')}
      </div>`}
  `;
}

function renderNoteCard(n, subtopic, goal, src, relations = []) {
  return `
    <div class="card note-card" data-note-id="${n.id}">
      <div class="note-actions">
        <button class="btn btn-sm btn-secondary btn-edit-note" data-id="${n.id}">编辑</button>
        <button class="btn btn-sm btn-secondary btn-add-rel" data-id="${n.id}">关联</button>
        <button class="btn btn-sm btn-danger btn-delete-note" data-id="${n.id}">删除</button>
      </div>
      <div class="note-content">${n.content}</div>
      ${n.quote ? `<div class="text-sm text-muted" style="border-left:2px solid var(--purple-200);padding-left:8px;margin-bottom:8px;font-style:italic">"${n.quote}"</div>` : ''}
      <div class="note-footer">
        <div class="flex gap-4" style="flex-wrap:wrap">
          ${subtopic ? `<span class="badge badge-purple">${subtopic.title}</span>` : ''}
          ${goal ? `<span class="badge badge-gray text-sm">${goal.title}</span>` : ''}
          ${src ? `<a href="${src.url || '#'}" target="_blank" class="note-source-link">↗ ${src.title}</a>` : ''}
        </div>
        <span class="text-sm text-muted">${formatDate(n.updatedAt)}</span>
      </div>
      ${(n.tags || []).length > 0 ? `<div class="note-tags mt-8">${n.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
    </div>`;
}

export function bindNotes(filter = {}) {
  initCustomSelects((id, value) => {
    if (id === 'filter-goal-note') navigate('notes', { goalId: value || undefined });
  });

  document.getElementById('btn-new-note')?.addEventListener('click', () => showNoteModal(null, filter));

  document.getElementById('back-to-goal')?.addEventListener('click', async () => {
    const sub = filter.subtopicId ? await getSubtopicById(filter.subtopicId) : null;
    if (sub) navigate('mindmap', { id: sub.goalId });
    else navigate('goals');
  });

  document.getElementById('filter-kw-note')?.addEventListener('input', e => {
    const kw = e.target.value.trim();
    if (kw.length > 1 || kw.length === 0) navigate('notes', { ...filter, keyword: kw || undefined });
  });

  document.querySelectorAll('.btn-edit-note').forEach(btn => {
    btn.addEventListener('click', async () => {
      const notes = await getNotes();
      const n = notes.find(n => n.id === btn.dataset.id);
      if (n) showNoteModal(n, filter);
    });
  });

  document.querySelectorAll('.btn-delete-note').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('确定删除该重点卡片？')) {
        await deleteNote(btn.dataset.id);
        toast('已删除', 'success');
        navigate('notes', filter);
      }
    });
  });

  document.querySelectorAll('.btn-add-rel').forEach(btn => {
    btn.addEventListener('click', () => showRelModal(btn.dataset.id, filter));
  });
}

export async function showNoteModal(note = null, filter = {}) {
  const goals = await getGoals();
  const allSubs = [];
  for (const g of goals) {
    const subs = await getSubtopics(g.id);
    subs.forEach(s => allSubs.push({ ...s, goalTitle: g.title }));
  }
  const sources = await getSources();

  const subtopicOptions = [{ value: '', label: '请选择子问题' }, ...allSubs.map(s => ({ value: s.id, label: `[${s.goalTitle}] ${s.title}` }))];
  const sourceOptions = [{ value: '', label: '不关联' }, ...sources.map(s => ({ value: s.id, label: s.title }))];

  openModal(`
    <div class="modal-header">
      <span class="modal-title">${note ? '编辑重点卡片' : '记录重点'}</span>
      <button class="modal-close" id="modal-close-btn">×</button>
    </div>
    <div class="form-group">
      <label class="form-label">所属子问题 *</label>
      ${cSelect('note-subtopic', subtopicOptions, note?.subtopicId || filter.subtopicId || '', { style: 'width:100%', placeholder: '请选择子问题' })}
    </div>
    <div class="form-group">
      <label class="form-label">重点内容 *</label>
      <textarea class="form-textarea" id="note-content" style="min-height:100px">${note?.content || ''}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">原文引用（可选）</label>
      <textarea class="form-textarea" id="note-quote" style="min-height:60px">${note?.quote || ''}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">来源文章</label>
      ${cSelect('note-source', sourceOptions, note?.sourceId || '', { style: 'width:100%', placeholder: '不关联' })}
    </div>
    <div class="form-group">
      <label class="form-label">标签</label>
      <div id="tag-input-container"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="modal-cancel">取消</button>
      <button class="btn btn-primary" id="modal-save-note">保存</button>
    </div>
  `);
  initCustomSelects();
  renderTagInput('tag-input-container', note?.tags || []);
  document.getElementById('modal-close-btn').onclick = closeModal;
  document.getElementById('modal-cancel').onclick = closeModal;
  document.getElementById('modal-save-note').onclick = async () => {
    const subtopicId = getCSelectValue('note-subtopic');
    const content = document.getElementById('note-content').value.trim();
    if (!subtopicId) { toast('请选择子问题', 'error'); return; }
    if (!content) { toast('请填写重点内容', 'error'); return; }
    const quote = document.getElementById('note-quote').value.trim();
    const sourceId = getCSelectValue('note-source') || null;
    const tags = document.getElementById('tag-input-container').getTags?.() || [];
    if (note) { await updateNote(note.id, { subtopicId, content, quote, sourceId, tags }); toast('已更新', 'success'); }
    else { await createNote({ subtopicId, content, quote, sourceId, tags }); toast('已记录', 'success'); }
    closeModal();
    navigate('notes', filter);
  };
}

async function showRelModal(noteId, filter) {
  const allNotes = await getNotes();
  const notes = allNotes.filter(n => n.id !== noteId);
  const relTypeOptions = [
    { value:'support',label:'支撑 — 支持/印证另一张'},{value:'extend',label:'补充 — 互相补充'},
    { value:'conflict',label:'矛盾 — 存在冲突'},{value:'sequence',label:'递进 — 构成递进关系'},
  ];
  openModal(`
    <div class="modal-header">
      <span class="modal-title">建立关联</span>
      <button class="modal-close" id="modal-close-btn">×</button>
    </div>
    <div class="form-group">
      <label class="form-label">关联类型</label>
      ${cSelect('rel-type', relTypeOptions, 'support', { style: 'width:100%' })}
    </div>
    <div class="form-group">
      <label class="form-label">关联到哪张卡片</label>
      <input class="form-input" id="rel-search" placeholder="搜索卡片内容..." />
      <div id="rel-list" style="max-height:200px;overflow-y:auto;margin-top:8px;display:flex;flex-direction:column;gap:4px"></div>
    </div>
    <div class="modal-footer"><button class="btn btn-secondary" id="modal-cancel">取消</button></div>
  `);
  initCustomSelects();
  document.getElementById('modal-close-btn').onclick = closeModal;
  document.getElementById('modal-cancel').onclick = closeModal;
  let selected = null;
  function renderList(kw = '') {
    const filtered = notes.filter(n => !kw || n.content.toLowerCase().includes(kw.toLowerCase())).slice(0, 20);
    document.getElementById('rel-list').innerHTML = filtered.map(n => `
      <div class="subtopic-item" data-rel-note="${n.id}" style="cursor:pointer;${selected===n.id?'background:var(--purple-50)':''}">
        <span style="font-size:13px">${n.content.slice(0,80)}${n.content.length>80?'…':''}</span>
        ${selected===n.id?`<button class="btn btn-sm btn-primary" id="btn-confirm-rel">确认关联</button>`:''}
      </div>`).join('');
    document.querySelectorAll('[data-rel-note]').forEach(el => {
      el.addEventListener('click', () => { selected = el.dataset.relNote; renderList(document.getElementById('rel-search').value); });
    });
    document.getElementById('btn-confirm-rel')?.addEventListener('click', async () => {
      if (!selected) return;
      const type = getCSelectValue('rel-type') || 'support';
      await createNoteRelation({ fromId: noteId, toId: selected, type });
      toast('关联已建立', 'success');
      closeModal();
      navigate('notes', filter);
    });
  }
  renderList();
  document.getElementById('rel-search').addEventListener('input', e => renderList(e.target.value));
}
