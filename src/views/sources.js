import {
  getSources, createSource, updateSource, deleteSource,
  getGoals, getNotes, getStats
} from '../store/db.js';
import { toast, formatDate, statusLabel, openModal, closeModal } from '../utils/helpers.js';
import { navigate } from '../app.js';

export function renderSources(filter = {}) {
  const goals = getGoals();
  const stats = getStats();
  let sources = getSources(filter.goalId);

  return `
    <div class="page-header">
      <div>
        <div class="page-title">文章来源</div>
        <div class="page-subtitle">管理你的阅读材料</div>
      </div>
      <button class="btn btn-primary" id="btn-new-source">+ 添加文章</button>
    </div>

    <div class="flex gap-8 mb-16" style="flex-wrap:wrap">
      <select class="form-select" id="filter-goal-source" style="width:200px">
        <option value="">全部目标</option>
        ${goals.map(g => `<option value="${g.id}" ${filter.goalId === g.id ? 'selected' : ''}>${g.title}</option>`).join('')}
      </select>
      <select class="form-select" id="filter-status-source" style="width:140px">
        <option value="">全部状态</option>
        <option value="unread">待读</option>
        <option value="reading">在读</option>
        <option value="read">已读</option>
      </select>
    </div>

    ${sources.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">⊟</div>
        <div class="empty-text">还没有文章，点击右上角添加</div>
      </div>
    ` : `
      <div style="display:flex;flex-direction:column;gap:10px">
        ${sources.map(src => {
          const nc = stats.noteCountBySource[src.id] || 0;
          const [label, cls] = statusLabel(src.status);
          const goal = goals.find(g => g.id === src.goalId);
          return `
            <div class="card">
              <div class="source-card">
                <div class="source-icon">📄</div>
                <div class="source-info">
                  <div class="source-title">${src.title}</div>
                  ${src.url ? `<a href="${src.url}" target="_blank" class="source-url">${src.url}</a>` : ''}
                  <div class="flex gap-8 mt-8" style="flex-wrap:wrap;align-items:center">
                    <span class="badge ${cls}">${label}</span>
                    ${goal ? `<span class="badge badge-purple">${goal.title}</span>` : ''}
                    <span class="text-sm text-muted">${nc} 张重点卡片</span>
                    <span class="text-sm text-muted">${formatDate(src.updatedAt)}</span>
                  </div>
                </div>
                <div class="source-actions flex gap-8">
                  <select class="form-select" style="width:100px;padding:4px 8px;font-size:12px" data-src-status="${src.id}">
                    <option value="unread" ${src.status==='unread'?'selected':''}>待读</option>
                    <option value="reading" ${src.status==='reading'?'selected':''}>在读</option>
                    <option value="read" ${src.status==='read'?'selected':''}>已读</option>
                  </select>
                  <button class="btn btn-sm btn-secondary btn-edit-source" data-id="${src.id}">编辑</button>
                  <button class="btn btn-sm btn-danger btn-delete-source" data-id="${src.id}">删除</button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;
}

export function bindSources(filter = {}) {
  document.getElementById('btn-new-source')?.addEventListener('click', () => showSourceModal(null, filter.goalId));

  document.getElementById('filter-goal-source')?.addEventListener('change', e => {
    navigate('sources', { goalId: e.target.value || undefined });
  });

  document.querySelectorAll('[data-src-status]').forEach(sel => {
    sel.addEventListener('change', () => {
      updateSource(sel.dataset.srcStatus, { status: sel.value });
      toast('已更新阅读状态', 'success');
    });
  });

  document.querySelectorAll('.btn-edit-source').forEach(btn => {
    btn.addEventListener('click', () => {
      const src = getSources().find(s => s.id === btn.dataset.id);
      if (src) showSourceModal(src);
    });
  });

  document.querySelectorAll('.btn-delete-source').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('确定删除该文章？')) {
        deleteSource(btn.dataset.id);
        toast('已删除', 'success');
        navigate('sources', filter);
      }
    });
  });
}

export function showSourceModal(source = null, defaultGoalId = null) {
  const goals = getGoals();
  openModal(`
    <div class="modal-header">
      <span class="modal-title">${source ? '编辑文章' : '添加文章'}</span>
      <button class="modal-close" id="modal-close-btn">×</button>
    </div>
    <div class="form-group">
      <label class="form-label">文章标题 *</label>
      <input class="form-input" id="src-title" placeholder="e.g. React Fiber Architecture" value="${source?.title || ''}" />
    </div>
    <div class="form-group">
      <label class="form-label">链接/出处</label>
      <input class="form-input" id="src-url" placeholder="https://..." value="${source?.url || ''}" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">所属目标</label>
        <select class="form-select" id="src-goal">
          <option value="">不关联</option>
          ${goals.map(g => `<option value="${g.id}" ${(source?.goalId || defaultGoalId) === g.id ? 'selected' : ''}>${g.title}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">阅读状态</label>
        <select class="form-select" id="src-status">
          <option value="unread" ${source?.status==='unread'?'selected':''}>待读</option>
          <option value="reading" ${source?.status==='reading'?'selected':''}>在读</option>
          <option value="read" ${source?.status==='read'?'selected':''}>已读</option>
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="modal-cancel">取消</button>
      <button class="btn btn-primary" id="modal-save-src">保存</button>
    </div>
  `);

  document.getElementById('modal-close-btn').onclick = closeModal;
  document.getElementById('modal-cancel').onclick = closeModal;
  document.getElementById('modal-save-src').onclick = () => {
    const title = document.getElementById('src-title').value.trim();
    if (!title) { toast('请填写文章标题', 'error'); return; }
    const url = document.getElementById('src-url').value.trim();
    const goalId = document.getElementById('src-goal').value || null;
    const status = document.getElementById('src-status').value;
    if (source) {
      updateSource(source.id, { title, url, goalId, status });
      toast('已更新', 'success');
    } else {
      createSource({ title, url, goalId, status });
      toast('已添加', 'success');
    }
    closeModal();
    navigate('sources');
  };
}
