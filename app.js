const STORAGE_KEY = "temps-photo-state-v23";
const VIEW_ACTIVE = "active";
const VIEW_COMPLETED = "completed";
const MODULE_TIME = "time";
const MODULE_EXPENSES = "expenses";

const categories = [
  { id: "admin", label: "Admin", color: "#0f766e", defaultQuota: 1 },
  { id: "prep", label: "Préparation", color: "#c05621", defaultQuota: 2 },
  { id: "shooting", label: "Shooting", color: "#d99a00", defaultQuota: 4 },
  { id: "travel", label: "Déplacement", color: "#007aff", defaultQuota: 1 },
  { id: "edition", label: "Édition", color: "#5856d6", defaultQuota: 5 },
];

const expenseCategories = [
  { id: "transport", label: "Transport" },
  { id: "parking", label: "Parking" },
  { id: "assistant", label: "Assistant" },
  { id: "location", label: "Location" },
  { id: "materiel", label: "Matériel" },
  { id: "repas", label: "Repas" },
  { id: "autre", label: "Autre" },
];

const state = loadState();
let selectedCategory = "shooting";
let activeSession = state.activeSession || null;
let ticker = null;
let editingProjectId = null;
let lastImputedSession = null;
let imputedTimer = null;
let currentView = VIEW_ACTIVE;
let currentModule = state.currentModule || MODULE_TIME;

const els = {
  viewActive: document.querySelector("#viewActive"),
  viewCompleted: document.querySelector("#viewCompleted"),
  moduleTime: document.querySelector("#moduleTime"),
  moduleExpenses: document.querySelector("#moduleExpenses"),
  projectListTitle: document.querySelector("#projectListTitle"),
  projectList: document.querySelector("#projectList"),
  activeProjectName: document.querySelector("#activeProjectName"),
  profitStatus: document.querySelector("#profitStatus"),
  timerPanel: document.querySelector(".timer-panel"),
  categoryGrid: document.querySelector("#categoryGrid"),
  timerCategory: document.querySelector("#timerCategory"),
  timerDisplay: document.querySelector("#timerDisplay"),
  toggleTimer: document.querySelector("#toggleTimer"),
  totalTime: document.querySelector("#totalTime"),
  totalQuota: document.querySelector("#totalQuota"),
  totalDelta: document.querySelector("#totalDelta"),
  categorySummary: document.querySelector("#categorySummary"),
  summaryPanel: document.querySelector(".summary-panel"),
  historyPanel: document.querySelector(".history-panel"),
  sessionList: document.querySelector("#sessionList"),
  clearSessions: document.querySelector("#clearSessions"),
  projectDialog: document.querySelector("#projectDialog"),
  projectForm: document.querySelector("#projectForm"),
  projectDialogTitle: document.querySelector("#projectDialogTitle"),
  projectNameInput: document.querySelector("#projectNameInput"),
  quotaEditor: document.querySelector("#quotaEditor"),
  openProjectDialog: document.querySelector("#openProjectDialog"),
  editProjectButton: document.querySelector("#editProjectButton"),
  deleteProject: document.querySelector("#deleteProject"),
  projectSave: document.querySelector("#projectSave"),
  manualDialog: document.querySelector("#manualDialog"),
  manualForm: document.querySelector("#manualForm"),
  manualCategory: document.querySelector("#manualCategory"),
  manualMinutes: document.querySelector("#manualMinutes"),
  manualDurationUnit: document.querySelector("#manualDurationUnit"),
  manualSave: document.querySelector("#manualSave"),
  addManualTime: document.querySelector("#addManualTime"),
  expensesPanel: document.querySelector("#expensesPanel"),
  expenseTotal: document.querySelector("#expenseTotal"),
  expenseCount: document.querySelector("#expenseCount"),
  expenseList: document.querySelector("#expenseList"),
  openExpenseDialog: document.querySelector("#openExpenseDialog"),
  expenseDialog: document.querySelector("#expenseDialog"),
  expenseForm: document.querySelector("#expenseForm"),
  expenseCategory: document.querySelector("#expenseCategory"),
  expenseAmount: document.querySelector("#expenseAmount"),
  expenseNote: document.querySelector("#expenseNote"),
  expenseSave: document.querySelector("#expenseSave"),
  projectActions: document.querySelector("#projectActions"),
  exportProjectPdf: document.querySelector("#exportProjectPdf"),
  finishProject: document.querySelector("#finishProject"),
  printReport: document.querySelector("#printReport"),
};

init();

function init() {
  if (activeSession) selectedCategory = activeSession.category;
  renderCategoryControls();
  renderManualCategoryOptions();
  renderExpenseCategoryOptions();
  render();
  if (activeSession) startTicker();
  bindEvents();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}

function loadState() {
  const fallback = {
    activeProjectId: "project-1",
    projects: [
      {
        id: "project-1",
        name: "Mariage civil",
        quotas: { admin: 1, prep: 2, shooting: 4, travel: 1, edition: 6 },
        expenses: [
          sampleExpense("transport", 38, "Parking et déplacement"),
          sampleExpense("assistant", 180, "Renfort shooting"),
        ],
        sessions: [
          sampleSession("prep", 45),
          sampleSession("shooting", 170),
          sampleSession("edition", 95),
        ],
      },
      {
        id: "project-2",
        name: "Packshot bijoux",
        quotas: { admin: 0.75, prep: 1.5, shooting: 3, travel: 0.75, edition: 4 },
        expenses: [sampleExpense("materiel", 42, "Consommables")],
        sessions: [sampleSession("admin", 30), sampleSession("shooting", 110), sampleSession("edition", 80)],
      },
      {
        id: "project-3",
        name: "Portrait éditorial",
        quotas: { admin: 1, prep: 1, shooting: 2, travel: 0.5, edition: 3 },
        expenses: [],
        sessions: [sampleSession("prep", 40), sampleSession("shooting", 120)],
      },
    ],
  };

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed?.projects?.length) return normalizeState(fallback);
    return normalizeState(parsed);
  } catch {
    return normalizeState(fallback);
  }
}

function normalizeState(data) {
  data.projects.forEach((project) => {
    project.status = project.status || VIEW_ACTIVE;
    project.sessions = project.sessions || [];
    project.expenses = project.expenses || [];
    project.quotas = project.quotas || {};
    categories.forEach((category) => {
      if (project.quotas[category.id] === undefined) project.quotas[category.id] = category.defaultQuota;
    });
  });
  data.activeProjectId = data.activeProjectId || data.projects.find((project) => project.status !== VIEW_COMPLETED)?.id;
  data.completedProjectId = data.completedProjectId || data.projects.find((project) => project.status === VIEW_COMPLETED)?.id || null;
  return data;
}

function sampleSession(category, minutes) {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    category,
    start: now - minutes * 60_000,
    end: now,
    duration: minutes * 60_000,
    manual: true,
  };
}

function sampleExpense(category, amount, note) {
  return {
    id: crypto.randomUUID(),
    category,
    amount,
    note,
    date: new Date().toISOString(),
  };
}

function bindEvents() {
  els.viewActive.addEventListener("click", () => switchView(VIEW_ACTIVE));
  els.viewCompleted.addEventListener("click", () => switchView(VIEW_COMPLETED));
  els.moduleTime.addEventListener("click", () => switchModule(MODULE_TIME));
  els.moduleExpenses.addEventListener("click", () => switchModule(MODULE_EXPENSES));
  els.toggleTimer.addEventListener("click", toggleTimer);
  els.openProjectDialog.addEventListener("click", () => openProjectDialog());
  els.editProjectButton.addEventListener("click", () => openProjectDialog(getActiveProject()));
  els.addManualTime.addEventListener("click", () => els.manualDialog.showModal());
  els.projectSave.addEventListener("click", saveProjectFromDialog);
  els.manualSave.addEventListener("click", addManualSession);
  els.manualDurationUnit.addEventListener("change", updateManualDurationBounds);
  els.openExpenseDialog.addEventListener("click", () => openExpenseDialog());
  els.expenseSave.addEventListener("click", addExpense);
  els.exportProjectPdf.addEventListener("click", exportProjectPdf);
  els.finishProject.addEventListener("click", finishCurrentProject);

  els.clearSessions.addEventListener("click", () => {
    const project = getActiveProject();
    if (!project.sessions.length) return;
    project.sessions = [];
    saveAndRender();
  });

  els.projectForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveProjectFromDialog();
  });

  els.manualForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addManualSession();
  });

  els.expenseForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addExpense();
  });

  els.deleteProject.addEventListener("click", deleteEditingProject);

  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog")?.close());
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && activeSession) renderTimer();
  });

  window.addEventListener("pageshow", () => {
    if (activeSession) {
      renderTimer();
      startTicker();
    }
  });
}

function switchView(view) {
  currentView = view;
  clearImputedPreview();
  if (currentView === VIEW_COMPLETED) stopTicker();
  if (currentView === VIEW_ACTIVE && activeSession) startTicker();
  render();
}

function switchModule(module) {
  currentModule = module;
  state.currentModule = currentModule;
  persistState();
  render();
}

function render() {
  ensureSelectedProject();
  const project = getActiveProject();
  const hasProject = Boolean(project);
  const isTimeModule = currentModule === MODULE_TIME;
  const isExpensesModule = currentModule === MODULE_EXPENSES;

  document.body.dataset.view = currentView;
  document.body.dataset.module = currentModule;
  els.viewActive.classList.toggle("is-active", currentView === VIEW_ACTIVE);
  els.viewCompleted.classList.toggle("is-active", currentView === VIEW_COMPLETED);
  els.moduleTime.classList.toggle("is-active", isTimeModule);
  els.moduleExpenses.classList.toggle("is-active", isExpensesModule);
  els.projectListTitle.textContent = currentView === VIEW_ACTIVE ? "Projets en cours" : "Projets terminés";
  els.activeProjectName.textContent = project?.name || "Aucun projet";
  els.editProjectButton.hidden = !hasProject;
  els.timerPanel.hidden = currentView === VIEW_COMPLETED || !hasProject || !isTimeModule;
  els.summaryPanel.hidden = !hasProject || !isTimeModule;
  els.historyPanel.hidden = !hasProject || !isTimeModule;
  els.expensesPanel.hidden = !hasProject || !isExpensesModule;
  els.projectActions.hidden = !hasProject;
  els.finishProject.hidden = currentView === VIEW_COMPLETED;
  els.finishProject.disabled = Boolean(activeSession);
  els.clearSessions.hidden = currentView === VIEW_COMPLETED || !isTimeModule;

  renderProjects();
  if (hasProject) {
    renderProjectStatus(project);
    if (isTimeModule) {
      renderTimer();
      renderSummary(project);
      renderSessions(project);
    }
    if (isExpensesModule) renderExpenses(project);
  }
}

function renderProjects() {
  els.projectList.innerHTML = "";

  const projects = getProjectsForCurrentView();
  if (!projects.length) {
    els.projectList.innerHTML = `<div class="empty-state wide">${currentView === VIEW_ACTIVE ? "Aucun projet en cours" : "Aucun projet terminé"}</div>`;
    return;
  }

  projects.forEach((project) => {
    const totalMs = getProjectTotalMs(project);
    const quotaMs = getProjectQuotaMs(project);
    const ratio = quotaMs ? totalMs / quotaMs : 0;
    const selectedProject = getActiveProject();
    const button = document.createElement("button");
    button.type = "button";
    button.className = `project-card${project.id === selectedProject?.id ? " is-active" : ""}`;
    button.innerHTML = `
      <span class="project-card-top">
        <strong>${project.name}</strong>
        <em>${getStatusLabel(totalMs, quotaMs)}</em>
      </span>
      <span class="project-card-time">${formatDuration(totalMs)} / ${formatDuration(quotaMs)}</span>
      <span class="project-mini-meter" aria-hidden="true">
        <span class="${getQuotaMeterClass(totalMs, quotaMs)}" style="--fill: ${quotaMs ? Math.min(100, Math.round(ratio * 100)) : 0}%"></span>
      </span>
    `;
    button.addEventListener("click", () => {
      if (currentView === VIEW_COMPLETED) {
        state.completedProjectId = project.id;
      } else {
        state.activeProjectId = project.id;
      }
      saveAndRender();
    });
    els.projectList.append(button);
  });
}

function renderCategoryControls() {
  els.categoryGrid.innerHTML = "";

  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-button";
    button.style.color = category.color;
    button.dataset.category = category.id;
    button.innerHTML = `
      <span class="dot"></span>
      <strong>${category.label}</strong>
      <span>Quota ${formatDuration(hoursToMs(getActiveProject().quotas[category.id] || 0))}</span>
    `;
    button.addEventListener("click", () => {
      if (activeSession) return;
      selectedCategory = category.id;
      render();
    });
    els.categoryGrid.append(button);
  });
}

function renderManualCategoryOptions() {
  els.manualCategory.innerHTML = categories
    .map((category) => `<option value="${category.id}">${category.label}</option>`)
    .join("");
}

function renderExpenseCategoryOptions() {
  els.expenseCategory.innerHTML = expenseCategories
    .map((category) => `<option value="${category.id}">${category.label}</option>`)
    .join("");
}

function renderProjectStatus(project) {
  const totalMs = getProjectTotalMs(project);
  const quotaMs = getProjectQuotaMs(project);
  els.profitStatus.className = "status-pill";
  els.profitStatus.textContent = getStatusLabel(totalMs, quotaMs);
  els.profitStatus.classList.add(getStatusClass(totalMs, quotaMs));
}

function renderTimer() {
  if (currentView === VIEW_COMPLETED) return;
  const selected = getCategory(selectedCategory);
  const runningCategory = activeSession ? getCategory(activeSession.category) : selected;
  const displayCategory = lastImputedSession ? getCategory(lastImputedSession.category) : runningCategory;
  const elapsed = activeSession ? Date.now() - activeSession.start : 0;
  const displayMs = lastImputedSession && !activeSession ? lastImputedSession.duration : elapsed;

  els.timerPanel.style.setProperty("--active-color", displayCategory.color);
  els.timerCategory.textContent = lastImputedSession && !activeSession ? `${displayCategory.label} imputé` : displayCategory.label;
  els.timerDisplay.textContent = formatClock(displayMs);
  els.toggleTimer.textContent = activeSession ? "Terminer" : "Démarrer";
  els.toggleTimer.classList.toggle("is-running", Boolean(activeSession));
  els.timerPanel.classList.toggle("is-running", Boolean(activeSession));
  els.timerPanel.classList.toggle("is-imputed", Boolean(lastImputedSession && !activeSession));

  [...els.categoryGrid.children].forEach((button) => {
    const selectedId = activeSession ? activeSession.category : selectedCategory;
    button.classList.toggle("is-selected", button.dataset.category === selectedId);
    const category = getCategory(button.dataset.category);
    const quotaLabel = button.querySelector("span:last-child");
    quotaLabel.textContent = `Quota ${formatDuration(hoursToMs(getActiveProject().quotas[category.id] || 0))}`;
  });
}

function renderSummary(project) {
  const totals = getTotals(project);
  const totalMs = Object.values(totals).reduce((sum, ms) => sum + ms, 0);
  const quotaMs = getProjectQuotaMs(project);
  const ratio = quotaMs ? totalMs / quotaMs : 0;

  els.totalTime.textContent = formatDuration(totalMs);
  els.totalQuota.textContent = `Quota ${formatDuration(quotaMs)}`;
  els.totalDelta.textContent = getBalanceLabel(totalMs, quotaMs);
  els.totalDelta.className = `balance-line ${getStatusClass(totalMs, quotaMs)}`;

  els.categorySummary.innerHTML = "";

  categories.forEach((category) => {
    const used = totals[category.id] || 0;
    const quota = hoursToMs(project.quotas[category.id] || 0);
    const fill = quota ? Math.min(140, Math.round((used / quota) * 100)) : used ? 100 : 0;
    const item = document.createElement("div");
    item.className = "summary-item";
    item.style.color = category.color;
    item.innerHTML = `
      <div class="summary-label">
        <strong>${category.label}</strong>
        <span>${formatDuration(used)} / ${formatDuration(hoursToMs(project.quotas[category.id] || 0))}</span>
      </div>
      <div class="meter" aria-hidden="true">
        <div class="meter-fill ${getQuotaMeterClass(used, quota)}" style="--fill: ${fill}%"></div>
      </div>
    `;
    els.categorySummary.append(item);
  });
}

function renderExpenses(project) {
  const expenses = project.expenses || [];
  els.expenseTotal.textContent = formatCurrency(getProjectExpensesTotal(project));
  els.expenseCount.textContent = `${expenses.length} ${expenses.length > 1 ? "frais" : "frais"}`;
  els.expenseList.innerHTML = "";

  if (!expenses.length) {
    els.expenseList.innerHTML = `<div class="empty-state">Aucun frais enregistré</div>`;
    return;
  }

  [...expenses]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach((expense) => {
      const category = getExpenseCategory(expense.category);
      const row = document.createElement("div");
      row.className = "expense-row";
      row.innerHTML = `
        <div class="expense-main">
          <strong>${category.label}</strong>
          <span>${expense.note || "Sans note"}</span>
        </div>
        <div class="expense-side">
          <span>${formatCurrency(expense.amount)}</span>
          <button class="expense-delete" type="button" aria-label="Supprimer ${category.label}">Supprimer</button>
        </div>
      `;
      row.querySelector(".expense-delete").addEventListener("click", () => deleteExpense(expense.id));
      els.expenseList.append(row);
    });
}

function renderSessions(project) {
  els.sessionList.innerHTML = "";

  if (!project.sessions.length) {
    els.sessionList.innerHTML = `<div class="empty-state">Aucune session</div>`;
    return;
  }

  [...project.sessions]
    .sort((a, b) => b.start - a.start)
    .slice(0, 20)
    .forEach((session) => {
      const category = getCategory(session.category);
      const row = document.createElement("div");
      row.className = "session-row";
      row.innerHTML = `
        <div class="session-category" style="color: ${category.color}">
          <span>${category.label}</span>
        </div>
        <span class="session-time">${formatDuration(session.duration)}</span>
      `;
      els.sessionList.append(row);
    });
}

function toggleTimer() {
  if (currentView === VIEW_COMPLETED) return;
  const project = getActiveProject();
  clearImputedPreview();

  if (activeSession) {
    const end = Date.now();
    const sessionProject = state.projects.find((item) => item.id === activeSession.projectId) || project;
    const completedSession = {
      id: crypto.randomUUID(),
      category: activeSession.category,
      start: activeSession.start,
      end,
      duration: end - activeSession.start,
    };
    sessionProject.sessions.push(completedSession);
    lastImputedSession = completedSession;
    activeSession = null;
    state.activeSession = null;
    stopTicker();
    persistState();
    render();
    imputedTimer = window.setTimeout(() => {
      lastImputedSession = null;
      renderTimer();
    }, 4500);
    return;
  }

  activeSession = {
    projectId: project.id,
    category: selectedCategory,
    start: Date.now(),
  };
  state.activeSession = activeSession;
  persistState();
  startTicker();
  render();
}

function startTicker() {
  stopTicker();
  ticker = window.setInterval(renderTimer, 1000);
}

function stopTicker() {
  if (!ticker) return;
  window.clearInterval(ticker);
  ticker = null;
}

function clearImputedPreview() {
  lastImputedSession = null;
  if (!imputedTimer) return;
  window.clearTimeout(imputedTimer);
  imputedTimer = null;
}

function openProjectDialog(project = null) {
  editingProjectId = project?.id || null;
  els.projectDialogTitle.textContent = project ? "Modifier le projet" : "Nouveau projet";
  els.deleteProject.hidden = !project || getProjectsForCurrentView().length < 2;
  els.projectNameInput.value = project?.name || "";
  renderQuotaEditor(project);
  els.projectDialog.showModal();
  els.projectNameInput.focus();
}

function renderQuotaEditor(project) {
  const quotas = project?.quotas || {};
  els.quotaEditor.innerHTML = "";

  categories.forEach((category) => {
    const quotaParts = getQuotaParts(quotas[category.id] ?? category.defaultQuota);
    const row = document.createElement("div");
    row.className = "quota-row";
    row.innerHTML = `
      <span class="quota-name" style="color: ${category.color}">${category.label}</span>
      <div class="quota-duration">
        <label>
          <span>Durée</span>
          <input type="number" min="0" step="1" inputmode="numeric" data-quota-amount="${category.id}" value="${quotaParts.amount}" />
        </label>
        <label>
          <span>Unité</span>
          <select data-quota-unit="${category.id}">
            <option value="minutes"${quotaParts.unit === "minutes" ? " selected" : ""}>minutes</option>
            <option value="hours"${quotaParts.unit === "hours" ? " selected" : ""}>heures</option>
            <option value="days"${quotaParts.unit === "days" ? " selected" : ""}>jours</option>
          </select>
        </label>
      </div>
    `;
    els.quotaEditor.append(row);
  });
}

function saveProjectFromDialog() {
  const name = els.projectNameInput.value.trim();
  if (!name) return;

  const quotas = {};
  categories.forEach((category) => {
    const amount = Number(els.quotaEditor.querySelector(`[data-quota-amount="${category.id}"]`)?.value || 0);
    const unit = els.quotaEditor.querySelector(`[data-quota-unit="${category.id}"]`)?.value || "hours";
    quotas[category.id] = durationToHours(amount, unit);
  });

  if (editingProjectId) {
    const project = state.projects.find((item) => item.id === editingProjectId);
    project.name = name;
    project.quotas = quotas;
  } else {
    const id = crypto.randomUUID();
    state.projects.push({ id, name, quotas, sessions: [], expenses: [], status: VIEW_ACTIVE });
    state.activeProjectId = id;
    currentView = VIEW_ACTIVE;
  }

  els.projectDialog.close();
  saveAndRender();
}

function deleteEditingProject() {
  if (!editingProjectId || getProjectsForCurrentView().length < 2) return;
  state.projects = state.projects.filter((project) => project.id !== editingProjectId);
  const nextProject = getProjectsForCurrentView()[0];
  if (currentView === VIEW_COMPLETED) state.completedProjectId = nextProject?.id || null;
  else state.activeProjectId = nextProject?.id || null;
  els.projectDialog.close();
  saveAndRender();
}

function openExpenseDialog() {
  els.expenseForm.reset();
  els.expenseDialog.showModal();
  els.expenseAmount.focus();
}

function addManualSession() {
  const duration = getManualDurationMs();
  if (!duration) return;

  const end = Date.now();
  getActiveProject().sessions.push({
    id: crypto.randomUUID(),
    category: els.manualCategory.value,
    start: end - duration,
    end,
    duration,
    manual: true,
  });

  els.manualDialog.close();
  saveAndRender();
}

function addExpense() {
  const amount = Number(els.expenseAmount.value);
  const project = getActiveProject();
  if (!project || !amount || amount <= 0) return;

  project.expenses.push({
    id: crypto.randomUUID(),
    category: els.expenseCategory.value,
    amount,
    note: els.expenseNote.value.trim(),
    date: new Date().toISOString(),
  });

  els.expenseDialog.close();
  saveAndRender();
}

function deleteExpense(expenseId) {
  const project = getActiveProject();
  if (!project) return;
  project.expenses = project.expenses.filter((expense) => expense.id !== expenseId);
  saveAndRender();
}

function getActiveProject() {
  const projects = getProjectsForCurrentView();
  const selectedId = currentView === VIEW_COMPLETED ? state.completedProjectId : state.activeProjectId;
  return projects.find((project) => project.id === selectedId) || projects[0] || null;
}

function getProjectsForCurrentView() {
  return state.projects.filter((project) => {
    return currentView === VIEW_COMPLETED ? project.status === VIEW_COMPLETED : project.status !== VIEW_COMPLETED;
  });
}

function ensureSelectedProject() {
  const projects = getProjectsForCurrentView();
  if (!projects.length) return;
  const key = currentView === VIEW_COMPLETED ? "completedProjectId" : "activeProjectId";
  if (!projects.some((project) => project.id === state[key])) state[key] = projects[0].id;
}

function getCategory(id) {
  return categories.find((category) => category.id === id) || categories[0];
}

function getExpenseCategory(id) {
  return expenseCategories.find((category) => category.id === id) || expenseCategories.at(-1);
}

function getTotals(project) {
  return project.sessions.reduce((totals, session) => {
    totals[session.category] = (totals[session.category] || 0) + session.duration;
    return totals;
  }, {});
}

function getProjectTotalMs(project) {
  return Object.values(getTotals(project)).reduce((sum, ms) => sum + ms, 0);
}

function getProjectQuotaMs(project) {
  return categories.reduce((sum, category) => {
    return sum + hoursToMs(project.quotas[category.id] || 0);
  }, 0);
}

function getProjectExpensesTotal(project) {
  return (project.expenses || []).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
}

function getStatusLabel(totalMs, quotaMs) {
  const ratio = quotaMs ? totalMs / quotaMs : 0;
  if (quotaMs === 0) return "Sans quota";
  if (ratio <= 0.9) return "Gagnant";
  if (ratio <= 1) return "À l’heure";
  return "Perdant";
}

function getStatusClass(totalMs, quotaMs) {
  const ratio = quotaMs ? totalMs / quotaMs : 0;
  if (quotaMs === 0) return "neutral";
  if (ratio <= 0.9) return "profit";
  if (ratio <= 1) return "warning";
  return "loss";
}

function getQuotaMeterClass(totalMs, quotaMs) {
  const ratio = quotaMs ? totalMs / quotaMs : 0;
  if (!quotaMs) return "quota-neutral";
  if (ratio > 1) return "quota-loss";
  if (ratio >= 0.9) return "quota-warning";
  return "quota-profit";
}

function getBalanceLabel(totalMs, quotaMs) {
  if (!quotaMs) return "Ajoute un quota pour suivre ta marge de temps.";
  const delta = quotaMs - totalMs;
  if (delta >= 0) return `${formatDuration(delta)} disponibles avant quota`;
  return `${formatDuration(Math.abs(delta))} au-dessus du quota`;
}

function updateManualDurationBounds() {
  const unit = els.manualDurationUnit.value;
  const bounds = {
    minutes: { min: 10, max: 60, value: 30 },
    hours: { min: 1, max: 24, value: 1 },
    days: { min: 1, max: 50, value: 1 },
  }[unit];
  const current = Number(els.manualMinutes.value || bounds.value);

  els.manualMinutes.min = bounds.min;
  els.manualMinutes.max = bounds.max;
  els.manualMinutes.step = 1;
  els.manualMinutes.value = Math.min(bounds.max, Math.max(bounds.min, current || bounds.value));
}

function getManualDurationMs() {
  updateManualDurationBounds();
  const amount = Number(els.manualMinutes.value);
  const unit = els.manualDurationUnit.value;
  if (!amount) return 0;
  if (unit === "days") return amount * 24 * 60 * 60 * 1000;
  if (unit === "hours") return amount * 60 * 60 * 1000;
  return amount * 60 * 1000;
}

function durationToHours(amount, unit) {
  if (unit === "days") return amount * 24;
  if (unit === "minutes") return amount / 60;
  return amount;
}

function getQuotaParts(hours) {
  const value = Number(hours || 0);
  if (!value) return { amount: 0, unit: "hours" };
  if (value >= 24 && value % 24 === 0) return { amount: value / 24, unit: "days" };
  if (value < 1 || value % 1 !== 0) return { amount: Math.round(value * 60), unit: "minutes" };
  return { amount: value, unit: "hours" };
}

function saveAndRender() {
  persistState();
  renderCategoryControls();
  render();
}

function finishCurrentProject() {
  if (currentView !== VIEW_ACTIVE || activeSession) return;
  const project = getActiveProject();
  if (!project) return;
  project.status = VIEW_COMPLETED;
  project.completedAt = new Date().toISOString();
  state.completedProjectId = project.id;
  const nextProject = state.projects.find((item) => item.status !== VIEW_COMPLETED);
  state.activeProjectId = nextProject?.id || null;
  currentView = VIEW_COMPLETED;
  saveAndRender();
}

function exportProjectPdf() {
  const project = getActiveProject();
  if (!project) return;
  els.printReport.innerHTML = buildPrintReport(project);
  window.print();
}

function buildPrintReport(project) {
  const totals = getTotals(project);
  const totalMs = getProjectTotalMs(project);
  const quotaMs = getProjectQuotaMs(project);
  const expensesTotal = getProjectExpensesTotal(project);
  const completed = project.completedAt
    ? new Date(project.completedAt).toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "Projet en cours";
  const rows = categories
    .map((category) => {
      const used = totals[category.id] || 0;
      const quota = hoursToMs(project.quotas[category.id] || 0);
      return `<tr><td>${category.label}</td><td>${formatDuration(used)}</td><td>${formatDuration(quota)}</td><td>${getBalanceLabel(used, quota)}</td></tr>`;
    })
    .join("");
  const sessions = [...project.sessions]
    .sort((a, b) => a.start - b.start)
    .map((session) => {
      const category = getCategory(session.category);
      const date = new Date(session.start).toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
      return `<tr><td>${date}</td><td>${category.label}</td><td>${formatDuration(session.duration)}</td></tr>`;
    })
    .join("");
  const expenses = [...(project.expenses || [])]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((expense) => {
      const category = getExpenseCategory(expense.category);
      const date = new Date(expense.date).toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
      return `<tr><td>${date}</td><td>${category.label}</td><td>${expense.note || ""}</td><td>${formatCurrency(expense.amount)}</td></tr>`;
    })
    .join("");

  return `
    <section>
      <header>
        <img src="./assets/picfactory-logo.png" alt="" />
        <div>
          <p>PICFACTORY</p>
          <h1>${project.name}</h1>
          <span>${completed}</span>
        </div>
      </header>
      <div class="print-totals">
        <strong>${formatDuration(totalMs)}</strong>
        <span>effectif sur ${formatDuration(quotaMs)} de quota</span>
        <em>${getStatusLabel(totalMs, quotaMs)}</em>
      </div>
      <h2>Temps par catégorie</h2>
      <table><thead><tr><th>Catégorie</th><th>Effectif</th><th>Quota</th><th>Écart</th></tr></thead><tbody>${rows}</tbody></table>
      <h2>Sessions</h2>
      <table><thead><tr><th>Date</th><th>Catégorie</th><th>Durée</th></tr></thead><tbody>${sessions || `<tr><td colspan="3">Aucune session</td></tr>`}</tbody></table>
      <h2>Frais</h2>
      <p class="print-expense-total">Total frais: ${formatCurrency(expensesTotal)}</p>
      <table><thead><tr><th>Date</th><th>Catégorie</th><th>Note</th><th>Montant</th></tr></thead><tbody>${expenses || `<tr><td colspan="4">Aucun frais</td></tr>`}</tbody></table>
    </section>
  `;
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function hoursToMs(hours) {
  return Number(hours || 0) * 60 * 60 * 1000;
}

function formatClock(ms) {
  const seconds = Math.floor(ms / 1000);
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function formatDuration(ms) {
  const minutes = Math.round(ms / 60_000);
  if (ms > 0 && minutes === 0) return "< 1 min";
  const days = Math.floor(minutes / 1440);
  const dayHours = Math.floor((minutes % 1440) / 60);
  if (days && dayHours) return `${days} j ${dayHours} h`;
  if (days) return `${days} j`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} h ${String(m).padStart(2, "0")}`;
  if (h) return `${h} h`;
  return `${m} min`;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}
