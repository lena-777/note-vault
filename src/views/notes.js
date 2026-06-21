import {
  getNotes, createNote, updateNote, deleteNote,
  getNoteRelations, createNoteRelation, deleteNoteRelation,
  getSubtopics, getSubtopicById, getGoals, getSources, getGoalById
} from '../store/db.js';
import { toast, formatDate, relLabel, openModal, closeModal, renderTagInput } from '../utils/helpers.js';
import { navigate } from '../app.js';

export function renderNotes(filter = {}) {
  const goals = getGoals();
  let notes = getNotes(filter);
  const subtopic = filter.subtopicId ? getSubtopicById(filter.subtopicId) : null;
  const goal = subtopic ? getGoalById(subtopic.goalId) : (filter.goalId ? getGoalById(filter.goalId) : null);

  return `
    <div class="page-header">
      <div>
        <div class="page-title">重点卡片${subtopic ? ` — ${subtopic.title}` : ''}</div>
        <div class="page-subtitle">${goal ? `目标：${goal.title}` : '所有重点卡片，知识的最小单元'}</div>
      </div>
      <button class="btn btn-primary" id="btn-new-note">+ 记录重点</button>
    </div>

    ${subtopic ? `<div class="detail-back" id="back-to-goal">← 返回目标</div>` : ''}

    <div class="flex gap-8 mb-16" style="flex-wrap:wrap">
      <select class="form-select" id="filter-goal-note" style="width:200px">
        <option value="">全部目标</option>
        ${goals.map(g => `<option value="${g.id}" ${filter.goalId === g.id ? 'selected' : ''}>${g.title}</option>`).join('')}
      </select>
      <input class="form-input" id="filter-kw-note" placeholder="关键词搜索" style="width:180px" value="${filter.keyword || ''}" />
    </div>

    ${notes.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">◇</div>
        <div class="empty-text">还没有重点卡片</div>
      </div>
    ` : `
      <div class="grid-auto">
        ${notes.map(n => renderNoteCard(n)).join('')}
      </div>
    `}
  `;
}

function renderNoteCard(n) {
  const subtopic = getSubtopicById(n.subtopicId);
  const goal = subtopic ? getGoalById(subtopic.goalId) : null;
  const sources = getSources();
  const src = n.sourceId ? sources.find(s => s.id === n.sourceId) : null;
  const relations = getNoteRelations(n.id);

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
      ${(n.tags || []).length > 0 ? `
        <div class="note-tags mt-8">
          ${n.tags.map(t => `<span class="tag">${t}</span>`).join('')}
        </div>
      ` : ''}
      ${relations.length > 0 ? `
        <div class="note-relations mt-8">
          ${relations.map(r => {
            const otherId = r.fromId === n.id ? r.toId : r.fromId;
            const other = getNotes().find(x => x.id === otherId);
            const [label, cls] = relLabel(r.type);
            return `<span class="rel-badge ${cls}" title="${other?.content?.slice(0,40) || ''}">
              ${label} · ${other?.content?.slice(0,20) || '已删除'}…
              <span class="tag-remove" data-rel-id="${r.id}">×</span>
            </span>`;
          }).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

export function bindNotes(filter = {}) {
  document.getElementById('btn-new-note')?.addEventListener('click', () => showNoteModal(null, filter));

  document.getElementById('back-to-goal')?.addEventListener('click', () => {
    const sub = getSubtopicById(filter.subtopicId);
    if (sub) navigate('goal-detail', { id: sub.goalId });
    else navigate('goals');
  });

  document.getElementById('filter-goal-note')?.addEventListener('change', e => {
    navigate('notes', { goalId: e.target.value || undefined });
  });

  document.getElementById('filter-kw-note')?.addEventListener('input', e => {
    const kw = e.target.value.trim();
    if (kw.length > 1 || kw.length === 0) navigate('notes', { ...filter, keyword: kw || undefined });
  });

  document.querySelectorAll('.btn-edit-note').forEach(btn => {
    btn.addEventListener('click', () => {
      const n = getNotes().find(n => n.id === btn.dataset.id);
      if (n) showNoteModal(n, filter);
    });
  });

  document.querySelectorAll('.btn-delete-note').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('确定删除该重点卡片？')) {
        deleteNote(btn.dataset.id);
        toast('已删除', 'success');
        navigate('notes', filter);
      }
    });
  });

  document.querySelectorAll('.btn-add-rel').forEach(btn => {
    btn.addEventListener('click', () => showRelModal(btn.dataset.id, filter));
  });

  document.querySelectorAll('[data-rel-id]').forEach(span => {
    span.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('删除该关联？')) {
        deleteNoteRelation(span.dataset.relId);
        navigate('notes', filter);
      }
    });
  });
}

// ===== NOTE MODAL =====
export function showNoteModal(note = null, filter = {}) {
  const goals = getGoals();
  const allSubs = [];
  goals.forEach(g => {
    getSubtopics(g.id).forEach(s => allSubs.push({ ...s, goalTitle: g.title }));
  });
  const sources = getSources();

  openModal(`
    <div class="modal-header">
      <span class="modal-title">${note ? '编辑重点卡片' : '记录重点'}</span>
      <button class="modal-close" id="modal-close-btn">×</button>
    </div>
    <div class="form-group">
      <label class="form-label">所属子问题 *</label>
      <select class="form-select" id="note-subtopic">
        <option value="">请选择子问题</option>
        ${allSubs.map(s => `<option value="${s.id}" ${note?.subtopicId === s.id || filter.subtopicId === s.id ? 'selected' : ''}>[${s.goalTitle}] ${s.title}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">重点内容 *</label>
      <textarea class="form-textarea" id="note-content" placeholder="粘贴或输入重点内容..." style="min-height:100px">${note?.content || ''}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">原文引用（可选）</label>
      <textarea class="form-textarea" id="note-quote" placeholder="原文摘录..." style="min-height:60px">${note?.quote || ''}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">来源文章</label>
      <select class="form-select" id="note-source">
        <option value="">不关联</option>
        ${sources.map(s => `<option value="${s.id}" ${note?.sourceId === s.id ? 'selected' : ''}>${s.title}</option>`).join('')}
      </select>
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

  renderTagInput('tag-input-container', note?.tags || []);

  document.getElementById('modal-close-btn').onclick = closeModal;
  document.getElementById('modal-cancel').onclick = closeModal;
  document.getElementById('modal-save-note').onclick = () => {
    const subtopicId = document.getElementById('note-subtopic').value;
    const content = document.getElementById('note-content').value.trim();
    if (!subtopicId) { toast('请选择子问题', 'error'); return; }
    if (!content) { toast('请填写重点内容', 'error'); return; }
    const quote = document.getElementById('note-quote').value.trim();
    const sourceId = document.getElementById('note-source').value || null;
    const tags = document.getElementById('tag-input-container').getTags?.() || [];
    if (note) {
      updateNote(note.id, { subtopicId, content, quote, sourceId, tags });
      toast('已更新', 'success');
    } else {
      createNote({ subtopicId, content, quote, sourceId, tags });
      toast('已记录', 'success');
    }
    closeModal();
    navigate('notes', filter);
  };
}

// ===== RELATION MODAL =====
function showRelModal(noteId, filter) {
  const notes = getNotes().filter(n => n.id !== noteId);
  openModal(`
    <div class="modal-header">
      <span class="modal-title">建立关联</span>
      <button class="modal-close" id="modal-close-btn">×</button>
    </div>
    <div class="form-group">
      <label class="form-label">关联类型</label>
      <select class="form-select" id="rel-type">
        <option value="support">支撑 — 这张卡片支持/印证另一张</option>
        <option value="extend">补充 — 两张卡片互相补充</option>
        <option value="conflict">矛盾 — 两张卡片存在冲突</option>
        <option value="sequence">递进 — 构成递进关系</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">关联到哪张卡片</label>
      <input class="form-input" id="rel-search" placeholder="搜索卡片内容..." />
      <div id="rel-list" style="max-height:200px;overflow-y:auto;margin-top:8px;display:flex;flex-direction:column;gap:4px"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="modal-cancel">取消</button>
    </div>
  `);

  document.getElementById('modal-close-btn').onclick = closeModal;
  document.getElementById('modal-cancel').onclick = closeModal;

  let selected = null;

  function renderList(kw = '') {
    const filtered = notes.filter(n => !kw || n.content.toLowerCase().includes(kw.toLowerCase())).slice(0, 20);
    document.getElementById('rel-list').innerHTML = filtered.map(n => `
      <div class="subtopic-item ${selected === n.id ? 'active' : ''}" data-rel-note="${n.id}" style="cursor:pointer;${selected === n.id ? 'background:var(--purple-100)' : ''}">
        <span style="font-size:13px">${n.content.slice(0, 80)}${n.content.length > 80 ? '…' : ''}</span>
        ${selected === n.id ? `<button class="btn btn-sm btn-primary" id="btn-confirm-rel">确认关联</button>` : ''}
      </div>
    `).join('');

    document.querySelectorAll('[data-rel-note]').forEach(el => {
      el.addEventListener('click', () => {
        selected = el.dataset.relNote;
        renderList(document.getElementById('rel-search').value);
      });
    });

    document.getElementById('btn-confirm-rel')?.addEventListener('click', () => {
      if (!selected) return;
      const type = document.getElementById('rel-type').value;
      createNoteRelation({ fromId: noteId, toId: selected, type });
      toast('关联已建立', 'success');
      closeModal();
      navigate('notes', filter);
    });
  }

  renderList();
  document.getElementById('rel-search').addEventListener('input', e => renderList(e.target.value));
}
