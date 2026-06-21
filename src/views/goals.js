import {
  getGoals, createGoal, updateGoal, deleteGoal,
  getSubtopics, createSubtopic, updateSubtopic, deleteSubtopic,
  getNotes, getStats
} from '../store/db.js';
import { toast, formatDate, statusLabel, openModal, closeModal } from '../utils/helpers.js';
import { navigate } from '../app.js';

// ===== GOAL LIST =====
export function renderGoals() {
  const goals = getGoals();
  const stats = getStats();

  return `
    <div class="page-header">
      <div>
        <div class="page-title">学习目标</div>
        <div class="page-subtitle">每个目标是你知识串联的中心</div>
      </div>
      <button class="btn btn-primary" id="btn-new-goal">+ 新建目标</button>
    </div>

    ${goals.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">◎</div>
        <div class="empty-text">还没有目标，点击右上角创建第一个</div>
      </div>
    ` : `
      <div class="grid-auto">
        ${goals.map(g => {
          const progress = stats.goalProgress[g.id] || 0;
          const [label, cls] = statusLabel(g.status);
          const subCount = getSubtopics(g.id).length;
          const noteCount = getNotes({ goalId: g.id }).length;
          return `
            <div class="card goal-card card-clickable" data-goal-id="${g.id}">
              <div class="goal-actions">
                <button class="btn btn-sm btn-secondary btn-edit-goal" data-id="${g.id}">编辑</button>
                <button class="btn btn-sm btn-danger btn-delete-goal" data-id="${g.id}">删除</button>
              </div>
              <div class="goal-title">${g.title}</div>
              ${g.description ? `<div class="goal-desc">${g.description}</div>` : ''}
              <div class="goal-meta">
                <span class="badge ${cls}">${label}</span>
                <span class="text-sm text-muted">${subCount} 子问题</span>
                <span class="text-sm text-muted">${noteCount} 卡片</span>
              </div>
              <div class="goal-status-bar">
                <div class="goal-status-bar-fill" style="width:${progress}%"></div>
              </div>
              <div class="flex-between mt-8">
                <span class="text-sm text-muted">进度 ${progress}%</span>
                <span class="text-sm text-muted">${formatDate(g.updatedAt)}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;
}

export function bindGoals({ action } = {}) {
  document.getElementById('btn-new-goal')?.addEventListener('click', () => showGoalModal());

  document.querySelectorAll('.btn-edit-goal').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const g = getGoals().find(g => g.id === btn.dataset.id);
      if (g) showGoalModal(g);
    });
  });

  document.querySelectorAll('.btn-delete-goal').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm(`确定删除该目标及其所有内容？`)) {
        deleteGoal(btn.dataset.id);
        toast('已删除', 'success');
        navigate('goals');
      }
    });
  });

  document.querySelectorAll('[data-goal-id]').forEach(el => {
    el.addEventListener('click', () => navigate('goal-detail', { id: el.dataset.goalId }));
  });

  if (action === 'new') showGoalModal();
}

function showGoalModal(goal = null) {
  openModal(`
    <div class="modal-header">
      <span class="modal-title">${goal ? '编辑目标' : '新建目标'}</span>
      <button class="modal-close" id="modal-close-btn">×</button>
    </div>
    <div class="form-group">
      <label class="form-label">目标标题 *</label>
      <input class="form-input" id="goal-title" placeholder="e.g. 深入理解 React 并发渲染" value="${goal?.title || ''}" />
    </div>
    <div class="form-group">
      <label class="form-label">描述</label>
      <textarea class="form-textarea" id="goal-desc" placeholder="这个目标的背景和期望收获...">${goal?.description || ''}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">状态</label>
      <select class="form-select" id="goal-status">
        <option value="active" ${goal?.status === 'active' ? 'selected' : ''}>进行中</option>
        <option value="paused" ${goal?.status === 'paused' ? 'selected' : ''}>暂停</option>
        <option value="done"   ${goal?.status === 'done'   ? 'selected' : ''}>已完成</option>
      </select>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="modal-cancel">取消</button>
      <button class="btn btn-primary" id="modal-save-goal">保存</button>
    </div>
  `);

  document.getElementById('modal-close-btn').onclick = closeModal;
  document.getElementById('modal-cancel').onclick = closeModal;
  document.getElementById('modal-save-goal').onclick = () => {
    const title = document.getElementById('goal-title').value.trim();
    if (!title) { toast('请填写目标标题', 'error'); return; }
    const status = document.getElementById('goal-status').value;
    const description = document.getElementById('goal-desc').value.trim();
    if (goal) {
      updateGoal(goal.id, { title, description, status });
      toast('已更新', 'success');
    } else {
      createGoal({ title, description, status });
      toast('已创建', 'success');
    }
    closeModal();
    navigate('goals');
  };
}

// ===== GOAL DETAIL =====
export function renderGoalDetail(id) {
  const goal = getGoals().find(g => g.id === id);
  if (!goal) return `<div class="empty-state"><div class="empty-text">目标不存在</div></div>`;

  const subtopics = getSubtopics(id).sort((a, b) => a.order - b.order);
  const stats = getStats();
  const progress = stats.goalProgress[id] || 0;
  const [label, cls] = statusLabel(goal.status);
  const noteCount = getNotes({ goalId: id }).length;

  return `
    <div class="detail-back" id="back-to-goals">← 返回目标列表</div>

    <div class="page-header">
      <div>
        <div class="page-title">${goal.title}</div>
        ${goal.description ? `<div class="page-subtitle">${goal.description}</div>` : ''}
      </div>
      <div class="flex gap-8">
        <button class="btn btn-secondary" id="btn-view-graph" data-goal="${id}">查看图谱</button>
        <button class="btn btn-secondary" id="btn-add-source">+ 添加文章</button>
        <button class="btn btn-primary" id="btn-add-subtopic">+ 添加子问题</button>
      </div>
    </div>

    <div class="flex gap-8 mb-16" style="align-items:center">
      <span class="badge ${cls}">${label}</span>
      <span class="text-sm text-muted">${subtopics.length} 子问题 · ${noteCount} 重点卡片</span>
      <span class="text-sm text-muted" style="margin-left:auto">总进度 ${progress}%</span>
    </div>

    <div class="goal-status-bar mb-16" style="height:6px">
      <div class="goal-status-bar-fill" style="width:${progress}%"></div>
    </div>

    <div class="section-title">子问题</div>

    ${subtopics.length === 0 ? `
      <div class="empty-state" style="padding:30px">
        <div class="empty-icon" style="font-size:24px">⊘</div>
        <div class="empty-text">还没有子问题，点击右上角添加</div>
      </div>
    ` : `
      <div id="subtopic-list" style="display:flex;flex-direction:column;gap:10px">
        ${subtopics.map(s => {
          const nc = stats.noteCountBySubtopic[s.id] || 0;
          const missing = nc === 0;
          return `
            <div class="card" style="padding:14px 18px">
              <div class="flex-between">
                <div class="flex gap-8" style="align-items:center;flex:1;min-width:0">
                  <span class="subtopic-name text-bold" style="font-size:14px">${s.title}</span>
                  ${missing ? `<span class="missing-hint">⚠ 还缺重点</span>` : ''}
                  <span class="subtopic-count">${nc} 张卡片</span>
                </div>
                <div class="flex gap-8" style="align-items:center">
                  <button class="btn btn-sm btn-primary btn-add-note" data-subtopic="${s.id}" data-goal="${id}">+ 记录重点</button>
                  <button class="btn btn-sm btn-secondary btn-view-notes" data-subtopic="${s.id}">查看</button>
                  <button class="btn btn-sm btn-secondary btn-edit-sub" data-id="${s.id}">编辑</button>
                  <button class="btn btn-sm btn-danger btn-delete-sub" data-id="${s.id}">删除</button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;
}

export function bindGoalDetail(id, callbacks) {
  document.getElementById('back-to-goals')?.addEventListener('click', () => navigate('goals'));

  document.getElementById('btn-add-subtopic')?.addEventListener('click', () => showSubtopicModal(id));
  document.getElementById('btn-add-source')?.addEventListener('click', () => callbacks?.onAddSource?.(id));
  document.getElementById('btn-view-graph')?.addEventListener('click', () => navigate('graph', { goalId: id }));

  document.querySelectorAll('.btn-add-note').forEach(btn => {
    btn.addEventListener('click', () => callbacks?.onAddNote?.({ subtopicId: btn.dataset.subtopic, goalId: id }));
  });

  document.querySelectorAll('.btn-view-notes').forEach(btn => {
    btn.addEventListener('click', () => navigate('notes', { subtopicId: btn.dataset.subtopic }));
  });

  document.querySelectorAll('.btn-edit-sub').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = getSubtopics(id).find(s => s.id === btn.dataset.id);
      if (s) showSubtopicModal(id, s);
    });
  });

  document.querySelectorAll('.btn-delete-sub').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('确定删除该子问题及其所有重点卡片？')) {
        deleteSubtopic(btn.dataset.id);
        toast('已删除', 'success');
        navigate('goal-detail', { id });
      }
    });
  });
}

function showSubtopicModal(goalId, sub = null) {
  openModal(`
    <div class="modal-header">
      <span class="modal-title">${sub ? '编辑子问题' : '添加子问题'}</span>
      <button class="modal-close" id="modal-close-btn">×</button>
    </div>
    <div class="form-group">
      <label class="form-label">子问题标题 *</label>
      <input class="form-input" id="sub-title" placeholder="e.g. React Fiber 的工作原理是什么？" value="${sub?.title || ''}" />
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="modal-cancel">取消</button>
      <button class="btn btn-primary" id="modal-save-sub">保存</button>
    </div>
  `);
  document.getElementById('modal-close-btn').onclick = closeModal;
  document.getElementById('modal-cancel').onclick = closeModal;
  document.getElementById('modal-save-sub').onclick = () => {
    const title = document.getElementById('sub-title').value.trim();
    if (!title) { toast('请填写子问题标题', 'error'); return; }
    if (sub) {
      updateSubtopic(sub.id, { title });
      toast('已更新', 'success');
    } else {
      const subs = getSubtopics(goalId);
      createSubtopic({ goalId, title, order: subs.length });
      toast('已添加', 'success');
    }
    closeModal();
    navigate('goal-detail', { id: goalId });
  };
}
