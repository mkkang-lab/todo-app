const STORAGE_KEY  = 'todos';
const GROUPS_KEY   = 'todo-groups';

const PRIORITY_OPTS = [
  { value: 'high',   label: '높음' },
  { value: 'medium', label: '보통' },
  { value: 'low',    label: '낮음' },
];

// ── 마인크래프트 캐릭터 아이콘 (픽셀 아트 SVG) ──

function mcIcon(priority, size = 22) {
  const s = size;
  const icons = {
    // 크리퍼 – 높음 우선순위 (위험/긴급)
    high: `<svg width="${s}" height="${s}" viewBox="0 0 16 16"
            xmlns="http://www.w3.org/2000/svg"
            style="image-rendering:pixelated;display:block"
            title="높음 - Creeper">
      <rect width="16" height="16" fill="#4CAF50"/>
      <rect x="0" y="0" width="16" height="2" fill="#388E3C"/>
      <!-- 눈 -->
      <rect x="1" y="4" width="5" height="5" fill="#1A1A1A"/>
      <rect x="10" y="4" width="5" height="5" fill="#1A1A1A"/>
      <!-- 찡그린 입 -->
      <rect x="5" y="10" width="2" height="5" fill="#1A1A1A"/>
      <rect x="9" y="10" width="2" height="5" fill="#1A1A1A"/>
      <rect x="6" y="9" width="4" height="2" fill="#1A1A1A"/>
      <rect x="4" y="11" width="8" height="2" fill="#1A1A1A"/>
    </svg>`,

    // 스티브 – 보통 우선순위
    medium: `<svg width="${s}" height="${s}" viewBox="0 0 16 16"
              xmlns="http://www.w3.org/2000/svg"
              style="image-rendering:pixelated;display:block"
              title="보통 - Steve">
      <rect width="16" height="16" fill="#C8996B"/>
      <!-- 머리카락 -->
      <rect x="0" y="0" width="16" height="5" fill="#4A2C0A"/>
      <rect x="0" y="5" width="3"  height="4" fill="#4A2C0A"/>
      <!-- 눈 -->
      <rect x="3" y="5" width="4" height="4" fill="#fff"/>
      <rect x="4" y="6" width="2" height="2" fill="#222"/>
      <rect x="9" y="5" width="4" height="4" fill="#fff"/>
      <rect x="10" y="6" width="2" height="2" fill="#222"/>
      <!-- 입 -->
      <rect x="4" y="11" width="8" height="3" fill="#4A2C0A"/>
      <rect x="4" y="11" width="2" height="1" fill="#C8996B"/>
      <rect x="10" y="11" width="2" height="1" fill="#C8996B"/>
    </svg>`,

    // 돼지 – 낮음 우선순위 (평화로움)
    low: `<svg width="${s}" height="${s}" viewBox="0 0 16 16"
           xmlns="http://www.w3.org/2000/svg"
           style="image-rendering:pixelated;display:block"
           title="낮음 - Pig">
      <rect width="16" height="16" fill="#F48B8B"/>
      <!-- 귀 -->
      <rect x="0" y="0" width="4" height="4" fill="#E57373"/>
      <rect x="12" y="0" width="4" height="4" fill="#E57373"/>
      <!-- 눈 -->
      <rect x="3" y="4" width="3" height="3" fill="#1A1A1A"/>
      <rect x="10" y="4" width="3" height="3" fill="#1A1A1A"/>
      <!-- 콧구멍 -->
      <rect x="4" y="9" width="8" height="5" fill="#E57373"/>
      <rect x="5" y="10" width="2" height="2" fill="#1A1A1A"/>
      <rect x="9" y="10" width="2" height="2" fill="#1A1A1A"/>
    </svg>`,
  };
  return icons[priority] ?? icons.medium;
}

// ── 상태 ──
let todos  = [];
let groups = [];
let activeFilter         = 'all';
let activePriorityFilter = 'all';

// 드래그 상태
let dragId         = null;
let dropTargetId   = null;
let dropTargetType = null; // 'todo-standalone' | 'todo-in-group' | 'group-header'
let dropMode       = null; // 'before' | 'after' | 'group' | 'join'

// ── 영속성 ──

function loadTodos()  { try { todos  = JSON.parse(localStorage.getItem(STORAGE_KEY))  || []; } catch { todos  = []; } }
function saveTodos()  { localStorage.setItem(STORAGE_KEY,  JSON.stringify(todos));  }
function loadGroups() { try { groups = JSON.parse(localStorage.getItem(GROUPS_KEY)) || []; } catch { groups = []; } }
function saveGroups() { localStorage.setItem(GROUPS_KEY, JSON.stringify(groups)); }

// ── Todo 변경 ──

function addTodo(text, priority) {
  const trimmed = text.trim();
  if (!trimmed) return;
  todos.push({ id: Date.now(), text: trimmed, completed: false, priority, groupId: null, createdAt: new Date().toISOString() });
  saveTodos();
  render();
}

function toggleTodo(id) {
  const t = todos.find(t => t.id === id);
  if (t) { t.completed = !t.completed; saveTodos(); render(); }
}

function deleteTodo(id) {
  const t = todos.find(t => t.id === id);
  const gid = t?.groupId;
  todos = todos.filter(t => t.id !== id);
  if (gid) cleanupGroup(gid);
  saveTodos(); saveGroups(); render();
}

function changePriority(id, priority) {
  const t = todos.find(t => t.id === id);
  if (t) { t.priority = priority; saveTodos(); render(); }
}

function clearCompleted() {
  const gids = [...new Set(todos.filter(t => t.completed && t.groupId).map(t => t.groupId))];
  todos = todos.filter(t => !t.completed);
  gids.forEach(cleanupGroup);
  saveTodos(); saveGroups(); render();
}

// ── 그룹 변경 ──

// 그룹 멤버가 1명 이하면 자동 해산
function cleanupGroup(groupId) {
  const members = todos.filter(t => t.groupId === groupId);
  if (members.length < 2) {
    members.forEach(t => { t.groupId = null; });
    groups = groups.filter(g => g.id !== groupId);
  }
}

function ungroupTodo(todoId) {
  const t = todos.find(t => t.id === todoId);
  if (!t?.groupId) return;
  const gid = t.groupId;
  t.groupId = null;
  cleanupGroup(gid);
  saveTodos(); saveGroups(); render();
}

function disbandGroup(groupId) {
  todos.forEach(t => { if (t.groupId === groupId) t.groupId = null; });
  groups = groups.filter(g => g.id !== groupId);
  saveTodos(); saveGroups(); render();
}

function renameGroup(groupId, name) {
  const g = groups.find(g => g.id === groupId);
  if (g) { g.name = name; saveGroups(); }
}

function toggleGroupCollapse(groupId) {
  const g = groups.find(g => g.id === groupId);
  if (g) { g.collapsed = !g.collapsed; saveGroups(); render(); }
}

// ── 드래그로 그룹 생성/합류 ──

// 두 standalone todo를 그룹으로 묶거나 기존 그룹에 추가
function mergeTodos(fromId, toId) {
  const from = todos.find(t => t.id === fromId);
  const to   = todos.find(t => t.id === toId);
  if (!from || !to || from.id === to.id) return;

  const oldFromGid = from.groupId;
  let targetGid;

  if (to.groupId) {
    targetGid = to.groupId;
  } else if (from.groupId) {
    targetGid = from.groupId;
    to.groupId = targetGid;
  } else {
    targetGid = Date.now();
    groups.push({ id: targetGid, name: `그룹 ${groups.length + 1}`, collapsed: false });
    to.groupId = targetGid;
  }

  from.groupId = targetGid;
  if (oldFromGid && oldFromGid !== targetGid) cleanupGroup(oldFromGid);

  // from을 to 바로 뒤로 이동 (배열에서 그룹 멤버가 인접하도록)
  const fromIdx = todos.indexOf(from);
  todos.splice(fromIdx, 1);
  todos.splice(todos.indexOf(to) + 1, 0, from);

  saveTodos(); saveGroups(); render();
}

// 기존 그룹에 todo 추가 (그룹 헤더에 드롭 시)
function joinGroup(todoId, groupId) {
  const t = todos.find(t => t.id === todoId);
  if (!t) return;
  const oldGid = t.groupId;
  t.groupId = groupId;
  if (oldGid && oldGid !== groupId) cleanupGroup(oldGid);

  // 그룹 마지막 멤버 뒤로 이동
  const members = todos.filter(m => m.groupId === groupId && m.id !== todoId);
  if (members.length > 0) {
    const last = members[members.length - 1];
    const fi = todos.indexOf(t);
    todos.splice(fi, 1);
    todos.splice(todos.indexOf(last) + 1, 0, t);
  }

  saveTodos(); saveGroups(); render();
}

// ── 표시 로우 계산 ──

function getSortedFiltered() {
  let list = todos;
  if (activeFilter === 'active')    list = list.filter(t => !t.completed);
  if (activeFilter === 'completed') list = list.filter(t => t.completed);
  if (activePriorityFilter !== 'all') list = list.filter(t => t.priority === activePriorityFilter);
  return [...list].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
}

// todos 배열 순서 기준으로 display rows 구성 (그룹은 첫 멤버 위치에)
function getDisplayRows(filtered) {
  const rows = [];
  const seenGids = new Set();

  for (const todo of filtered) {
    if (!todo.groupId) {
      rows.push({ type: 'todo', todo });
    } else if (!seenGids.has(todo.groupId)) {
      seenGids.add(todo.groupId);
      const group = groups.find(g => g.id === todo.groupId);
      if (!group) { rows.push({ type: 'todo', todo }); continue; } // orphan
      const members = filtered.filter(t => t.groupId === todo.groupId);
      rows.push({ type: 'group', group, members });
    }
  }
  return rows;
}

// ── DOM 빌더 ──

function makePrioritySelect(todo) {
  const sel = document.createElement('select');
  sel.className = 'priority-change';
  PRIORITY_OPTS.forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value; opt.textContent = label;
    if (value === todo.priority) opt.selected = true;
    sel.appendChild(opt);
  });
  return sel;
}

function createTodoEl(todo, inGroup = false) {
  const li = document.createElement('li');
  li.className = `todo-item priority-${todo.priority}${todo.completed ? ' completed' : ''}${inGroup ? ' in-group' : ''}`;
  li.dataset.id = todo.id;
  li.draggable = true;

  const handle = document.createElement('span');
  handle.className = 'drag-handle';
  handle.textContent = '⠿';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'todo-checkbox';
  checkbox.checked = todo.completed;

  // 마인크래프트 우선순위 아이콘
  const iconEl = document.createElement('span');
  iconEl.className = 'mc-priority-icon';
  iconEl.innerHTML = mcIcon(todo.priority, 22);

  const textSpan = document.createElement('span');
  textSpan.className = 'todo-text';
  textSpan.textContent = todo.text;

  li.appendChild(handle);
  li.appendChild(checkbox);
  li.appendChild(iconEl);
  li.appendChild(textSpan);
  li.appendChild(makePrioritySelect(todo));

  if (inGroup) {
    const ugBtn = document.createElement('button');
    ugBtn.className = 'ungroup-btn';
    ugBtn.textContent = '⊖';
    ugBtn.title = '그룹에서 제거';
    li.appendChild(ugBtn);
  }

  const delBtn = document.createElement('button');
  delBtn.className = 'delete-btn';
  delBtn.textContent = '✕';
  li.appendChild(delBtn);

  return li;
}

function createGroupEl(group, members) {
  const li = document.createElement('li');
  li.className = `group-row${group.collapsed ? ' collapsed' : ''}`;
  li.dataset.groupId = group.id;

  // 헤더
  const header = document.createElement('div');
  header.className = 'group-header';

  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'group-collapse-btn';
  collapseBtn.textContent = '▼';
  collapseBtn.dataset.groupId = group.id;
  collapseBtn.title = group.collapsed ? '펼치기' : '접기';

  const nameEl = document.createElement('span');
  nameEl.className = 'group-name';
  nameEl.contentEditable = 'true';
  nameEl.spellcheck = false;
  nameEl.textContent = group.name;
  nameEl.dataset.groupId = group.id;
  nameEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); } });
  nameEl.addEventListener('blur', () => {
    const name = nameEl.textContent.trim() || group.name;
    nameEl.textContent = name;
    renameGroup(group.id, name);
  });
  // 이름 편집 중 드래그 방지
  nameEl.addEventListener('mousedown', e => e.stopPropagation());

  const countEl = document.createElement('span');
  countEl.className = 'group-count';
  countEl.textContent = `${members.length}개`;

  const disbandBtn = document.createElement('button');
  disbandBtn.className = 'group-disband-btn';
  disbandBtn.textContent = '그룹 해제';
  disbandBtn.dataset.groupId = group.id;

  header.appendChild(collapseBtn);
  header.appendChild(nameEl);
  header.appendChild(countEl);
  header.appendChild(disbandBtn);

  // 바디
  const body = document.createElement('ul');
  body.className = 'group-body';
  members.forEach(todo => body.appendChild(createTodoEl(todo, true)));

  li.appendChild(header);
  li.appendChild(body);
  return li;
}

// ── 렌더 ──

function render() {
  const list = document.getElementById('todo-list');
  const rows = getDisplayRows(getSortedFiltered());
  list.innerHTML = '';

  if (rows.length === 0) {
    const msg = document.createElement('li');
    msg.className = 'empty-msg';
    msg.textContent = '할 일이 없습니다.';
    list.appendChild(msg);
  } else {
    rows.forEach(row => {
      list.appendChild(row.type === 'todo'
        ? createTodoEl(row.todo, false)
        : createGroupEl(row.group, row.members));
    });
  }

  updateFooter();
}

function updateFooter() {
  document.getElementById('remaining-count').textContent =
    `${todos.filter(t => !t.completed).length}개 남음`;
}

// ── 드래그 앤 드롭 ──

function clearDragClasses() {
  document.querySelectorAll('.todo-item, .group-row, .group-header').forEach(el => {
    el.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom', 'drop-group-target');
  });
}

// zones: 'two' → 상/하, 'three' → 상/그룹/하
function calcDropMode(e, el, zones) {
  const { top, height } = el.getBoundingClientRect();
  const ratio = (e.clientY - top) / height;
  if (zones === 'two')   return ratio < 0.5 ? 'before' : 'after';
  if (ratio < 0.3)       return 'before';
  if (ratio > 0.7)       return 'after';
  return 'group';
}

function initDragDrop() {
  const list = document.getElementById('todo-list');

  list.addEventListener('dragstart', e => {
    const item = e.target.closest('.todo-item');
    if (!item) return;
    dragId = Number(item.dataset.id);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => item.classList.add('dragging'), 0);
  });

  list.addEventListener('dragend', () => {
    clearDragClasses();
    dragId = null; dropTargetId = null; dropTargetType = null; dropMode = null;
  });

  list.addEventListener('dragover', e => {
    e.preventDefault();
    if (!dragId) return;
    e.dataTransfer.dropEffect = 'move';

    clearDragClasses();
    document.querySelector(`.todo-item[data-id="${dragId}"]`)?.classList.add('dragging');

    const targetTodo   = e.target.closest('.todo-item');
    const targetHeader = !targetTodo ? e.target.closest('.group-header') : null;

    if (targetTodo && Number(targetTodo.dataset.id) !== dragId) {
      // ── todo 위에 드롭 ──
      dropTargetId   = Number(targetTodo.dataset.id);
      const inGroup  = !!targetTodo.closest('.group-body');
      dropTargetType = inGroup ? 'todo-in-group' : 'todo-standalone';
      dropMode       = calcDropMode(e, targetTodo, inGroup ? 'two' : 'three');

      if (dropMode === 'before') targetTodo.classList.add('drag-over-top');
      else if (dropMode === 'after') targetTodo.classList.add('drag-over-bottom');
      else targetTodo.classList.add('drop-group-target'); // 'group'

    } else if (targetHeader) {
      // ── 그룹 헤더 위에 드롭 ──
      const groupRow = targetHeader.closest('.group-row');
      dropTargetId   = Number(groupRow.dataset.groupId);
      dropTargetType = 'group-header';
      dropMode       = calcDropMode(e, groupRow, 'three');

      if (dropMode === 'before') groupRow.classList.add('drag-over-top');
      else if (dropMode === 'after') groupRow.classList.add('drag-over-bottom');
      else targetHeader.classList.add('drop-group-target'); // 'group' = join

    } else {
      dropTargetId = null; dropTargetType = null; dropMode = null;
    }
  });

  list.addEventListener('dragleave', e => {
    if (!list.contains(e.relatedTarget)) {
      clearDragClasses();
      dropTargetId = null; dropTargetType = null; dropMode = null;
    }
  });

  list.addEventListener('drop', e => {
    e.preventDefault();
    if (!dragId || !dropTargetId || !dropMode) { clearDragClasses(); return; }

    const fromTodo = todos.find(t => t.id === dragId);
    if (!fromTodo) { clearDragClasses(); return; }

    if (dropMode === 'group' && dropTargetType === 'todo-standalone') {
      // 두 독립 항목 → 그룹 생성 또는 기존 그룹에 합류
      mergeTodos(dragId, dropTargetId);

    } else if (dropMode === 'group' && dropTargetType === 'group-header') {
      // 그룹 헤더 가운데에 드롭 → 해당 그룹에 추가
      joinGroup(dragId, dropTargetId);

    } else {
      // before / after → 재정렬
      let oldGid = null;
      const isOutside = (dropTargetType === 'todo-standalone' || dropTargetType === 'group-header');

      // 그룹 외부에 드롭하면 자동 그룹 해제
      if (fromTodo.groupId && isOutside) {
        oldGid = fromTodo.groupId;
        fromTodo.groupId = null;
      }

      // 그룹 내부 → 다른 그룹으로 이동
      if (dropTargetType === 'todo-in-group') {
        const targetTodo = todos.find(t => t.id === dropTargetId);
        if (targetTodo?.groupId && targetTodo.groupId !== fromTodo.groupId) {
          oldGid = fromTodo.groupId;
          fromTodo.groupId = targetTodo.groupId;
        }
      }

      // 배열에서 꺼낸 뒤 삽입
      const fromIdx = todos.indexOf(fromTodo);
      todos.splice(fromIdx, 1);

      if (dropTargetType === 'group-header') {
        // 그룹 전체의 앞/뒤
        const members = todos.filter(t => t.groupId === dropTargetId);
        const indices = members.map(m => todos.indexOf(m));
        const pos = dropMode === 'before'
          ? Math.min(...indices)
          : Math.max(...indices) + 1;
        todos.splice(Math.max(0, pos), 0, fromTodo);
      } else {
        const toIdx = todos.findIndex(t => t.id === dropTargetId);
        todos.splice(dropMode === 'before' ? toIdx : toIdx + 1, 0, fromTodo);
      }

      if (oldGid) cleanupGroup(oldGid);
      saveTodos(); saveGroups(); render();
    }

    clearDragClasses();
    dragId = null; dropTargetId = null; dropTargetType = null; dropMode = null;
  });
}

// ── 커스텀 우선순위 드롭다운 ──

function initPrioritySelect() {
  const hiddenInput = document.getElementById('priority-select');
  const btn         = document.getElementById('priority-select-btn');
  const iconEl      = document.getElementById('priority-select-icon');
  const labelEl     = document.getElementById('priority-select-label');
  const menu        = document.getElementById('priority-select-menu');

  function setSelected(value) {
    const opt = PRIORITY_OPTS.find(o => o.value === value) ?? PRIORITY_OPTS[1];
    hiddenInput.value = opt.value;
    iconEl.innerHTML  = mcIcon(opt.value, 20);
    labelEl.textContent = opt.label;
    menu.querySelectorAll('.priority-select-option').forEach(li => {
      li.classList.toggle('selected', li.dataset.value === opt.value);
    });
  }

  // 메뉴 항목 생성
  PRIORITY_OPTS.forEach(({ value, label }) => {
    const li = document.createElement('li');
    li.className = 'priority-select-option';
    li.role = 'option';
    li.dataset.value = value;
    li.innerHTML = `<span style="display:flex">${mcIcon(value, 20)}</span><span>${label}</span>`;
    li.addEventListener('click', () => {
      setSelected(value);
      closeMenu();
    });
    menu.appendChild(li);
  });

  function openMenu()  { menu.classList.add('open');    btn.setAttribute('aria-expanded', 'true');  }
  function closeMenu() { menu.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }

  btn.addEventListener('click', e => {
    e.stopPropagation();
    menu.classList.contains('open') ? closeMenu() : openMenu();
  });

  document.addEventListener('click', closeMenu);
  menu.addEventListener('click', e => e.stopPropagation());

  setSelected('medium');
}

initPrioritySelect();

// ── 이벤트 바인딩 ──

document.getElementById('add-btn').addEventListener('click', () => {
  const input = document.getElementById('todo-input');
  addTodo(input.value, document.getElementById('priority-select').value);
  input.value = '';
  input.focus();
});

document.getElementById('todo-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('add-btn').click();
});

document.getElementById('todo-list').addEventListener('change', e => {
  const item = e.target.closest('.todo-item');
  if (!item) return;
  const id = Number(item.dataset.id);
  if (e.target.classList.contains('todo-checkbox'))   toggleTodo(id);
  if (e.target.classList.contains('priority-change')) changePriority(id, e.target.value);
});

document.getElementById('todo-list').addEventListener('click', e => {
  const delBtn     = e.target.closest('.delete-btn');
  const ugBtn      = e.target.closest('.ungroup-btn');
  const disbandBtn = e.target.closest('.group-disband-btn');
  const collapseBtn = e.target.closest('.group-collapse-btn');

  if (delBtn)      deleteTodo(Number(delBtn.closest('.todo-item').dataset.id));
  if (ugBtn)       ungroupTodo(Number(ugBtn.closest('.todo-item').dataset.id));
  if (disbandBtn)  disbandGroup(Number(disbandBtn.dataset.groupId));
  if (collapseBtn) toggleGroupCollapse(Number(collapseBtn.dataset.groupId));
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    render();
  });
});

document.querySelectorAll('.priority-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.priority-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activePriorityFilter = btn.dataset.priority;
    render();
  });
});

document.getElementById('clear-completed-btn').addEventListener('click', clearCompleted);

// ── 초기화 ──
loadTodos();
loadGroups();
render();
initDragDrop();
