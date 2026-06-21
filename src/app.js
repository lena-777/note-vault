import { renderDashboard, bindDashboard } from './views/dashboard.js';
import { renderGoals, bindGoals, renderGoalDetail, bindGoalDetail } from './views/goals.js';
import { renderMindmap, bindMindmap } from './views/mindmap.js';
import { renderSources, bindSources, showSourceModal } from './views/sources.js';
import { renderNotes, bindNotes, showNoteModal } from './views/notes.js';
import { renderGraph, bindGraph } from './views/graph.js';
import { renderSearch, bindSearch } from './views/search.js';
import { exportJSON, exportMarkdown, importJSON } from './store/db.js';
import { toast, closeModal } from './utils/helpers.js';

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
      (v === 'goals' && (view === 'goal-detail' || view === 'mindmap')) ||
      (v === 'notes' && view === 'notes')
    ) {
      el.classList.add('active');
    }
  });
  // Mark dashboard as active for dashboard
  if (view === 'dashboard') {
    document.querySelector('[data-view="dashboard"]')?.classList.add('active');
  }
}

function renderView() {
  const container = document.getElementById('view-container');
  const view = currentView;
  const p = currentParams;

  let html = '';
  switch (view) {
    case 'dashboard':   html = renderDashboard(); break;
    case 'goals':       html = renderGoals(); break;
    case 'goal-detail': html = renderGoalDetail(p.id); break;
    case 'mindmap':     html = renderMindmap(p.id); break;
    case 'sources':     html = renderSources(p); break;
    case 'notes':       html = renderNotes(p); break;
    case 'graph':       html = renderGraph(p); break;
    case 'search':      html = renderSearch(p); break;
    default:            html = renderDashboard();
  }

  container.innerHTML = html;
  container.scrollTop = 0;

  // Bind events
  switch (view) {
    case 'dashboard':
      bindDashboard();
      if (p._export) showExportModal();
      break;
    case 'goals':       bindGoals(p); break;
    case 'goal-detail':
      bindGoalDetail(p.id, {
        onAddSource: (goalId) => showSourceModal(null, goalId),
        onAddNote: ({ subtopicId, goalId }) => {
          showNoteModal(null, { subtopicId });
        }
      });
      break;
    case 'mindmap':     bindMindmap(p.id); break;
    case 'sources':     bindSources(p); break;
    case 'notes':       bindNotes(p); break;
    case 'graph':       bindGraph(p); break;
    case 'search':      bindSearch(p); break;
  }
}

// ===== INIT =====
function init() {
  // Nav clicks
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.view));
  });

  // Modal close on overlay click
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  // Import file handler (file input is in HTML, triggered by dashboard)
  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    if (!file.name.endsWith('.json')) {
      toast('目前仅支持 JSON 导入', 'error');
      e.target.value = '';
      return;
    }
    const result = importJSON(text);
    if (result.ok) {
      toast('导入成功', 'success');
      navigate(currentView, currentParams);
    } else {
      toast(`导入失败: ${result.error}`, 'error');
    }
    e.target.value = '';
  });

  // Start
  navigate('dashboard');
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function showExportModal() {
  import('./utils/helpers.js').then(({ openModal, closeModal }) => {
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
    document.getElementById('export-json').onclick = () => {
      downloadFile('note-vault-backup.json', exportJSON(), 'application/json');
      closeModal();
      toast('JSON 已导出', 'success');
    };
    document.getElementById('export-md').onclick = () => {
      downloadFile('note-vault.md', exportMarkdown(), 'text/markdown');
      closeModal();
      toast('Markdown 已导出', 'success');
    };
  });
}

init();
