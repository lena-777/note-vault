import { getNotes, getGoals, getSubtopics, getSources, getSubtopicById, getGoalById } from '../store/db.js';
import { formatDate, relLabel, cSelect, initCustomSelects, getCSelectValue } from '../utils/helpers.js';
import { navigate } from '../app.js';

export function renderSearch(filter = {}) {
  const goals = getGoals();
  const allTags = [...new Set(getNotes().flatMap(n => n.tags || []))];

  const kw = filter.keyword || '';
  const goalId = filter.goalId || '';
  const tag = filter.tag || '';

  let notes = getNotes({ goalId: goalId || undefined, keyword: kw || undefined, tag: tag || undefined });

  const goalOptions = [
    { value: '', label: '全部目标' },
    ...goals.map(g => ({ value: g.id, label: g.title })),
  ];
  const tagOptions = [
    { value: '', label: '全部标签' },
    ...allTags.map(t => ({ value: t, label: t })),
  ];

  return `
    <div class="page-header">
      <div>
        <div class="page-title">检索</div>
        <div class="page-subtitle">组合条件，快速定位重点卡片</div>
      </div>
    </div>

    <div class="search-bar">
      <span class="search-icon">⊙</span>
      <input id="search-kw" placeholder="搜索重点内容..." value="${kw}" />
    </div>

    <div class="search-filters">
      ${cSelect('search-goal', goalOptions, goalId, { style: 'width:200px' })}
      ${cSelect('search-tag', tagOptions, tag, { style: 'width:160px' })}
      <button class="btn btn-secondary" id="search-reset">清除筛选</button>
    </div>

    <div class="text-sm text-muted mb-16">找到 ${notes.length} 张卡片</div>

    ${notes.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">⊙</div>
        <div class="empty-text">没有匹配的重点卡片</div>
      </div>
    ` : `
      <div style="display:flex;flex-direction:column;gap:10px">
        ${notes.map(n => {
          const subtopic = getSubtopicById(n.subtopicId);
          const goal = subtopic ? getGoalById(subtopic.goalId) : null;
          const sources = getSources();
          const src = n.sourceId ? sources.find(s => s.id === n.sourceId) : null;
          const content = kw ? highlightText(n.content, kw) : n.content;
          return `
            <div class="card note-card">
              <div class="note-content">${content}</div>
              ${n.quote ? `<div class="text-sm text-muted" style="border-left:2px solid var(--purple-200);padding-left:8px;font-style:italic">"${n.quote}"</div>` : ''}
              <div class="note-footer mt-8">
                <div class="flex gap-4" style="flex-wrap:wrap">
                  ${subtopic ? `<span class="badge badge-purple" style="cursor:pointer" data-goto-sub="${subtopic.id}" data-goal="${subtopic.goalId}">${subtopic.title}</span>` : ''}
                  ${goal ? `<span class="badge badge-gray">${goal.title}</span>` : ''}
                  ${src ? `<a href="${src.url || '#'}" target="_blank" class="note-source-link">↗ ${src.title}</a>` : ''}
                  ${(n.tags || []).map(t => `<span class="tag" style="cursor:pointer" data-tag-filter="${t}">${t}</span>`).join('')}
                </div>
                <span class="text-sm text-muted">${formatDate(n.updatedAt)}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;
}

function highlightText(text, kw) {
  if (!kw) return text;
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(escaped, 'gi'), m => `<mark style="background:var(--purple-100);color:var(--purple-600);border-radius:2px">${m}</mark>`);
}

export function bindSearch(filter = {}) {
  initCustomSelects((id, value) => {
    if (id === 'search-goal') {
      const kw = document.getElementById('search-kw')?.value.trim();
      const tag = getCSelectValue('search-tag');
      navigate('search', { keyword: kw || undefined, goalId: value || undefined, tag: tag || undefined });
    } else if (id === 'search-tag') {
      const kw = document.getElementById('search-kw')?.value.trim();
      const goalId = getCSelectValue('search-goal');
      navigate('search', { keyword: kw || undefined, goalId: goalId || undefined, tag: value || undefined });
    }
  });

  let timer;
  document.getElementById('search-kw')?.addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const kw = e.target.value.trim();
      const goalId = getCSelectValue('search-goal');
      const tag = getCSelectValue('search-tag');
      navigate('search', { keyword: kw || undefined, goalId: goalId || undefined, tag: tag || undefined });
    }, 300);
  });

  document.getElementById('search-reset')?.addEventListener('click', () => navigate('search'));

  document.querySelectorAll('[data-goto-sub]').forEach(el => {
    el.addEventListener('click', () => navigate('notes', { subtopicId: el.dataset.gotoSub }));
  });

  document.querySelectorAll('[data-tag-filter]').forEach(el => {
    el.addEventListener('click', () => navigate('search', { ...filter, tag: el.dataset.tagFilter }));
  });
}
