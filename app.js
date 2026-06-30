// ── Supabase 클라이언트 (URL/KEY는 config.js에서 주입) ──
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const PRIORITY_OPTS = [
  { value: 'high',   label: '높음' },
  { value: 'medium', label: '보통' },
  { value: 'low',    label: '낮음' },
];

// ── 마인크래프트 캐릭터 아이콘 (픽셀 아트 SVG) ──
function mcIcon(priority, size = 22) {
  const s = size;
  const icons = {
    high: `<svg width="${s}" height="${s}" viewBox="0 0 16 16"
            xmlns="http://www.w3.org/2000/svg"
            style="image-rendering:pixelated;display:block"
            title="높음 - Creeper">
      <rect width="16" height="16" fill="#4CAF50"/>
      <rect x="0" y="0" width="16" height="2" fill="#388E3C"/>
      <rect x="1" y="4" width="5" height="5" fill="#1A1A1A"/>
      <rect x="10" y="4" width="5" height="5" fill="#1A1A1A"/>
      <rect x="5" y="10" width="2" height="5" fill="#1A1A1A"/>
      <rect x="9" y="10" width="2" height="5" fill="#1A1A1A"/>
      <rect x="6" y="9" width="4" height="2" fill="#1A1A1A"/>
      <rect x="4" y="11" width="8" height="2" fill="#1A1A1A"/>
    </svg>`,

    medium: `<svg width="${s}" height="${s}" viewBox="0 0 16 16"
              xmlns="http://www.w3.org/2000/svg"
              style="image-rendering:pixelated;display:block"
              title="보통 - Steve">
      <rect width="16" height="16" fill="#C8996B"/>
      <rect x="0" y="0" width="16" height="5" fill="#4A2C0A"/>
      <rect x="0" y="5" width="3"  height="4" fill="#4A2C0A"/>
      <rect x="3" y="5" width="4" height="4" fill="#fff"/>
      <rect x="4" y="6" width="2" height="2" fill="#222"/>
      <rect x="9" y="5" width="4" height="4" fill="#fff"/>
      <rect x="10" y="6" width="2" height="2" fill="#222"/>
      <rect x="4" y="11" width="8" height="3" fill="#4A2C0A"/>
      <rect x="4" y="11" width="2" height="1" fill="#C8996B"/>
      <rect x="10" y="11" width="2" height="1" fill="#C8996B"/>
    </svg>`,

    low: `<svg width="${s}" height="${s}" viewBox="0 0 16 16"
           xmlns="http://www.w3.org/2000/svg"
           style="image-rendering:pixelated;display:block"
           title="낮음 - Pig">
      <rect width="16" height="16" fill="#F48B8B"/>
      <rect x="0" y="0" width="4" height="4" fill="#E57373"/>
      <rect x="12" y="0" width="4" height="4" fill="#E57373"/>
      <rect x="3" y="4" width="3" height="3" fill="#1A1A1A"/>
      <rect x="10" y="4" width="3" height="3" fill="#1A1A1A"/>
      <rect x="4" y="9" width="8" height="5" fill="#E57373"/>
      <rect x="5" y="10" width="2" height="2" fill="#1A1A1A"/>
      <rect x="9" y="10" width="2" height="2" fill="#1A1A1A"/>
    </svg>`,
  };
  return icons[priority] ?? icons.medium;
}

// ── 상태 ──
let currentUser = null;
let todos  = [];
let groups = [];
let activeFilter         = 'all';
let activePriorityFilter = 'all';

// 드래그 상태 (ID는 UUID 문자열)
let dragId         = null;
let dropTargetId   = null;
let dropTargetType = null;
let dropMode       = null;

// ── 인증 ──

function showAuthModal() {
  document.getElementById('auth-modal').classList.add('visible');
}

function hideAuthModal() {
  document.getElementById('auth-modal').classList.remove('visible');
}

function updateUserBar() {
  const el = document.getElementById('user-email');
  if (el && currentUser) el.textContent = currentUser.email;
}

async function handleSignIn() {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl    = document.getElementById('auth-error');
  errEl.style.color = 'var(--md-error)';
  errEl.textContent = '';

  if (!email || !password) {
    errEl.textContent = '이메일과 비밀번호를 입력해주세요.';
    return;
  }

  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) { errEl.textContent = error.message; return; }

  currentUser = data.user;
  updateUserBar();
  hideAuthModal();
  await loadAll();
  render();
}

async function handleSignUp() {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl    = document.getElementById('auth-error');
  errEl.style.color = 'var(--md-error)';
  errEl.textContent = '';

  if (!email || !password) {
    errEl.textContent = '이메일과 비밀번호를 입력해주세요.';
    return;
  }
  if (password.length < 6) {
    errEl.textContent = '비밀번호는 6자 이상이어야 합니다.';
    return;
  }

  const { data, error } = await db.auth.signUp({ email, password });
  if (error) { errEl.textContent = error.message; return; }

  if (data.user && !data.session) {
    errEl.style.color = '#2E7D32';
    errEl.textContent = '이메일을 확인하여 인증을 완료하세요.';
    return;
  }

  currentUser = data.user;
  updateUserBar();
  hideAuthModal();
  await loadAll();
  render();
}

async function handleSignOut() {
  await db.auth.signOut();
  currentUser = null;
  todos = [];
  groups = [];
  render();
  showAuthModal();
}

// ── 데이터 로드 ──

async function loadAll() {
  const uid = currentUser.id;
  const [{ data: groupData, error: ge }, { data: todoData, error: te }] = await Promise.all([
    db.from('todo_groups').select('*').eq('user_id', uid).order('position'),
    db.from('todos').select('*').eq('user_id', uid).order('position'),
  ]);

  if (ge || te) { console.error(ge || te); return; }

  groups = (groupData || []).map(g => ({
    id:        g.id,
    name:      g.name,
    collapsed: g.collapsed,
  }));

  todos = (todoData || []).map(t => ({
    id:        t.id,
    text:      t.text,
    completed: t.completed,
    priority:  t.priority,
    groupId:   t.group_id,
    createdAt: t.created_at,
  }));
}

async function syncTodoPositions() {
  await Promise.all(
    todos.map((t, i) => db.from('todos').update({ position: i }).eq('id', t.id))
  );
}

// ── Todo 변경 ──

async function addTodo(text, priority) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const { data, error } = await db.from('todos').insert({
    user_id:   currentUser.id,
    text:      trimmed,
    completed: false,
    priority,
    group_id:  null,
    position:  todos.length,
  }).select().single();

  if (error) { console.error(error); return; }

  todos.push({
    id:        data.id,
    text:      data.text,
    completed: data.completed,
    priority:  data.priority,
    groupId:   data.group_id,
    createdAt: data.created_at,
  });
  render();
}

async function toggleTodo(id) {
  const t = todos.find(t => t.id === id);
  if (!t) return;
  t.completed = !t.completed;
  render();
  await db.from('todos').update({ completed: t.completed }).eq('id', id);
}

async function deleteTodo(id) {
  const t   = todos.find(t => t.id === id);
  const gid = t?.groupId;
  todos = todos.filter(t => t.id !== id);
  render();
  await db.from('todos').delete().eq('id', id);
  if (gid) await cleanupGroup(gid);
}

async function changePriority(id, priority) {
  const t = todos.find(t => t.id === id);
  if (!t) return;
  t.priority = priority;
  render();
  await db.from('todos').update({ priority }).eq('id', id);
}

async function clearCompleted() {
  const completed = todos.filter(t => t.completed);
  const gids = [...new Set(completed.filter(t => t.groupId).map(t => t.groupId))];
  const ids   = completed.map(t => t.id);
  todos = todos.filter(t => !t.completed);
  render();
  if (ids.length) await db.from('todos').delete().in('id', ids);
  for (const gid of gids) await cleanupGroup(gid);
}

// ── 그룹 변경 ──

async function cleanupGroup(groupId) {
  const members = todos.filter(t => t.groupId === groupId);
  if (members.length < 2) {
    members.forEach(t => { t.groupId = null; });
    groups = groups.filter(g => g.id !== groupId);
    if (members.length > 0) {
      await db.from('todos').update({ group_id: null }).in('id', members.map(m => m.id));
    }
    await db.from('todo_groups').delete().eq('id', groupId);
  }
}

async function ungroupTodo(todoId) {
  const t = todos.find(t => t.id === todoId);
  if (!t?.groupId) return;
  const gid = t.groupId;
  t.groupId = null;
  await db.from('todos').update({ group_id: null }).eq('id', todoId);
  await cleanupGroup(gid);
  render();
}

async function disbandGroup(groupId) {
  const memberIds = todos.filter(t => t.groupId === groupId).map(t => t.id);
  todos.forEach(t => { if (t.groupId === groupId) t.groupId = null; });
  groups = groups.filter(g => g.id !== groupId);
  render();
  if (memberIds.length) await db.from('todos').update({ group_id: null }).in('id', memberIds);
  await db.from('todo_groups').delete().eq('id', groupId);
}

async function renameGroup(groupId, name) {
  const g = groups.find(g => g.id === groupId);
  if (g) {
    g.name = name;
    await db.from('todo_groups').update({ name }).eq('id', groupId);
  }
}

async function toggleGroupCollapse(groupId) {
  const g = groups.find(g => g.id === groupId);
  if (g) {
    g.collapsed = !g.collapsed;
    render();
    await db.from('todo_groups').update({ collapsed: g.collapsed }).eq('id', groupId);
  }
}

// ── 드래그로 그룹 생성/합류 ──

async function mergeTodos(fromId, toId) {
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
    const { data: newGroup, error } = await db.from('todo_groups').insert({
      user_id:   currentUser.id,
      name:      `그룹 ${groups.length + 1}`,
      collapsed: false,
      position:  groups.length,
    }).select().single();

    if (error) { console.error(error); return; }

    targetGid = newGroup.id;
    groups.push({ id: targetGid, name: newGroup.name, collapsed: false });
    to.groupId = targetGid;
  }

  from.groupId = targetGid;
  if (oldFromGid && oldFromGid !== targetGid) await cleanupGroup(oldFromGid);

  const fromIdx = todos.indexOf(from);
  todos.splice(fromIdx, 1);
  todos.splice(todos.indexOf(to) + 1, 0, from);

  render();

  await Promise.all([
    db.from('todos').update({ group_id: targetGid }).eq('id', from.id),
    db.from('todos').update({ group_id: targetGid }).eq('id', to.id),
  ]);
  await syncTodoPositions();
}

async function joinGroup(todoId, groupId) {
  const t = todos.find(t => t.id === todoId);
  if (!t) return;
  const oldGid = t.groupId;
  t.groupId = groupId;

  const members = todos.filter(m => m.groupId === groupId && m.id !== todoId);
  if (members.length > 0) {
    const last = members[members.length - 1];
    const fi   = todos.indexOf(t);
    todos.splice(fi, 1);
    todos.splice(todos.indexOf(last) + 1, 0, t);
  }

  if (oldGid && oldGid !== groupId) await cleanupGroup(oldGid);

  render();

  await db.from('todos').update({ group_id: groupId }).eq('id', todoId);
  await syncTodoPositions();
}

// ── 표시 로우 계산 ──

function getSortedFiltered() {
  let list = todos;
  if (activeFilter === 'active')    list = list.filter(t => !t.completed);
  if (activeFilter === 'completed') list = list.filter(t => t.completed);
  if (activePriorityFilter !== 'all') list = list.filter(t => t.priority === activePriorityFilter);
  return [...list].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
}

function getDisplayRows(filtered) {
  const rows = [];
  const seenGids = new Set();

  for (const todo of filtered) {
    if (!todo.groupId) {
      rows.push({ type: 'todo', todo });
    } else if (!seenGids.has(todo.groupId)) {
      seenGids.add(todo.groupId);
      const group = groups.find(g => g.id === todo.groupId);
      if (!group) { rows.push({ type: 'todo', todo }); continue; }
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

function calcDropMode(e, el, zones) {
  const { top, height } = el.getBoundingClientRect();
  const ratio = (e.clientY - top) / height;
  if (zones === 'two')  return ratio < 0.5 ? 'before' : 'after';
  if (ratio < 0.3)      return 'before';
  if (ratio > 0.7)      return 'after';
  return 'group';
}

function initDragDrop() {
  const list = document.getElementById('todo-list');

  list.addEventListener('dragstart', e => {
    const item = e.target.closest('.todo-item');
    if (!item) return;
    dragId = item.dataset.id;
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

    if (targetTodo && targetTodo.dataset.id !== dragId) {
      dropTargetId   = targetTodo.dataset.id;
      const inGroup  = !!targetTodo.closest('.group-body');
      dropTargetType = inGroup ? 'todo-in-group' : 'todo-standalone';
      dropMode       = calcDropMode(e, targetTodo, inGroup ? 'two' : 'three');

      if (dropMode === 'before')      targetTodo.classList.add('drag-over-top');
      else if (dropMode === 'after')  targetTodo.classList.add('drag-over-bottom');
      else                            targetTodo.classList.add('drop-group-target');

    } else if (targetHeader) {
      const groupRow = targetHeader.closest('.group-row');
      dropTargetId   = groupRow.dataset.groupId;
      dropTargetType = 'group-header';
      dropMode       = calcDropMode(e, groupRow, 'three');

      if (dropMode === 'before')      groupRow.classList.add('drag-over-top');
      else if (dropMode === 'after')  groupRow.classList.add('drag-over-bottom');
      else                            targetHeader.classList.add('drop-group-target');

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

  list.addEventListener('drop', async e => {
    e.preventDefault();
    if (!dragId || !dropTargetId || !dropMode) { clearDragClasses(); return; }

    const fromTodo = todos.find(t => t.id === dragId);
    if (!fromTodo) { clearDragClasses(); return; }

    if (dropMode === 'group' && dropTargetType === 'todo-standalone') {
      await mergeTodos(dragId, dropTargetId);

    } else if (dropMode === 'group' && dropTargetType === 'group-header') {
      await joinGroup(dragId, dropTargetId);

    } else {
      let oldGid = null;
      const isOutside = (dropTargetType === 'todo-standalone' || dropTargetType === 'group-header');

      if (fromTodo.groupId && isOutside) {
        oldGid = fromTodo.groupId;
        fromTodo.groupId = null;
      }

      if (dropTargetType === 'todo-in-group') {
        const targetTodo = todos.find(t => t.id === dropTargetId);
        if (targetTodo?.groupId && targetTodo.groupId !== fromTodo.groupId) {
          oldGid = fromTodo.groupId;
          fromTodo.groupId = targetTodo.groupId;
        }
      }

      const fromIdx = todos.indexOf(fromTodo);
      todos.splice(fromIdx, 1);

      if (dropTargetType === 'group-header') {
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

      render();

      if (oldGid) await cleanupGroup(oldGid);
      await db.from('todos').update({ group_id: fromTodo.groupId ?? null }).eq('id', fromTodo.id);
      await syncTodoPositions();
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

  PRIORITY_OPTS.forEach(({ value, label }) => {
    const li = document.createElement('li');
    li.className = 'priority-select-option';
    li.role = 'option';
    li.dataset.value = value;
    li.innerHTML = `<span style="display:flex">${mcIcon(value, 20)}</span><span>${label}</span>`;
    li.addEventListener('click', () => { setSelected(value); closeMenu(); });
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

// ── 이벤트 바인딩 ──

document.getElementById('add-btn').addEventListener('click', async () => {
  const input = document.getElementById('todo-input');
  await addTodo(input.value, document.getElementById('priority-select').value);
  input.value = '';
  input.focus();
});

document.getElementById('todo-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('add-btn').click();
});

document.getElementById('todo-list').addEventListener('change', async e => {
  const item = e.target.closest('.todo-item');
  if (!item) return;
  const id = item.dataset.id;
  if (e.target.classList.contains('todo-checkbox'))   await toggleTodo(id);
  if (e.target.classList.contains('priority-change')) await changePriority(id, e.target.value);
});

document.getElementById('todo-list').addEventListener('click', async e => {
  const delBtn      = e.target.closest('.delete-btn');
  const ugBtn       = e.target.closest('.ungroup-btn');
  const disbandBtn  = e.target.closest('.group-disband-btn');
  const collapseBtn = e.target.closest('.group-collapse-btn');

  if (delBtn)      await deleteTodo(delBtn.closest('.todo-item').dataset.id);
  if (ugBtn)       await ungroupTodo(ugBtn.closest('.todo-item').dataset.id);
  if (disbandBtn)  await disbandGroup(disbandBtn.dataset.groupId);
  if (collapseBtn) await toggleGroupCollapse(collapseBtn.dataset.groupId);
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

document.getElementById('clear-completed-btn').addEventListener('click', async () => {
  await clearCompleted();
});

// ── 도움말 패널 ──
(function initHelp() {
  const btn   = document.getElementById('help-btn');
  const panel = document.getElementById('help-panel');
  const closeBtn = document.getElementById('help-close-btn');

  function open()  { panel.hidden = false; btn.setAttribute('aria-expanded', 'true');  }
  function close() { panel.hidden = true;  btn.setAttribute('aria-expanded', 'false'); }

  btn.addEventListener('click', e => {
    e.stopPropagation();
    panel.hidden ? open() : close();
  });

  closeBtn.addEventListener('click', e => { e.stopPropagation(); close(); });

  document.addEventListener('click', e => {
    if (!panel.hidden && !panel.contains(e.target)) close();
  });
})();

// 인증 이벤트
document.getElementById('signin-btn').addEventListener('click', handleSignIn);
document.getElementById('signup-btn').addEventListener('click', handleSignUp);
document.getElementById('signout-btn').addEventListener('click', handleSignOut);

document.getElementById('auth-email').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('auth-password').focus();
});
document.getElementById('auth-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') handleSignIn();
});

// ── 초기화 ──

initPrioritySelect();
initDragDrop();

(async () => {
  const { data: { session } } = await db.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    updateUserBar();
    hideAuthModal();
    await loadAll();
    render();
  } else {
    showAuthModal();
  }
})();
