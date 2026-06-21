import { renderDashboard, bindDashboard } from './views/dashboard.js';
import { renderGoals, bindGoals, renderGoalDetail, bindGoalDetail } from './views/goals.js';
import { renderMindmap, bindMindmap } from './views/mindmap.js';
import { renderSources, bindSources, showSourceModal } from './views/sources.js';
import { renderNotes, bindNotes, showNoteModal } from './views/notes.js';
import { renderGraph, bindGraph } from './views/graph.js';
import { renderSearch, bindSearch } from './views/search.js';
import { exportJSON, exportMarkdown, importJSON } from './store/db.js';
import { toast, closeModal, openModal } from './utils/helpers.js';

// ===== ROUTER =====
let currentView = 'dashboard';
let currentParams = {};

export function navigate(view, params = {}) {
  currentView = view;
  currentParams = params;
  renderView();
  updateNav(view);
}

function updateNav(view) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.remove('active');
    const v = el.dataset.view;
    if (
      v === view ||
      (v === 'goals'  && (view === 'goal-detail' || view === 'mindmap')) ||
      (v === 'notes'  && view === 'notes')
    ) el.classList.add('active');
  });
  if (view === 'dashboard') document.querySelector('[data-view="dashboard"]')?.classList.add('active');
}

// 显示加载占位
function showLoading() {
  document.getElementById('view-container').innerHTML = `
    <div class="empty-state" style="padding:80px 20px">
      <div style="font-size:24px;opacity:.3;animation:spin 1s linear infinite">◌</div>
    </div>
  `;
}

async function renderView() {
  const container = document.getElementById('view-container');
  const view = currentView;
  const p = currentParams;

  showLoading();

  let html = '';
  try {
    switch (view) {
      case 'dashboard':   html = await renderDashboard(); break;
      case 'goals':       html = await renderGoals(); break;
      case 'goal-detail': html = await renderGoalDetail(p.id); break;
      case 'mindmap':     html = await renderMindmap(p.id); break;
      case 'sources':     html = await renderSources(p); break;
      case 'notes':       html = await renderNotes(p); break;
      case 'graph':       html = await renderGraph(p); break;
      case 'search':      html = await renderSearch(p); break;
      default:            html = await renderDashboard();
    }
  } catch (e) {
    console.error(e);
    html = `<div class="empty-state"><div class="empty-icon" style="color:var(--red)">⚠</div><div class="empty-text">加载失败：${e.message}</div></div>`;
  }

  container.innerHTML = html;
  container.scrollTop = 0;

  try {
    switch (view) {
      case 'dashboard':
        bindDashboard();
        if (p._export) showExportModal();
        break;
      case 'goals':       bindGoals(p); break;
      case 'goal-detail': bindGoalDetail(p.id, {}); break;
      case 'mindmap':     bindMindmap(p.id); break;
      case 'sources':     bindSources(p); break;
      case 'notes':       bindNotes(p); break;
      case 'graph':       bindGraph(p); break;
      case 'search':      bindSearch(p); break;
    }
  } catch (e) { console.error('bind error', e); }
}

// ===== INIT =====
function init() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.view));
  });

  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  document.getElementById('import-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    if (!file.name.endsWith('.json')) { toast('目前仅支持 JSON 导入', 'error'); e.target.value = ''; return; }
    const result = await importJSON(text);
    if (result.ok) { toast('导入成功', 'success'); navigate(currentView, currentParams); }
    else toast(`导入失败: ${result.error}`, 'error');
    e.target.value = '';
  });

  // 加个 spin 动画
  const style = document.createElement('style');
  style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);

  navigate('dashboard');
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export function showExportModal() {
  openModal(`
    <div class="modal-header">
      <span class="modal-title">导出数据</span>
      <button class="modal-close" id="modal-close-btn">×</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <button class="btn btn-secondary w-full" id="export-json">导出为 JSON（完整备份）</button>
      <button class="btn btn-secondary w-full" id="export-md">导出为 Markdown</button>
    </div>
  `);
  document.getElementById('modal-close-btn').onclick = closeModal;
  document.getElementById('export-json').onclick = async () => {
    const data = await exportJSON();
    downloadFile('note-vault-backup.json', data, 'application/json');
    closeModal(); toast('JSON 已导出', 'success');
  };
  document.getElementById('export-md').onclick = async () => {
    const data = await exportMarkdown();
    downloadFile('note-vault.md', data, 'text/markdown');
    closeModal(); toast('Markdown 已导出', 'success');
  };
}

init();
