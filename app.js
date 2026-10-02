'use strict';

/* =========================================================
 * 할 일 관리 앱 - 순수 JavaScript
 * 상태는 todos 배열 하나로 관리하고,
 * 모든 변경 후 saveTodos() → render() 순서로 호출한다.
 * ========================================================= */

const STORAGE_KEY = 'todos';
const MAX_LENGTH = 100;

const CATEGORIES = {
  work: '업무',
  personal: '개인',
  study: '공부',
};

// ----- 상태 -----
let todos = loadTodos();
let currentFilter = 'all';
let editingId = null;

// ----- DOM -----
const $ = (id) => document.getElementById(id);
const els = {
  today: $('today'),
  totalText: $('total-text'),
  totalBar: $('total-bar'),
  totalFill: $('total-fill'),
  catProgress: $('cat-progress'),
  form: $('add-form'),
  input: $('new-text'),
  category: $('new-category'),
  formError: $('form-error'),
  filters: $('filters'),
  list: $('todo-list'),
  empty: $('empty'),
  clearDone: $('clear-done'),
  toast: $('toast'),
};

/* ===================== 저장 / 복원 ===================== */

function loadTodos() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    console.warn('localStorage를 읽을 수 없습니다.', err);
    return [];
  }
  if (!raw) return [];

  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error('배열이 아닙니다.');
    // 형식이 맞는 항목만 남긴다.
    return data.filter(
      (t) => t && typeof t.id === 'string' && typeof t.text === 'string' && t.category in CATEGORIES
    );
  } catch (err) {
    console.warn('저장된 데이터가 손상되어 빈 목록으로 시작합니다.', err);
    return [];
  }
}

function saveTodos() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch (err) {
    console.error(err);
    showToast('저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.');
  }
}

/* ===================== 상태 변경 함수 ===================== */

function createId() {
  // Date.now() 기반 문자열, 같은 밀리초에 여러 번 호출돼도 겹치지 않게 보정
  let id = String(Date.now());
  while (todos.some((t) => t.id === id)) id = String(Number(id) + 1);
  return id;
}

/** 입력 검증: 앞뒤 공백 제거 후 1~100자인지 확인. 문제가 있으면 메시지를 돌려준다. */
function validateText(text) {
  const value = text.trim();
  if (!value) return { ok: false, message: '할 일 내용을 입력해 주세요.' };
  if (value.length > MAX_LENGTH) return { ok: false, message: `${MAX_LENGTH}자 이하로 입력해 주세요.` };
  return { ok: true, value };
}

function addTodo(text, category) {
  todos.push({
    id: createId(),
    text,
    category,
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
  });
  commit();
}

function updateTodo(id, changes) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;
  Object.assign(todo, changes);
  commit();
}

function deleteTodo(id) {
  todos = todos.filter((t) => t.id !== id);
  commit();
}

function toggleTodo(id) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;
  todo.completed = !todo.completed;
  todo.completedAt = todo.completed ? new Date().toISOString() : null;
  commit();
}

function clearCompleted() {
  todos = todos.filter((t) => !t.completed);
  commit();
}

function commit() {
  saveTodos();
  render();
}

/* ===================== 렌더링 ===================== */

function percent(done, total) {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

function renderProgress() {
  const total = todos.length;
  const done = todos.filter((t) => t.completed).length;
  const pct = percent(done, total);

  els.totalText.textContent = `${done}/${total} · ${pct}%`;
  els.totalFill.style.width = `${pct}%`;
  els.totalBar.setAttribute('aria-valuenow', String(pct));

  els.catProgress.replaceChildren(
    ...Object.entries(CATEGORIES).map(([key, label]) => {
      const items = todos.filter((t) => t.category === key);
      const catDone = items.filter((t) => t.completed).length;
      const catPct = percent(catDone, items.length);

      const li = document.createElement('li');
      li.className = 'cat-item';
      li.dataset.cat = key;

      const head = document.createElement('div');
      head.className = 'cat-head';
      const name = document.createElement('span');
      name.textContent = label;
      const num = document.createElement('span');
      num.className = 'cat-num';
      num.textContent = `${catDone}/${items.length} · ${catPct}%`;
      head.append(name, num);

      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-label', `${label} 진행률`);
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');
      bar.setAttribute('aria-valuenow', String(catPct));
      const fill = document.createElement('div');
      fill.className = 'bar-fill';
      fill.style.width = `${catPct}%`;
      bar.append(fill);

      li.append(head, bar);
      return li;
    })
  );
}

function createCategorySelect(selected) {
  const select = document.createElement('select');
  select.setAttribute('aria-label', '카테고리');
  for (const [key, label] of Object.entries(CATEGORIES)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = label;
    opt.selected = key === selected;
    select.append(opt);
  }
  return select;
}

function createTodoItem(todo) {
  const li = document.createElement('li');
  li.className = 'todo' + (todo.completed ? ' is-done' : '');
  li.dataset.id = todo.id;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = todo.completed;
  checkbox.dataset.action = 'toggle';
  checkbox.setAttribute('aria-label', `${todo.text} 완료`);

  const badge = document.createElement('span');
  badge.className = `badge badge-${todo.category}`;
  badge.textContent = CATEGORIES[todo.category];

  li.append(checkbox, badge);

  if (todo.id === editingId) {
    // 인라인 수정 모드
    const row = document.createElement('div');
    row.className = 'edit-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = todo.text;
    input.maxLength = MAX_LENGTH;
    input.className = 'edit-input';
    input.setAttribute('aria-label', '할 일 수정');
    const select = createCategorySelect(todo.category);
    select.className = 'edit-category';
    row.append(input, select);

    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.append(
      createIconButton('저장', 'save', '수정 내용 저장'),
      createIconButton('취소', 'cancel', '수정 취소')
    );
    li.append(row, actions);
  } else {
    const text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = todo.text; // textContent로 출력해 XSS 방지
    text.title = '더블클릭해서 수정';

    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.append(
      createIconButton('수정', 'edit', `${todo.text} 수정`),
      createIconButton('삭제', 'delete', `${todo.text} 삭제`)
    );
    li.append(text, actions);
  }

  return li;
}

function createIconButton(label, action, ariaLabel) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `icon-btn ${action}`;
  btn.dataset.action = action;
  btn.textContent = label;
  btn.setAttribute('aria-label', ariaLabel);
  return btn;
}

function getVisibleTodos() {
  const list = currentFilter === 'all' ? todos : todos.filter((t) => t.category === currentFilter);
  // 미완료 항목을 위에, 완료 항목을 아래에 (각 그룹 안에서는 추가한 순서 유지)
  return [...list.filter((t) => !t.completed), ...list.filter((t) => t.completed)];
}

function renderList() {
  const visible = getVisibleTodos();
  els.list.replaceChildren(...visible.map(createTodoItem));

  if (visible.length === 0) {
    els.empty.hidden = false;
    els.empty.textContent =
      todos.length === 0
        ? '오늘 할 일을 추가해 보세요'
        : `${CATEGORIES[currentFilter]} 카테고리에 할 일이 없어요`;
  } else {
    els.empty.hidden = true;
  }

  els.clearDone.disabled = !todos.some((t) => t.completed);

  // 수정 모드라면 입력창에 포커스
  if (editingId) {
    const input = els.list.querySelector('.edit-input');
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }
}

function renderFilters() {
  els.filters.querySelectorAll('.filter').forEach((btn) => {
    const active = btn.dataset.filter === currentFilter;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });
}

function render() {
  renderProgress();
  renderFilters();
  renderList();
}

/* ===================== 수정 모드 ===================== */

function startEdit(id) {
  editingId = id;
  renderList();
}

function cancelEdit() {
  editingId = null;
  renderList();
}

function saveEdit() {
  const li = els.list.querySelector(`.todo[data-id="${editingId}"]`);
  if (!li) return cancelEdit();
  const input = li.querySelector('.edit-input');
  const select = li.querySelector('.edit-category');
  const result = validateText(input.value);
  if (!result.ok) {
    showToast(result.message);
    input.focus();
    return;
  }
  const id = editingId;
  editingId = null;
  updateTodo(id, { text: result.value, category: select.value });
}

/* ===================== 알림 ===================== */

let toastTimer = null;
function showToast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 3000);
}

function showFormError(message) {
  els.formError.textContent = message;
  els.formError.hidden = !message;
}

/* ===================== 이벤트 ===================== */

// 할 일 추가 (Enter 또는 추가 버튼)
els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const result = validateText(els.input.value);
  if (!result.ok) {
    showFormError(result.message);
    els.input.focus();
    return;
  }
  showFormError('');
  addTodo(result.value, els.category.value); // 카테고리 선택은 유지
  els.input.value = '';
  els.input.focus();
});

els.input.addEventListener('input', () => showFormError(''));

// 필터 탭
els.filters.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter');
  if (!btn) return;
  currentFilter = btn.dataset.filter;
  editingId = null;
  renderFilters();
  renderList();
});

// 목록: 이벤트 위임 (ul에 리스너 하나)
els.list.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const id = target.closest('.todo').dataset.id;

  switch (target.dataset.action) {
    case 'toggle':
      toggleTodo(id);
      break;
    case 'edit':
      startEdit(id);
      break;
    case 'delete': {
      const todo = todos.find((t) => t.id === id);
      if (todo && confirm(`"${todo.text}"을(를) 삭제할까요?`)) {
        if (editingId === id) editingId = null;
        deleteTodo(id);
      }
      break;
    }
    case 'save':
      saveEdit();
      break;
    case 'cancel':
      cancelEdit();
      break;
  }
});

// 텍스트 더블클릭으로 수정
els.list.addEventListener('dblclick', (e) => {
  const text = e.target.closest('.todo-text');
  if (!text) return;
  startEdit(text.closest('.todo').dataset.id);
});

// 수정 중 Enter 저장, Esc 취소
els.list.addEventListener('keydown', (e) => {
  if (!editingId || !e.target.closest('.edit-row')) return;
  if (e.key === 'Enter' && !e.isComposing) {
    e.preventDefault();
    saveEdit();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    cancelEdit();
  }
});

// 완료 항목 한 번에 삭제
els.clearDone.addEventListener('click', () => {
  const count = todos.filter((t) => t.completed).length;
  if (count === 0) return;
  if (confirm(`완료된 할 일 ${count}개를 삭제할까요?`)) {
    editingId = null;
    clearCompleted();
  }
});

// 다른 탭에서 데이터가 바뀌면 다시 불러오기
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY) return;
  todos = loadTodos();
  editingId = null;
  render();
});

/* ===================== 시작 ===================== */

els.today.textContent = new Date().toLocaleDateString('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
});

render();
