import { getGoals, getStats } from '../store/db.js';
import { formatDate, statusLabel } from '../utils/helpers.js';
import { navigate } from '../app.js';

export function renderDashboard() {
  const stats = getStats();
  const goals = getGoals();

  const recentGoals = [...goals]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 6);

  return `
    <div class="page-header">
      <div>
        <div class="page-title">总览</div>
        <div class="page-subtitle">掌握你的知识串联进度</div>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-secondary" id="dash-import">导入</button>
        <button class="btn btn-secondary" id="dash-export">导出</button>
        <button class="btn btn-primary" id="dash-new-goal">+ 新建目标</button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-num">${stats.totalGoals}</div>
        <div class="stat-label">学习目标</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${stats.totalSubtopics}</div>
        <div class="stat-label">子问题</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${stats.totalSources}</div>
        <div class="stat-label">文章来源</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${stats.totalNotes}</div>
        <div class="stat-label">重点卡片</div>
      </div>
    </div>

    <div class="section-title">进行中的目标</div>

    ${recentGoals.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">◎</div>
        <div class="empty-text">还没有学习目标，点击右上角新建一个吧</div>
      </div>
    ` : `
      <div class="grid-auto">
        ${recentGoals.map(g => {
          const progress = stats.goalProgress[g.id] || 0;
          const [label, cls] = statusLabel(g.status);
          return `
            <div class="card goal-card card-clickable" data-goto-goal="${g.id}">
              <div class="flex-between">
                <span class="goal-title">${g.title}</span>
                <span class="badge ${cls}">${label}</span>
              </div>
              ${g.description ? `<div class="goal-desc">${g.description}</div>` : ''}
              <div class="goal-status-bar">
                <div class="goal-status-bar-fill" style="width:${progress}%"></div>
              </div>
              <div class="flex-between mt-8">
                <span class="text-sm text-muted">完成度 ${progress}%</span>
                <span class="text-sm text-muted">${formatDate(g.updatedAt)}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;
}

export function bindDashboard() {
  document.getElementById('dash-new-goal')?.addEventListener('click', () => {
    navigate('goals', { action: 'new' });
  });
  document.querySelectorAll('[data-goto-goal]').forEach(el => {
    el.addEventListener('click', () => navigate('goal-detail', { id: el.dataset.gotoGoal }));
  });
  document.getElementById('dash-export')?.addEventListener('click', () => {
    import('../app.js').then(m => m.showExportModal?.());
  });
  document.getElementById('dash-import')?.addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
}
