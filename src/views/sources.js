import {
  getSources, createSource, updateSource, deleteSource,
  getGoals, getNotes, getStats
} from '../store/db.js';
import { toast, formatDate, statusLabel, openModal, closeModal, cSelect, initCustomSelects, getCSelectValue } from '../utils/helpers.js';
import { navigate } from '../app.js';

export async function renderSources(filter = {}) {
  const [goals, stats] = await Promise.all([getGoals(), getStats()]);
  const sources = await getSources(filter.goalId);

  const goalOptions = [{ value: '', label: '全部目标' }, ...goals.map(g => ({ value: g.id, label: g.title }))];
  const statusOptions = [
    { value: '', label: '全部状态' },
    { value: 'unread', label: '待读' }, { value: 'reading', label: '在读' }, { value: 'read', label: '已读' },
  ];

  return `
    <div class="page-header">
      <div><div class="page-title">文章来源</div><div class="page-subtitle">管理你的阅读材料</div></div>
      <button class="btn btn-primary" id="btn-new-source">+ 添加文章</button>
    </div>
    <div class="flex gap-8 mb-16" style="flex-wrap:wrap;align-items:center">
      ${cSelect('filter-goal-source', goalOptions, filter.goalId || '', { style: 'width:200px' })}
      ${cSelect('filter-status-source', statusOptions, filter.status || '', { style: 'width:140px' })}
    </div>
    ${sources.length === 0 ? `<div class="empty-state"><div class="empty-icon">⊟</div><div class="empty-text">还没有文章，点击右上角添加</div></div>` : `
      <div style="display:flex;flex-direction:column;gap:10px">
        ${sources.map(src => {
          const nc = stats.noteCountBySource[src.id] || 0;
          const [label, cls] = statusLabel(src.status);
          const goal = goals.find(g => g.id === src.goalId);
          const srcStatusOpts = [{ value:'unread',label:'待读'},{value:'reading',label:'在读'},{value:'read',label:'已读'}];
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
                <div class="source-actions flex gap-8" style="align-items:center">
                  ${cSelect('src-status-' + src.id, srcStatusOpts, src.status, { small: true, style: 'width:90px' })}
                  <button class="btn btn-sm btn-secondary btn-edit-source" data-id="${src.id}">编辑</button>
                  <button class="btn btn-sm btn-danger btn-delete-source" data-id="${src.id}">删除</button>
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>`}
  `;
}

export function bindSources(filter = {}) {
  initCustomSelects(async (id, value) => {
    if (id === 'filter-goal-source') navigate('sources', { goalId: value || undefined });
    else if (id === 'filter-status-source') navigate('sources', { ...filter, status: value || undefined });
    else if (id.startsWith('src-status-')) {
      await updateSource(id.replace('src-status-', ''), { status: value });
      toast('已更新阅读状态', 'success');
    }
  });

  document.getElementById('btn-new-source')?.addEventListener('click', () => showSourceModal(null, filter.goalId));

  document.querySelectorAll('.btn-edit-source').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sources = await getSources();
      const src = sources.find(s => s.id === btn.dataset.id);
      if (src) showSourceModal(src);
    });
  });

  document.querySelectorAll('.btn-delete-source').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('确定删除该文章？')) {
        await deleteSource(btn.dataset.id);
        toast('已删除', 'success');
        navigate('sources', filter);
      }
    });
  });
}

export async function showSourceModal(source = null, defaultGoalId = null) {
  const goals = await getGoals();
  const goalOptions = [{ value: '', label: '不关联' }, ...goals.map(g => ({ value: g.id, label: g.title }))];
  const statusOptions = [{ value:'unread',label:'待读'},{value:'reading',label:'在读'},{value:'read',label:'已读'}];

  openModal(`
    <div class="modal-header">
      <span class="modal-title">${source ? '编辑文章' : '添加文章'}</span>
      <button class="modal-close" id="modal-close-btn">×</button>
    </div>
    <div class="form-group">
      <label class="form-label">文章标题 *</label>
      <input class="form-input" id="src-title" value="${source?.title || ''}" placeholder="e.g. React Fiber Architecture" />
    </div>
    <div class="form-group">
      <label class="form-label">链接/出处</label>
      <input class="form-input" id="src-url" value="${source?.url || ''}" placeholder="https://..." />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">所属目标</label>
        ${cSelect('src-goal', goalOptions, source?.goalId || defaultGoalId || '', { style: 'width:100%' })}
      </div>
      <div class="form-group">
        <label class="form-label">阅读状态</label>
        ${cSelect('src-status', statusOptions, source?.status || 'unread', { style: 'width:100%' })}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="modal-cancel">取消</button>
      <button class="btn btn-primary" id="modal-save-src">保存</button>
    </div>
  `);
  initCustomSelects();
  document.getElementById('modal-close-btn').onclick = closeModal;
  document.getElementById('modal-cancel').onclick = closeModal;
  document.getElementById('modal-save-src').onclick = async () => {
    const title = document.getElementById('src-title').value.trim();
    if (!title) { toast('请填写文章标题', 'error'); return; }
    const url = document.getElementById('src-url').value.trim();
    const goalId = getCSelectValue('src-goal') || null;
    const status = getCSelectValue('src-status') || 'unread';
    if (source) { await updateSource(source.id, { title, url, goalId, status }); toast('已更新', 'success'); }
    else { await createSource({ title, url, goalId, status }); toast('已添加', 'success'); }
    closeModal();
    navigate('sources');
  };
}
