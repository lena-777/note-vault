import {
  getGoals, createGoal, updateGoal, deleteGoal,
  getSubtopics, createSubtopic, updateSubtopic, deleteSubtopic,
  getNotes, getStats
} from '../store/db.js';
import { toast, formatDate, statusLabel, openModal, closeModal, cSelect, initCustomSelects, getCSelectValue } from '../utils/helpers.js';
import { navigate } from '../app.js';

// ===== GOAL LIST =====
export async function renderGoals() {
  const [goals, stats] = await Promise.all([getGoals(), getStats()]);

  return `
    <div class="page-header">
      <div><div class="page-title">学习目标</div><div class="page-subtitle">每个目标是你知识串联的中心</div></div>
      <button class="btn btn-primary" id="btn-new-goal">+ 新建目标</button>
    </div>
    ${goals.length === 0 ? `
      <div class="empty-state"><div class="empty-icon">◎</div><div class="empty-text">还没有目标，点击右上角创建第一个</div></div>
    ` : `
      <div class="grid-auto">
        ${goals.map(g => {
          const progress = stats.goalProgress[g.id] || 0;
          const [label, cls] = statusLabel(g.status);
          return `
            <div class="card goal-card card-clickable" data-goal-id="${g.id}">
              <div class="goal-actions">
                <button class="btn btn-sm btn-secondary btn-edit-goal" data-id="${g.id}">编辑</button>
                <button class="btn btn-sm btn-danger btn-delete-goal" data-id="${g.id}">删除</button>
              </div>
              <div class="goal-title">${g.title}</div>
              ${g.description ? `<div class="goal-desc">${g.description}</div>` : ''}
              <div class="goal-meta"><span class="badge ${cls}">${label}</span></div>
              <div class="goal-status-bar"><div class="goal-status-bar-fill" style="width:${progress}%"></div></div>
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
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const goals = await getGoals();
      const g = goals.find(g => g.id === btn.dataset.id);
      if (g) showGoalModal(g);
    });
  });

  document.querySelectorAll('.btn-delete-goal').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      if (confirm('确定删除该目标及其所有内容？')) {
        await deleteGoal(btn.dataset.id);
        toast('已删除', 'success');
        navigate('goals');
      }
    });
  });

  document.querySelectorAll('[data-goal-id]').forEach(el => {
    el.addEventListener('click', () => navigate('mindmap', { id: el.dataset.goalId }));
  });

  if (action === 'new') showGoalModal();
}

function showGoalModal(goal = null) {
  const statusOptions = [
    { value: 'active', label: '进行中' },
    { value: 'paused', label: '暂停' },
    { value: 'done',   label: '已完成' },
  ];
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
      <textarea class="form-textarea" id="goal-desc">${goal?.description || ''}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">状态</label>
      ${cSelect('goal-status', statusOptions, goal?.status || 'active', { style: 'width:100%' })}
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="modal-cancel">取消</button>
      <button class="btn btn-primary" id="modal-save-goal">保存</button>
    </div>
  `);
  initCustomSelects();
  document.getElementById('modal-close-btn').onclick = closeModal;
  document.getElementById('modal-cancel').onclick = closeModal;
  document.getElementById('modal-save-goal').onclick = async () => {
    const title = document.getElementById('goal-title').value.trim();
    if (!title) { toast('请填写目标标题', 'error'); return; }
    const status = getCSelectValue('goal-status') || 'active';
    const description = document.getElementById('goal-desc').value.trim();
    if (goal) {
      await updateGoal(goal.id, { title, description, status });
      toast('已更新', 'success');
      closeModal();
      navigate('goals');
    } else {
      const newGoal = await createGoal({ title, description, status });
      toast('已创建，开始规划吧', 'success');
      closeModal();
      navigate('mindmap', { id: newGoal.id });
    }
  };
}

// ===== GOAL DETAIL (保留，供 mindmap 回退时使用) =====
export async function renderGoalDetail(id) {
  const goals = await getGoals();
  const goal = goals.find(g => g.id === id);
  if (!goal) return `<div class="empty-state"><div class="empty-text">目标不存在</div></div>`;
  navigate('mindmap', { id });
  return '';
}
export function bindGoalDetail() {}
