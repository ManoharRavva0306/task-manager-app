/* ============================================================
   Task Manager — Frontend Logic
   ============================================================ */
const API = ""; // same origin
let token = localStorage.getItem("tm_token");
let currentUser = JSON.parse(localStorage.getItem("tm_user") || "null");
let tasks = [];
let ws = null;

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function toast(msg, isError = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast show" + (isError ? " error" : "");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => (t.className = "toast"), 2800);
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function isOverdue(task) {
  if (!task.due_date || task.status === "completed") return false;
  return new Date(task.due_date) < new Date(new Date().toDateString());
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
function showAuth() {
  $("#authWrapper").classList.add("active");
  $("#app").classList.remove("active");
}

function showApp() {
  $("#authWrapper").classList.remove("active");
  $("#app").classList.add("active");
  $("#userName").textContent = currentUser?.name || "User";
  loadTasks();
  loadStats();
  connectWebSocket();
}

function setAuth(t, user) {
  token = t;
  currentUser = user;
  localStorage.setItem("tm_token", t);
  localStorage.setItem("tm_user", JSON.stringify(user));
  showApp();
}

function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem("tm_token");
  localStorage.removeItem("tm_user");
  if (ws) ws.close();
  showAuth();
}

// ---------------------------------------------------------------------------
// Auth form handlers
// ---------------------------------------------------------------------------
$$(".auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".auth-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const isLogin = tab.dataset.mode === "login";
    $("#authFormTitle").textContent = isLogin ? "Welcome Back" : "Create Account";
    $("#authFormSubtitle").textContent = isLogin
      ? "Sign in to manage your tasks"
      : "Sign up to start managing your tasks";
    $("#nameGroup").style.display = isLogin ? "none" : "block";
    $("#authSubmit").textContent = isLogin ? "Sign In" : "Sign Up";
    $("#authError").style.display = "none";
  });
});

$("#authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = $("#authError");
  errEl.style.display = "none";
  const isLogin = $(".auth-tab.active").dataset.mode === "login";
  const payload = {
    email: $("#email").value.trim(),
    password: $("#password").value,
  };
  if (!isLogin) payload.name = $("#name").value.trim();

  try {
    const data = await api(`/api/auth/${isLogin ? "login" : "register"}`, {
      method: "POST",
      body: payload,
    });
    setAuth(data.token, data.user);
    toast(isLogin ? "Welcome back!" : "Account created!");
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = "block";
  }
});

// ---------------------------------------------------------------------------
// Tasks — Load & Render
// ---------------------------------------------------------------------------
async function loadTasks() {
  try {
    tasks = await api("/api/tasks");
    renderTasks();
  } catch (err) {
    toast(err.message, true);
  }
}

async function loadStats() {
  try {
    const s = await api("/api/tasks/stats");
    $("#statTotal").textContent = s.total || 0;
    $("#statPending").textContent = s.pending || 0;
    $("#statInProgress").textContent = s.inProgress || 0;
    $("#statCompleted").textContent = s.completed || 0;
  } catch {
    /* silent */
  }
}

function renderTasks() {
  const list = $("#taskList");
  const search = $("#searchBox").value.toLowerCase();
  const statusFilter = $("#filterStatus").value;
  const priorityFilter = $("#filterPriority").value;

  let filtered = tasks.filter((t) => {
    if (search && !t.title.toLowerCase().includes(search) && !(t.description || "").toLowerCase().includes(search)) return false;
    if (statusFilter && t.status !== statusFilter) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    return true;
  });

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="icon">📝</div><p>${
      tasks.length === 0 ? "No tasks yet. Click \"Add Task\" to create one!" : "No tasks match your filters."
    }</p></div>`;
    return;
  }

  list.innerHTML = filtered
    .map((t) => {
      const overdue = isOverdue(t);
      const statusLabel = { pending: "Pending", "in-progress": "In Progress", completed: "Completed" }[t.status];
      const priorityLabel = { low: "Low", medium: "Medium", high: "High" }[t.priority];
      return `
      <div class="task-card status-${t.status} priority-${t.priority}" data-id="${t.id}">
        <div class="task-top">
          <div class="task-title ${t.status === "completed" ? "done" : ""}">${escapeHtml(t.title)}</div>
          <div class="task-actions">
            <button class="edit-btn" onclick="openEditModal(${t.id})" title="Edit">✏️</button>
            <button class="delete-btn" onclick="deleteTask(${t.id})" title="Delete">🗑️</button>
          </div>
        </div>
        ${t.description ? `<div class="task-desc">${escapeHtml(t.description)}</div>` : ""}
        <div class="task-meta">
          <span class="badge badge-${t.status}">${statusLabel}</span>
          <span class="badge badge-priority-${t.priority}">${priorityLabel} priority</span>
          ${t.due_date ? `<span class="badge ${overdue ? "badge-overdue" : "badge-pending"}">${overdue ? "⚠ Overdue · " : ""}Due ${formatDate(t.due_date)}</span>` : ""}
        </div>
      </div>`;
    })
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------------------------------------------------------------------------
// Task Modal — Create / Edit
// ---------------------------------------------------------------------------
function openCreateModal() {
  $("#modalTitle").textContent = "Add New Task";
  $("#taskId").value = "";
  $("#taskTitle").value = "";
  $("#taskDescription").value = "";
  $("#taskStatus").value = "pending";
  $("#taskPriority").value = "medium";
  $("#taskDueDate").value = "";
  $("#taskModal").classList.add("active");
}

function openEditModal(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  $("#modalTitle").textContent = "Edit Task";
  $("#taskId").value = task.id;
  $("#taskTitle").value = task.title;
  $("#taskDescription").value = task.description || "";
  $("#taskStatus").value = task.status;
  $("#taskPriority").value = task.priority;
  $("#taskDueDate").value = task.due_date ? task.due_date.split("T")[0] : "";
  $("#taskModal").classList.add("active");
}

function closeModal() {
  $("#taskModal").classList.remove("active");
}

$("#taskForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("#taskId").value;
  const payload = {
    title: $("#taskTitle").value.trim(),
    description: $("#taskDescription").value.trim(),
    status: $("#taskStatus").value,
    priority: $("#taskPriority").value,
    due_date: $("#taskDueDate").value || null,
  };
  if (!payload.title) return toast("Title is required", true);

  try {
    if (id) {
      await api(`/api/tasks/${id}`, { method: "PUT", body: payload });
      toast("Task updated!");
    } else {
      await api("/api/tasks", { method: "POST", body: payload });
      toast("Task created!");
    }
    closeModal();
    await loadTasks();
    await loadStats();
  } catch (err) {
    toast(err.message, true);
  }
});

async function deleteTask(id) {
  if (!confirm("Delete this task? This cannot be undone.")) return;
  try {
    await api(`/api/tasks/${id}`, { method: "DELETE" });
    toast("Task deleted!");
    await loadTasks();
    await loadStats();
  } catch (err) {
    toast(err.message, true);
  }
}

// ---------------------------------------------------------------------------
// Quick status toggle — clicking a status badge cycles the status
// ---------------------------------------------------------------------------
async function cycleStatus(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  const next = { pending: "in-progress", "in-progress": "completed", completed: "pending" };
  try {
    await api(`/api/tasks/${id}`, { method: "PUT", body: { ...task, status: next[task.status] } });
    await loadTasks();
    await loadStats();
  } catch (err) {
    toast(err.message, true);
  }
}

// ---------------------------------------------------------------------------
// Filters & search
// ---------------------------------------------------------------------------
$("#searchBox").addEventListener("input", renderTasks);
$("#filterStatus").addEventListener("change", renderTasks);
$("#filterPriority").addEventListener("change", renderTasks);

// ---------------------------------------------------------------------------
// WebSocket — real-time updates
// ---------------------------------------------------------------------------
function connectWebSocket() {
  if (ws) ws.close();
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${protocol}://${location.host}/ws?token=${token}`);

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "task:created" || msg.type === "task:updated") {
      const idx = tasks.findIndex((t) => t.id === msg.task.id);
      if (idx >= 0) tasks[idx] = msg.task;
      else tasks.unshift(msg.task);
      renderTasks();
      loadStats();
      toast(msg.type === "task:created" ? "New task synced" : "Task updated");
    } else if (msg.type === "task:deleted") {
      tasks = tasks.filter((t) => t.id !== msg.taskId);
      renderTasks();
      loadStats();
    }
  };

  ws.onclose = () => {
    // attempt reconnect after 5s if still logged in
    if (currentUser) setTimeout(connectWebSocket, 5000);
  };
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
$("#btnAdd").addEventListener("click", openCreateModal);
$("#btnLogout").addEventListener("click", logout);
$(".modal-close").addEventListener("click", closeModal);
$("#modalOverlay")?.addEventListener("click", (e) => {
  if (e.target === $("#taskModal")) closeModal();
});

if (token && currentUser) {
  showApp();
} else {
  showAuth();
}
