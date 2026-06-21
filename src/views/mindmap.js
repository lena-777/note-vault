import {
  getGoalById, updateGoal,
  getSubtopics, createSubtopic, updateSubtopic, deleteSubtopic,
  getSources, createSource, updateSource, deleteSource,
  getNotes, createNote, updateNote, deleteNote,
  getStats
} from '../store/db.js';
import { toast } from '../utils/helpers.js';
import { navigate } from '../app.js';

const NODE_TYPE = {
  goal:     { label: '目标',   color: '#7c6fd4', bg: '#f0eeff', border: '#c4b8f8', icon: '◎' },
  subtopic: { label: '子问题', color: '#3a9fd4', bg: '#eaf5ff', border: '#a8d8f8', icon: '◆' },
  source:   { label: '文章',   color: '#3aad6e', bg: '#eafaf2', border: '#a0dfc0', icon: '▤' },
  note:     { label: '重点',   color: '#c48a1a', bg: '#fef9ec', border: '#f0d080', icon: '◇' },
};

const SHORTCUT_HELP = [
  ['Enter', '添加同级节点'],
  ['Tab', '添加子节点'],
  ['Backspace', '删除空节点'],
  ['↑ / ↓', '上下移动焦点'],
  ['← / →', '折叠 / 展开'],
  ['Esc', '退出编辑'],
];

let _goalId = null;
let _expandedNodes = new Set();

async function buildTree(goalId) {
  const goal = await getGoalById(goalId);
  if (!goal) return null;
  const [subtopics, allNotes, sources, stats] = await Promise.all([
    getSubtopics(goalId),
    getNotes({ goalId }),
    getSources(goalId),
    getStats(),
  ]);
  subtopics.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const children = subtopics.map(s => {
    const notes = allNotes.filter(n => n.subtopicId === s.id);
    return {
      id: s.id, type: 'subtopic', text: s.title, rawData: s,
      noteCount: notes.length,
      children: notes.map(n => ({ id: n.id, type: 'note', text: n.content, rawData: n, children: [] })),
    };
  });

  const sourceNodes = sources.map(src => ({
    id: src.id, type: 'source', text: src.title, rawData: src, children: [],
  }));

  return {
    id: goalId, type: 'goal', text: goal.title, rawData: goal,
    progress: stats.goalProgress[goalId] || 0,
    children: [...children, ...sourceNodes],
  };
}

function renderTree(node, depth = 0) {
  if (!node) return '';
  const cfg = NODE_TYPE[node.type];
  const hasChildren = node.children?.length > 0;
  const isExpanded = _expandedNodes.has(node.id);
  const isRoot = depth === 0;

  const typeTag = `<span class="mm-type-tag" style="background:${cfg.bg};color:${cfg.color};border-color:${cfg.border}">${cfg.icon} ${cfg.label}</span>`;
  const progressBar = node.type === 'goal' ? `<div class="mm-progress"><div class="mm-progress-fill" style="width:${node.progress}%"></div></div><span class="mm-progress-label">${node.progress}%</span>` : '';
  const missingHint = node.type === 'subtopic' && node.noteCount === 0 ? `<span class="mm-missing">⚠ 缺重点</span>` : '';
  const collapseBtn = hasChildren
    ? `<button class="mm-collapse" data-node="${node.id}">${isExpanded ? '▾' : '▸'}</button>`
    : `<span class="mm-collapse-placeholder"></span>`;
  const addBtns = node.type !== 'note' ? `
    <span class="mm-actions">
      <button class="mm-act-btn mm-add-child" data-parent="${node.id}" data-ptype="${node.type}" title="Tab: 添加子节点">＋</button>
      ${node.type !== 'goal' ? `<button class="mm-act-btn mm-delete-node" data-id="${node.id}" data-type="${node.type}">×</button>` : ''}
    </span>` : `
    <span class="mm-actions">
      <button class="mm-act-btn mm-delete-node" data-id="${node.id}" data-type="${node.type}">×</button>
    </span>`;

  return `
    <div class="mm-node-wrap" data-node-id="${node.id}" data-node-type="${node.type}" data-depth="${depth}">
      <div class="mm-node ${isRoot ? 'mm-node-root' : ''} mm-node-${node.type}"
           data-id="${node.id}" data-type="${node.type}"
           style="--node-color:${cfg.color};--node-bg:${cfg.bg};--node-border:${cfg.border}">
        ${collapseBtn}
        ${typeTag}
        <span class="mm-node-text" contenteditable="true"
              data-id="${node.id}" data-type="${node.type}"
              data-placeholder="${{ goal:'输入目标...', subtopic:'输入子问题...', note:'输入重点内容...', source:'输入文章标题...' }[node.type]}"
              spellcheck="false">${escapeHtml(node.text)}</span>
        ${progressBar}${missingHint}${addBtns}
      </div>
      <div class="mm-children ${hasChildren && isExpanded ? '' : (!hasChildren ? '' : 'mm-collapsed')}" data-parent="${node.id}">
        ${(node.children || []).map(c => renderTree(c, depth + 1)).join('')}
      </div>
    </div>`;
}

function escapeHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export async function renderMindmap(goalId) {
  _goalId = goalId;
  const goal = await getGoalById(goalId);
  if (!goal) return `<div class="empty-state"><div class="empty-text">目标不存在</div></div>`;

  _expandedNodes = new Set([goalId]);
  const subs = await getSubtopics(goalId);
  subs.forEach(s => _expandedNodes.add(s.id));

  const tree = await buildTree(goalId);

  return `
    <div class="mm-toolbar">
      <button class="btn btn-secondary btn-sm" id="mm-back">← 返回</button>
      <div class="mm-title-area"><span class="mm-goal-title">${goal.title}</span></div>
      <div class="flex gap-8">
        <button class="btn btn-secondary btn-sm" id="mm-expand-all">全部展开</button>
        <button class="btn btn-secondary btn-sm" id="mm-collapse-all">全部折叠</button>
        <button class="btn btn-primary btn-sm" id="mm-view-graph">查看图谱</button>
      </div>
    </div>
    <div class="mm-shortcut-bar">
      ${SHORTCUT_HELP.map(([k, v]) => `<span class="mm-shortcut"><kbd>${k}</kbd>${v}</span>`).join('')}
      <span class="mm-shortcut" style="margin-left:auto;opacity:.5">点击节点文字直接编辑</span>
    </div>
    <div class="mm-canvas" id="mm-canvas">
      <div class="mm-tree" id="mm-tree">${renderTree(tree)}</div>
      <div class="mm-add-root-row">
        <button class="mm-add-section-btn" id="mm-add-subtopic"><span>＋ 子问题</span><kbd>Tab</kbd></button>
        <button class="mm-add-section-btn mm-add-source-btn" id="mm-add-source"><span>＋ 文章</span></button>
      </div>
    </div>`;
}

export function bindMindmap(goalId) {
  _goalId = goalId;
  document.getElementById('mm-back')?.addEventListener('click', () => navigate('goals'));
  document.getElementById('mm-view-graph')?.addEventListener('click', () => navigate('graph', { goalId }));

  document.getElementById('mm-expand-all')?.addEventListener('click', async () => {
    const tree = await buildTree(goalId);
    collectAllIds(tree).forEach(id => _expandedNodes.add(id));
    refreshTree(goalId);
  });
  document.getElementById('mm-collapse-all')?.addEventListener('click', () => {
    _expandedNodes = new Set([goalId]);
    refreshTree(goalId);
  });

  document.getElementById('mm-add-subtopic')?.addEventListener('click', () => addChildNode(goalId, 'goal'));
  document.getElementById('mm-add-source')?.addEventListener('click', () => addChildNode(goalId, 'goal', 'source'));

  bindTreeEvents(goalId);
}

function collectAllIds(node) {
  if (!node) return [];
  return [node.id, ...(node.children || []).flatMap(collectAllIds)];
}

function bindTreeEvents(goalId) {
  const tree = document.getElementById('mm-tree');
  if (!tree) return;

  tree.querySelectorAll('.mm-collapse').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      const id = btn.dataset.node;
      if (_expandedNodes.has(id)) _expandedNodes.delete(id); else _expandedNodes.add(id);
      refreshTree(goalId);
    };
  });

  tree.querySelectorAll('.mm-add-child').forEach(btn => {
    btn.onclick = e => { e.stopPropagation(); addChildNode(btn.dataset.parent, btn.dataset.ptype); };
  });

  tree.querySelectorAll('.mm-delete-node').forEach(btn => {
    btn.onclick = e => { e.stopPropagation(); deleteNode(btn.dataset.id, btn.dataset.type, goalId); };
  });

  tree.querySelectorAll('[contenteditable]').forEach(el => {
    el.addEventListener('blur', () => {
      const text = el.textContent.trim();
      if (text) saveNodeText(el.dataset.id, el.dataset.type, text);
    });
    el.addEventListener('keydown', e => handleKeydown(e, el, el.dataset.id, el.dataset.type, goalId));
    el.addEventListener('paste', e => {
      e.preventDefault();
      document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
    });
  });
}

function handleKeydown(e, el, id, type, goalId) {
  const text = el.textContent.trim();

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (text) saveNodeText(id, type, text);
    if (type === 'goal') { addChildNode(id, 'goal'); return; }
    addSiblingNode(id, type, goalId);
    return;
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    if (text) saveNodeText(id, type, text);
    if (type === 'goal') addChildNode(id, 'goal');
    else if (type === 'subtopic') addChildNode(id, 'subtopic');
    return;
  }
  if (e.key === 'Backspace' && text === '') {
    e.preventDefault();
    const prev = getPrevNode(el);
    deleteNode(id, type, goalId);
    if (prev) setTimeout(() => focusNode(prev), 30);
    return;
  }
  if (e.key === 'Escape') { el.blur(); return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); const n = getNextNode(el); if (n) focusNode(n); return; }
  if (e.key === 'ArrowUp')   { e.preventDefault(); const p = getPrevNode(el); if (p) focusNode(p); return; }
  if (e.key === 'ArrowLeft') { e.preventDefault(); _expandedNodes.delete(id); refreshTree(goalId, id); return; }
  if (e.key === 'ArrowRight'){ e.preventDefault(); _expandedNodes.add(id);    refreshTree(goalId, id); return; }
}

function getAllEditableNodes() { return [...document.querySelectorAll('#mm-tree [contenteditable]')]; }
function getNextNode(el) { const a = getAllEditableNodes(); const i = a.indexOf(el); return i < a.length - 1 ? a[i+1] : null; }
function getPrevNode(el) { const a = getAllEditableNodes(); const i = a.indexOf(el); return i > 0 ? a[i-1] : null; }
function focusNode(el) {
  el.focus();
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
  const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
}

async function saveNodeText(id, type, text) {
  if (!text.trim()) return;
  if (type === 'goal')     await updateGoal(id, { title: text });
  else if (type === 'subtopic') await updateSubtopic(id, { title: text });
  else if (type === 'note')     await updateNote(id, { content: text });
  else if (type === 'source')   await updateSource(id, { title: text });
}

async function addChildNode(parentId, parentType, forceType = null) {
  let newId;
  if (parentType === 'goal') {
    const type = forceType || 'subtopic';
    if (type === 'source') {
      const src = await createSource({ goalId: parentId, title: '' });
      newId = src.id;
    } else {
      const subs = await getSubtopics(parentId);
      const sub = await createSubtopic({ goalId: parentId, title: '', order: subs.length });
      newId = sub.id;
    }
  } else if (parentType === 'subtopic') {
    const note = await createNote({ subtopicId: parentId, content: '' });
    newId = note.id;
  }
  _expandedNodes.add(parentId);
  refreshTree(_goalId, newId);
}

async function addSiblingNode(siblingId, type, goalId) {
  let newId;
  if (type === 'subtopic') {
    const subs = await getSubtopics(goalId);
    const cur = subs.find(s => s.id === siblingId);
    const sub = await createSubtopic({ goalId, title: '', order: (cur?.order ?? 0) + 1 });
    newId = sub.id;
    _expandedNodes.add(goalId);
  } else if (type === 'note') {
    const notes = await getNotes();
    const sibling = notes.find(n => n.id === siblingId);
    if (sibling) {
      const note = await createNote({ subtopicId: sibling.subtopicId, content: '' });
      newId = note.id;
      _expandedNodes.add(sibling.subtopicId);
    }
  } else if (type === 'source') {
    const src = await createSource({ goalId, title: '' });
    newId = src.id;
    _expandedNodes.add(goalId);
  }
  if (newId) refreshTree(goalId, newId);
}

async function deleteNode(id, type, goalId) {
  if (type === 'goal') return;
  if (type === 'subtopic') await deleteSubtopic(id);
  else if (type === 'note') await deleteNote(id);
  else if (type === 'source') await deleteSource(id);
  refreshTree(goalId);
}

async function refreshTree(goalId, focusId = null) {
  const treeEl = document.getElementById('mm-tree');
  if (!treeEl) return;
  const tree = await buildTree(goalId);
  treeEl.innerHTML = renderTree(tree);
  bindTreeEvents(goalId);
  if (focusId) {
    setTimeout(() => {
      const el = treeEl.querySelector(`[contenteditable][data-id="${focusId}"]`);
      if (el) focusNode(el);
    }, 20);
  }
}
