import {
  getGoalById, updateGoal,
  getSubtopics, createSubtopic, updateSubtopic, deleteSubtopic,
  getSources, createSource, updateSource, deleteSource,
  getNotes, createNote, updateNote, deleteNote,
  getStats
} from '../store/db.js';
import { toast } from '../utils/helpers.js';
import { navigate } from '../app.js';

// ===== 节点类型配置 =====
const NODE_TYPE = {
  goal:     { label: '目标',   color: '#7c6fd4', bg: '#f0eeff', border: '#c4b8f8', icon: '◎' },
  subtopic: { label: '子问题', color: '#3a9fd4', bg: '#eaf5ff', border: '#a8d8f8', icon: '◆' },
  source:   { label: '文章',   color: '#3aad6e', bg: '#eafaf2', border: '#a0dfc0', icon: '▤' },
  note:     { label: '重点',   color: '#c48a1a', bg: '#fef9ec', border: '#f0d080', icon: '◇' },
};

// ===== 快捷键帮助 =====
const SHORTCUT_HELP = [
  ['Enter',     '添加同级节点'],
  ['Tab',       '添加子节点'],
  ['Backspace', '删除空节点'],
  ['↑ / ↓',    '上下移动焦点'],
  ['← / →',    '折叠 / 展开'],
  ['Esc',       '取消编辑'],
];

// ===== 全局状态 =====
let _goalId = null;
let _expandedNodes = new Set(); // 折叠状态

// ===== 构建树结构 =====
function buildTree(goalId) {
  const goal = getGoalById(goalId);
  if (!goal) return null;

  const subtopics = getSubtopics(goalId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const stats = getStats();

  const children = subtopics.map(s => {
    const notes = getNotes({ subtopicId: s.id });
    const sources = getSources(goalId).filter(src =>
      notes.some(n => n.sourceId === src.id)
    );

    // 注意：notes 直接挂在 subtopic 下
    const noteNodes = notes.map(n => ({
      id: n.id,
      type: 'note',
      text: n.content,
      rawData: n,
      children: [],
    }));

    return {
      id: s.id,
      type: 'subtopic',
      text: s.title,
      rawData: s,
      noteCount: notes.length,
      children: noteNodes,
    };
  });

  // 文章单独作为 goal 的直接子节点（类型为 source）
  const sources = getSources(goalId);
  const sourceNodes = sources.map(src => ({
    id: src.id,
    type: 'source',
    text: src.title,
    rawData: src,
    children: [],
  }));

  return {
    id: goalId,
    type: 'goal',
    text: goal.title,
    rawData: goal,
    progress: stats.goalProgress[goalId] || 0,
    children: [...children, ...sourceNodes],
  };
}

// ===== 渲染树 HTML =====
function renderTree(node, depth = 0) {
  if (!node) return '';
  const cfg = NODE_TYPE[node.type];
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = _expandedNodes.has(node.id);
  const isRoot = depth === 0;

  const typeTag = `<span class="mm-type-tag" style="background:${cfg.bg};color:${cfg.color};border-color:${cfg.border}">${cfg.icon} ${cfg.label}</span>`;

  const progressBar = node.type === 'goal' ? `
    <div class="mm-progress">
      <div class="mm-progress-fill" style="width:${node.progress}%"></div>
    </div>
    <span class="mm-progress-label">${node.progress}%</span>
  ` : '';

  const missingHint = node.type === 'subtopic' && node.noteCount === 0
    ? `<span class="mm-missing">⚠ 缺重点</span>` : '';

  const collapseBtn = hasChildren
    ? `<button class="mm-collapse" data-node="${node.id}" title="${isExpanded ? '折叠' : '展开'}">${isExpanded ? '▾' : '▸'}</button>`
    : `<span class="mm-collapse-placeholder"></span>`;

  const addBtns = node.type !== 'note' ? `
    <span class="mm-actions">
      ${node.type === 'goal' || node.type === 'subtopic' ? `<button class="mm-act-btn mm-add-child" data-parent="${node.id}" data-ptype="${node.type}" title="Tab: 添加子节点">＋</button>` : ''}
      ${node.type !== 'goal' ? `<button class="mm-act-btn mm-delete-node" data-id="${node.id}" data-type="${node.type}" title="删除">×</button>` : ''}
    </span>
  ` : `
    <span class="mm-actions">
      <button class="mm-act-btn mm-delete-node" data-id="${node.id}" data-type="${node.type}" title="删除">×</button>
    </span>
  `;

  return `
    <div class="mm-node-wrap" data-node-id="${node.id}" data-node-type="${node.type}" data-depth="${depth}">
      <div class="mm-node ${isRoot ? 'mm-node-root' : ''} mm-node-${node.type}"
           data-id="${node.id}" data-type="${node.type}"
           style="--node-color:${cfg.color};--node-bg:${cfg.bg};--node-border:${cfg.border}">
        ${collapseBtn}
        ${typeTag}
        <span class="mm-node-text"
              contenteditable="true"
              data-id="${node.id}"
              data-type="${node.type}"
              data-placeholder="${{ goal:'输入目标...', subtopic:'输入子问题...', note:'输入重点内容...', source:'输入文章标题...' }[node.type]}"
              spellcheck="false">${escapeHtml(node.text)}</span>
        ${progressBar}
        ${missingHint}
        ${addBtns}
      </div>
      ${hasChildren ? `
        <div class="mm-children ${isExpanded ? '' : 'mm-collapsed'}" data-parent="${node.id}">
          ${node.children.map(c => renderTree(c, depth + 1)).join('')}
        </div>
      ` : `<div class="mm-children" data-parent="${node.id}"></div>`}
    </div>
  `;
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== 渲染页面 =====
export function renderMindmap(goalId) {
  _goalId = goalId;
  const goal = getGoalById(goalId);
  if (!goal) return `<div class="empty-state"><div class="empty-text">目标不存在</div></div>`;

  // 默认展开前两层
  _expandedNodes = new Set();
  _expandedNodes.add(goalId);
  getSubtopics(goalId).forEach(s => _expandedNodes.add(s.id));

  const tree = buildTree(goalId);

  return `
    <div class="mm-toolbar">
      <button class="btn btn-secondary btn-sm" id="mm-back">← 返回</button>
      <div class="mm-title-area">
        <span class="mm-goal-title">${goal.title}</span>
      </div>
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
      <div class="mm-tree" id="mm-tree">
        ${renderTree(tree)}
      </div>

      <div class="mm-add-root-row">
        <button class="mm-add-section-btn" id="mm-add-subtopic">
          <span>＋ 子问题</span><kbd>Tab</kbd>
        </button>
        <button class="mm-add-section-btn mm-add-source-btn" id="mm-add-source">
          <span>＋ 文章</span>
        </button>
      </div>
    </div>
  `;
}

// ===== 绑定事件 =====
export function bindMindmap(goalId) {
  _goalId = goalId;

  // 返回
  document.getElementById('mm-back')?.addEventListener('click', () => navigate('goals'));
  document.getElementById('mm-view-graph')?.addEventListener('click', () => navigate('graph', { goalId }));

  // 展开/折叠全部
  document.getElementById('mm-expand-all')?.addEventListener('click', () => {
    const tree = buildTree(goalId);
    collectAllIds(tree).forEach(id => _expandedNodes.add(id));
    refreshTree(goalId);
  });
  document.getElementById('mm-collapse-all')?.addEventListener('click', () => {
    _expandedNodes = new Set([goalId]);
    refreshTree(goalId);
  });

  // 顶部添加按钮
  document.getElementById('mm-add-subtopic')?.addEventListener('click', () => {
    addChildNode(goalId, 'goal');
  });
  document.getElementById('mm-add-source')?.addEventListener('click', () => {
    addChildNode(goalId, 'goal', 'source');
  });

  bindTreeEvents(goalId);
}

function collectAllIds(node) {
  if (!node) return [];
  return [node.id, ...(node.children || []).flatMap(collectAllIds)];
}

// ===== 绑定树内事件（可重复调用）=====
function bindTreeEvents(goalId) {
  const tree = document.getElementById('mm-tree');
  if (!tree) return;

  // 折叠按钮
  tree.querySelectorAll('.mm-collapse').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const nodeId = btn.dataset.node;
      if (_expandedNodes.has(nodeId)) _expandedNodes.delete(nodeId);
      else _expandedNodes.add(nodeId);
      refreshTree(goalId);
    };
  });

  // 添加子节点按钮
  tree.querySelectorAll('.mm-add-child').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      addChildNode(btn.dataset.parent, btn.dataset.ptype);
    };
  });

  // 删除节点按钮
  tree.querySelectorAll('.mm-delete-node').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      deleteNode(btn.dataset.id, btn.dataset.type, goalId);
    };
  });

  // contenteditable 内联编辑
  tree.querySelectorAll('[contenteditable]').forEach(el => {
    const id = el.dataset.id;
    const type = el.dataset.type;

    // 保存
    el.addEventListener('blur', () => {
      const text = el.textContent.trim();
      if (!text) return;
      saveNodeText(id, type, text);
    });

    // 键盘快捷键
    el.addEventListener('keydown', (e) => {
      handleKeydown(e, el, id, type, goalId);
    });

    // 禁止粘贴富文本
    el.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    });
  });
}

// ===== 键盘处理 =====
function handleKeydown(e, el, id, type, goalId) {
  const text = el.textContent.trim();

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    saveNodeText(id, type, text);
    // 添加同级节点
    if (type === 'subtopic') addSiblingNode(id, 'subtopic', goalId);
    else if (type === 'note') addSiblingNode(id, 'note', goalId);
    else if (type === 'source') addSiblingNode(id, 'source', goalId);
    return;
  }

  if (e.key === 'Tab') {
    e.preventDefault();
    saveNodeText(id, type, text);
    // 添加子节点
    if (type === 'goal') addChildNode(id, 'goal');
    else if (type === 'subtopic') addChildNode(id, 'subtopic');
    return;
  }

  if (e.key === 'Backspace' && text === '') {
    e.preventDefault();
    // 删除并跳到前一个节点
    const prev = getPrevNode(el);
    deleteNode(id, type, goalId);
    if (prev) setTimeout(() => focusNode(prev), 30);
    return;
  }

  if (e.key === 'Escape') {
    el.blur();
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const next = getNextNode(el);
    if (next) focusNode(next);
    return;
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prev = getPrevNode(el);
    if (prev) focusNode(prev);
    return;
  }

  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    _expandedNodes.delete(id);
    refreshTree(goalId, id);
    return;
  }

  if (e.key === 'ArrowRight') {
    e.preventDefault();
    _expandedNodes.add(id);
    refreshTree(goalId, id);
    return;
  }
}

// ===== 节点导航辅助 =====
function getAllEditableNodes() {
  return [...document.querySelectorAll('#mm-tree [contenteditable]')];
}

function getNextNode(el) {
  const all = getAllEditableNodes();
  const idx = all.indexOf(el);
  return idx < all.length - 1 ? all[idx + 1] : null;
}

function getPrevNode(el) {
  const all = getAllEditableNodes();
  const idx = all.indexOf(el);
  return idx > 0 ? all[idx - 1] : null;
}

function focusNode(el) {
  el.focus();
  // 光标移到末尾
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

// ===== 数据操作 =====
function saveNodeText(id, type, text) {
  if (!text.trim()) return;
  if (type === 'goal') updateGoal(id, { title: text });
  else if (type === 'subtopic') updateSubtopic(id, { title: text });
  else if (type === 'note') updateNote(id, { content: text });
  else if (type === 'source') updateSource(id, { title: text });
}

function addChildNode(parentId, parentType, forceType = null) {
  let newId;
  if (parentType === 'goal') {
    const type = forceType || 'subtopic';
    if (type === 'source') {
      const src = createSource({ goalId: parentId, title: '' });
      newId = src.id;
    } else {
      const subs = getSubtopics(parentId);
      const sub = createSubtopic({ goalId: parentId, title: '', order: subs.length });
      newId = sub.id;
    }
    _expandedNodes.add(parentId);
  } else if (parentType === 'subtopic') {
    // 子问题下加重点卡片
    const note = createNote({ subtopicId: parentId, content: '' });
    newId = note.id;
    _expandedNodes.add(parentId);
  }
  refreshTree(_goalId, newId);
}

function addSiblingNode(siblingId, type, goalId) {
  let newId;
  if (type === 'subtopic') {
    const sub = getSubtopics(goalId).find(s => s.id === siblingId);
    const subs = getSubtopics(goalId);
    const order = sub ? (sub.order ?? 0) + 1 : subs.length;
    const newSub = createSubtopic({ goalId, title: '', order });
    newId = newSub.id;
    _expandedNodes.add(goalId);
  } else if (type === 'note') {
    // 找到同一个 subtopic
    const notes = getNotes();
    const sibling = notes.find(n => n.id === siblingId);
    if (sibling) {
      const note = createNote({ subtopicId: sibling.subtopicId, content: '' });
      newId = note.id;
      _expandedNodes.add(sibling.subtopicId);
    }
  } else if (type === 'source') {
    const src = createSource({ goalId, title: '' });
    newId = src.id;
    _expandedNodes.add(goalId);
  }
  if (newId) refreshTree(goalId, newId);
}

function deleteNode(id, type, goalId) {
  if (type === 'goal') return; // 不删根
  if (type === 'subtopic') deleteSubtopic(id);
  else if (type === 'note') deleteNote(id);
  else if (type === 'source') deleteSource(id);
  refreshTree(goalId);
}

// ===== 刷新树（局部重渲染）=====
function refreshTree(goalId, focusId = null) {
  const treeEl = document.getElementById('mm-tree');
  if (!treeEl) return;
  const tree = buildTree(goalId);
  treeEl.innerHTML = renderTree(tree);
  bindTreeEvents(goalId);

  if (focusId) {
    setTimeout(() => {
      const el = treeEl.querySelector(`[contenteditable][data-id="${focusId}"]`);
      if (el) focusNode(el);
    }, 20);
  }
}
