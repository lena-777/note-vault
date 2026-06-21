// ===== UTILS =====

export function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast-item${type ? ' ' + type : ''}`;
  el.textContent = msg;
  document.getElementById('toast').appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

export function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 7 * 86400000) return `${Math.floor(diff / 86400000)} 天前`;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export function statusLabel(status) {
  const map = {
    active: ['进行中', 'badge-purple'],
    done:   ['已完成', 'badge-green'],
    paused: ['暂停', 'badge-gray'],
    unread: ['待读', 'badge-gray'],
    reading:['在读', 'badge-yellow'],
    read:   ['已读', 'badge-green'],
  };
  return map[status] || [status, 'badge-gray'];
}

export function relLabel(type) {
  const map = {
    support:  ['支撑', 'rel-support'],
    extend:   ['补充', 'rel-extend'],
    conflict: ['矛盾', 'rel-conflict'],
    sequence: ['递进', 'rel-sequence'],
  };
  return map[type] || [type, ''];
}

export function openModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-content').innerHTML = '';
}

export function confirm(msg) {
  return window.confirm(msg);
}

// ===== CUSTOM SELECT =====
/**
 * 生成自定义 select 的 HTML 字符串
 * @param {string} id
 * @param {{ value: string, label: string }[]} options
 * @param {string} selected  当前选中 value
 * @param {{ placeholder?: string, style?: string, small?: boolean }} opts
 */
export function cSelect(id, options, selected = '', opts = {}) {
  const { placeholder = '请选择', style = '', small = false } = opts;
  const cur = options.find(o => o.value === selected);
  const displayLabel = cur ? cur.label : `<span style="color:var(--text-muted)">${placeholder}</span>`;
  return `
    <div class="c-select${small ? ' c-select-sm' : ''}" id="${id}" data-value="${selected}" style="${style}" tabindex="0">
      <div class="c-select-trigger">
        <span class="c-select-label">${cur ? cur.label : `<span style="color:var(--text-muted)">${placeholder}</span>`}</span>
        <span class="c-select-arrow">
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
      </div>
      <div class="c-select-dropdown">
        ${options.map(o => `
          <div class="c-select-option${o.value === selected ? ' selected' : ''}" data-value="${o.value}">
            ${o.value === selected ? '<span class="c-select-check">✓</span>' : '<span class="c-select-check"></span>'}
            ${o.label}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * 初始化页面上所有 .c-select，绑定交互
 * @param {(id: string, value: string) => void} onChange  选项变化回调
 */
export function initCustomSelects(onChange) {
  // 点击外部关闭所有
  const closeAll = () => {
    document.querySelectorAll('.c-select.open').forEach(el => el.classList.remove('open'));
  };

  document.querySelectorAll('.c-select').forEach(select => {
    // 防止重复绑定
    if (select._cSelectBound) return;
    select._cSelectBound = true;

    const trigger = select.querySelector('.c-select-trigger');
    const dropdown = select.querySelector('.c-select-dropdown');

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = select.classList.contains('open');
      closeAll();
      if (!isOpen) {
        select.classList.add('open');
        // 检测是否超出底部，超出则向上展开
        requestAnimationFrame(() => {
          const rect = dropdown.getBoundingClientRect();
          if (rect.bottom > window.innerHeight - 8) {
            dropdown.style.top = 'auto';
            dropdown.style.bottom = '100%';
            dropdown.style.marginTop = '0';
            dropdown.style.marginBottom = '4px';
          } else {
            dropdown.style.top = '';
            dropdown.style.bottom = '';
            dropdown.style.marginTop = '';
            dropdown.style.marginBottom = '';
          }
        });
      }
    });

    dropdown.querySelectorAll('.c-select-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const value = opt.dataset.value;
        const label = opt.textContent.trim().replace(/^✓\s*/, '');
        // 更新 trigger label
        select.querySelector('.c-select-label').innerHTML = label;
        select.dataset.value = value;
        // 更新选中状态
        dropdown.querySelectorAll('.c-select-option').forEach(o => {
          o.classList.remove('selected');
          o.querySelector('.c-select-check').textContent = '';
        });
        opt.classList.add('selected');
        opt.querySelector('.c-select-check').textContent = '✓';
        select.classList.remove('open');
        onChange?.(select.id, value);
      });
    });

    // 键盘支持
    select.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') select.classList.remove('open');
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        trigger.click();
      }
    });
  });

  // 全局点击关闭
  if (!document._cSelectGlobalBound) {
    document._cSelectGlobalBound = true;
    document.addEventListener('click', closeAll);
  }
}

/**
 * 获取某个 c-select 的当前值
 */
export function getCSelectValue(id) {
  return document.getElementById(id)?.dataset.value ?? '';
}

// tag input helper
export function renderTagInput(containerId, initial = []) {
  const container = document.getElementById(containerId);
  if (!container) return;
  let tags = [...initial];

  function render() {
    container.innerHTML = `
      <div class="flex gap-4" style="flex-wrap:wrap; align-items:center; gap:6px">
        ${tags.map(t => `<span class="tag">${t}<span class="tag-remove" data-tag="${t}">×</span></span>`).join('')}
        <input class="form-input" id="${containerId}-input" placeholder="输入标签后回车" style="width:140px; padding:4px 9px; font-size:12px" />
      </div>
    `;
    container.querySelectorAll('.tag-remove').forEach(btn => {
      btn.onclick = () => { tags = tags.filter(t => t !== btn.dataset.tag); render(); };
    });
    const inp = document.getElementById(`${containerId}-input`);
    inp.onkeydown = (e) => {
      if ((e.key === 'Enter' || e.key === ',') && inp.value.trim()) {
        e.preventDefault();
        const val = inp.value.trim().replace(',', '');
        if (!tags.includes(val)) tags.push(val);
        render();
      }
    };
  }
  render();
  container.getTags = () => tags;
}
