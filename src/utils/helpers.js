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
