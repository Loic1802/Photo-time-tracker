const STORAGE_KEY = "project-time-tracker-state-v1";
const LEGACY_STORAGE_KEYS = ["temps-photo-state-v23"];
const BACKUP_PREFIX = "project-time-tracker-backup-";
const BACKUP_INDEX_KEY = "project-time-tracker-backup-index";
const MAX_BACKUPS = 25;
const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const SUPABASE_URL = "https://oxkinhksdflfcvbqcknu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qNW_Z29Ar03T_uE9n33VLw_bcA5AKTE";
const VIEW_ACTIVE = "active";
const VIEW_COMPLETED = "completed";
const MODULE_PROJECT = "project";
const MODULE_TIME = "time";
const MODULE_EXPENSES = "expenses";
const MODULE_BALANCE = "balance";
const MODULES = [MODULE_PROJECT, MODULE_TIME, MODULE_EXPENSES, MODULE_BALANCE];

const categories = [
  { id: "admin", label: "Admin", color: "#0f766e", softColor: "#d8f1ec", defaultQuota: 1 },
  { id: "prep", label: "Préparation", color: "#c05621", softColor: "#f8dfce", defaultQuota: 2 },
  { id: "shooting", label: "Shooting", color: "#b47b00", softColor: "#f7dfa2", defaultQuota: 4 },
  { id: "travel", label: "Déplacement", color: "#007aff", softColor: "#d8eaff", defaultQuota: 1 },
  { id: "edition", label: "Édition", color: "#5856d6", softColor: "#e4e2ff", defaultQuota: 5 },
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

const scoreItems = [
  { id: "pleasure", label: "Plaisir" },
  { id: "stress", label: "Stress" },
  { id: "creativity", label: "Créativité" },
  { id: "clientDifficulty", label: "Difficulté client" },
];

let loadedStateFromStorage = false;
const state = loadState();
let supabaseClient = null;
let currentUser = null;
let authMode = "signIn";
let syncInProgress = false;
let syncQueued = false;
let remoteReady = false;
let selectedCategory = "shooting";
let activeSession = state.activeSession || null;
let ticker = null;
let editingProjectId = null;
let lastImputedSession = null;
let imputedTimer = null;
let deleteConfirmResolver = null;
let currentView = VIEW_ACTIVE;
let currentModule = MODULES.includes(state.currentModule) ? state.currentModule : MODULE_TIME;
let lastCenteredCategory = null;

const els = {
  appShell: document.querySelector("#appShell"),
  authScreen: document.querySelector("#authScreen"),
  authForm: document.querySelector("#authForm"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  authSubmit: document.querySelector("#authSubmit"),
  authModeToggle: document.querySelector("#authModeToggle"),
  authMessage: document.querySelector("#authMessage"),
  signOutButton: document.querySelector("#signOutButton"),
  viewActive: document.querySelector("#viewActive"),
  viewCompleted: document.querySelector("#viewCompleted"),
  moduleProject: document.querySelector("#moduleProject"),
  moduleTime: document.querySelector("#moduleTime"),
  moduleExpenses: document.querySelector("#moduleExpenses"),
  moduleBalance: document.querySelector("#moduleBalance"),
  projectStrip: document.querySelector(".project-strip"),
  projectListTitle: document.querySelector("#projectListTitle"),
  projectList: document.querySelector("#projectList"),
  activeProjectName: document.querySelector("#activeProjectName"),
  profitStatus: document.querySelector("#profitStatus"),
  projectHero: document.querySelector("#projectHero"),
  heroPrice: document.querySelector("#heroPrice"),
  heroTime: document.querySelector("#heroTime"),
  heroQuota: document.querySelector("#heroQuota"),
  heroRate: document.querySelector("#heroRate"),
  timerPanel: document.querySelector(".timer-panel"),
  categoryGrid: document.querySelector("#categoryGrid"),
  timerCategory: document.querySelector("#timerCategory"),
  timerDisplay: document.querySelector("#timerDisplay"),
  toggleTimer: document.querySelector("#toggleTimer"),
  totalTime: document.querySelector("#totalTime"),
  totalQuota: document.querySelector("#totalQuota"),
  totalDelta: document.querySelector("#totalDelta"),
  summaryTitle: document.querySelector(".summary-panel h2"),
  businessSummary: document.querySelector("#businessSummary"),
  categorySummary: document.querySelector("#categorySummary"),
  summaryPanel: document.querySelector(".summary-panel"),
  historyPanel: document.querySelector(".history-panel"),
  sessionList: document.querySelector("#sessionList"),
  clearSessions: document.querySelector("#clearSessions"),
  analysisPanel: document.querySelector("#analysisPanel"),
  analysisStatus: document.querySelector("#analysisStatus"),
  analysisMetrics: document.querySelector("#analysisMetrics"),
  scoreGrid: document.querySelector("#scoreGrid"),
  analysisCategoryGaps: document.querySelector("#analysisCategoryGaps"),
  analysisTrends: document.querySelector("#analysisTrends"),
  analysisTips: document.querySelector("#analysisTips"),
  projectDialog: document.querySelector("#projectDialog"),
  projectForm: document.querySelector("#projectForm"),
  projectDialogTitle: document.querySelector("#projectDialogTitle"),
  projectNameInput: document.querySelector("#projectNameInput"),
  projectClientInput: document.querySelector("#projectClientInput"),
  projectPriceInput: document.querySelector("#projectPriceInput"),
  projectTargetRateInput: document.querySelector("#projectTargetRateInput"),
  quotaEditor: document.querySelector("#quotaEditor"),
  openProjectDialog: document.querySelector("#openProjectDialog"),
  openClientDialog: document.querySelector("#openClientDialog"),
  editProjectButton: document.querySelector("#editProjectButton"),
  deleteProject: document.querySelector("#deleteProject"),
  projectSave: document.querySelector("#projectSave"),
  clientDialog: document.querySelector("#clientDialog"),
  clientForm: document.querySelector("#clientForm"),
  clientNameInput: document.querySelector("#clientNameInput"),
  clientContactInput: document.querySelector("#clientContactInput"),
  clientEmailInput: document.querySelector("#clientEmailInput"),
  clientSave: document.querySelector("#clientSave"),
  deleteConfirmDialog: document.querySelector("#deleteConfirmDialog"),
  deleteConfirmForm: document.querySelector("#deleteConfirmForm"),
  deleteConfirmText: document.querySelector("#deleteConfirmText"),
  cancelDeleteProject: document.querySelector("#cancelDeleteProject"),
  confirmDeleteProject: document.querySelector("#confirmDeleteProject"),
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
  deleteActiveProject: document.querySelector("#deleteActiveProject"),
  printReport: document.querySelector("#printReport"),
};

init();

async function init() {
  setupSupabase();
  persistState();
  if (activeSession) selectedCategory = activeSession.category;
  renderCategoryControls();
  renderManualCategoryOptions();
  renderExpenseCategoryOptions();
  renderProjectClientOptions();
  render();
  if (activeSession) startTicker();
  bindEvents();
  await initializeAuth();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}

function setupSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !window.supabase?.createClient) return;
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

async function initializeAuth() {
  if (!supabaseClient) {
    els.appShell.hidden = false;
    els.authScreen.hidden = true;
    setAuthMessage("Mode local actif. Ajoute SUPABASE_URL et SUPABASE_ANON_KEY pour activer la synchronisation.");
    els.signOutButton.hidden = true;
    return;
  }

  const { data } = await supabaseClient.auth.getSession();
  currentUser = data.session?.user || null;
  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    if (currentUser) {
      hideAuthScreen();
      await loadRemoteState();
      saveAndRender();
    } else {
      showAuthScreen();
    }
  });

  if (!currentUser) {
    showAuthScreen();
    return;
  }

  hideAuthScreen();
  await loadRemoteState();
  saveAndRender();
}

function loadState() {
  const fallback = {
    activeProjectId: "project-1",
    clients: [
      sampleClient("client-1", "Famille Dubois", "Claire Dubois", "claire@example.com"),
      sampleClient("client-2", "Atelier Bijoux", "Sophie Martin", "sophie@example.com"),
      sampleClient("client-3", "Magazine Riviera", "David Meyer", "david@example.com"),
    ],
    projects: [
      {
        id: "project-1",
        name: "Mariage civil",
        clientId: "client-1",
        price: 1800,
        targetRate: 120,
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
        clientId: "client-2",
        price: 1250,
        targetRate: 110,
        quotas: { admin: 0.75, prep: 1.5, shooting: 3, travel: 0.75, edition: 4 },
        expenses: [sampleExpense("materiel", 42, "Consommables")],
        sessions: [sampleSession("admin", 30), sampleSession("shooting", 110), sampleSession("edition", 80)],
      },
      {
        id: "project-3",
        name: "Portrait éditorial",
        clientId: "client-3",
        price: 950,
        targetRate: 120,
        quotas: { admin: 1, prep: 1, shooting: 2, travel: 0.5, edition: 3 },
        expenses: [],
        sessions: [sampleSession("prep", 40), sampleSession("shooting", 120)],
      },
    ],
  };

  const stored = loadStoredState();
  if (stored?.projects?.length) {
    loadedStateFromStorage = true;
    return normalizeState(stored);
  }
  return normalizeState(fallback);
}

function sampleClient(id, name, contact, email) {
  return { id, name, contact, email };
}

function loadStoredState() {
  const keys = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS, ...getBackupKeys()];

  for (const key of keys) {
    const parsed = parseStoredState(localStorage.getItem(key));
    if (parsed?.projects?.length) return parsed;
  }

  return null;
}

function parseStoredState(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getBackupKeys() {
  const fromIndex = parseStoredState(localStorage.getItem(BACKUP_INDEX_KEY));
  if (Array.isArray(fromIndex)) return fromIndex;
  return getAllBackupKeys();
}

function getAllBackupKeys() {
  const keys = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(BACKUP_PREFIX)) keys.push(key);
  }

  return keys.sort().reverse();
}

function normalizeState(data) {
  data.clients = normalizeClients(data.clients);
  data.projects.forEach((project) => {
    project.clientId = project.clientId || data.clients[0].id;
    project.status = project.status || VIEW_ACTIVE;
    project.price = Number(project.price || 0);
    project.targetRate = Number(project.targetRate || 120);
    project.sessions = project.sessions || [];
    project.expenses = project.expenses || [];
    project.scores = { pleasure: 3, stress: 3, creativity: 3, clientDifficulty: 3, ...(project.scores || {}) };
    project.quotas = project.quotas || {};
    categories.forEach((category) => {
      if (project.quotas[category.id] === undefined) project.quotas[category.id] = category.defaultQuota;
    });
  });
  data.activeProjectId = data.activeProjectId || data.projects.find((project) => project.status !== VIEW_COMPLETED)?.id;
  data.completedProjectId = data.completedProjectId || data.projects.find((project) => project.status === VIEW_COMPLETED)?.id || null;
  return data;
}

function normalizeClients(clients = []) {
  const normalized = clients
    .filter((client) => client?.id || client?.name)
    .map((client) => ({
      id: client.id || crypto.randomUUID(),
      name: client.name || "Client non renseigné",
      contact: client.contact || "",
      email: client.email || "",
    }));

  if (normalized.length) return normalized;
  return [{ id: "client-default", name: "Client non renseigné", contact: "", email: "" }];
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
  els.authForm.addEventListener("submit", handleAuthSubmit);
  els.authModeToggle.addEventListener("click", toggleAuthMode);
  els.signOutButton.addEventListener("click", signOut);
  els.viewActive.addEventListener("click", () => switchView(VIEW_ACTIVE));
  els.viewCompleted.addEventListener("click", () => switchView(VIEW_COMPLETED));
  els.moduleProject.addEventListener("click", () => switchModule(MODULE_PROJECT));
  els.moduleTime.addEventListener("click", () => switchModule(MODULE_TIME));
  els.moduleExpenses.addEventListener("click", () => switchModule(MODULE_EXPENSES));
  els.moduleBalance.addEventListener("click", () => switchModule(MODULE_BALANCE));
  els.toggleTimer.addEventListener("click", toggleTimer);
  els.openProjectDialog.addEventListener("click", () => openProjectDialog());
  els.openClientDialog.addEventListener("click", openClientDialog);
  els.editProjectButton.addEventListener("click", () => openProjectDialog(getActiveProject()));
  els.addManualTime.addEventListener("click", () => els.manualDialog.showModal());
  els.projectSave.addEventListener("click", saveProjectFromDialog);
  els.clientSave.addEventListener("click", saveClientFromDialog);
  els.manualSave.addEventListener("click", addManualSession);
  els.manualDurationUnit.addEventListener("change", updateManualDurationBounds);
  els.openExpenseDialog.addEventListener("click", () => openExpenseDialog());
  els.expenseSave.addEventListener("click", addExpense);
  els.exportProjectPdf.addEventListener("click", exportProjectPdf);
  els.finishProject.addEventListener("click", finishCurrentProject);
  els.deleteActiveProject.addEventListener("click", () => deleteProject(getActiveProject()?.id));
  els.cancelDeleteProject.addEventListener("click", () => resolveDeleteConfirmation(false));
  els.confirmDeleteProject.addEventListener("click", () => resolveDeleteConfirmation(true));

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

  els.clientForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveClientFromDialog();
  });

  els.deleteConfirmForm?.addEventListener("submit", (event) => {
    event.preventDefault();
  });
  els.deleteConfirmDialog.addEventListener("cancel", () => resolveDeleteConfirmation(false));
  els.deleteConfirmDialog.addEventListener("close", () => resolveDeleteConfirmation(false));

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

async function handleAuthSubmit(event) {
  event.preventDefault();
  if (!supabaseClient) {
    setAuthMessage("Supabase n'est pas encore configuré dans app.js.");
    return;
  }

  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  if (!email || !password) return;

  els.authSubmit.disabled = true;
  setAuthMessage(authMode === "signUp" ? "Création du compte..." : "Connexion...");

  const response = authMode === "signUp"
    ? await supabaseClient.auth.signUp({ email, password })
    : await supabaseClient.auth.signInWithPassword({ email, password });

  els.authSubmit.disabled = false;

  if (response.error) {
    setAuthMessage(response.error.message);
    return;
  }

  currentUser = response.data.user || response.data.session?.user || null;
  if (!currentUser && authMode === "signUp") {
    setAuthMessage("Compte créé. Vérifie ton email si Supabase demande une confirmation.");
    return;
  }

  hideAuthScreen();
  await loadRemoteState();
  saveAndRender();
}

function toggleAuthMode() {
  authMode = authMode === "signIn" ? "signUp" : "signIn";
  els.authSubmit.textContent = authMode === "signUp" ? "Créer le compte" : "Se connecter";
  els.authModeToggle.textContent = authMode === "signUp" ? "J'ai déjà un compte" : "Créer un compte";
  els.authPassword.autocomplete = authMode === "signUp" ? "new-password" : "current-password";
  setAuthMessage("");
}

async function signOut() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
}

function showAuthScreen() {
  els.authScreen.hidden = false;
  els.appShell.hidden = true;
  els.signOutButton.hidden = true;
}

function hideAuthScreen() {
  els.authScreen.hidden = true;
  els.appShell.hidden = false;
  els.signOutButton.hidden = !currentUser;
}

function setAuthMessage(message) {
  els.authMessage.textContent = message || "";
}

function switchView(view) {
  currentView = view;
  state.currentModule = currentModule;
  clearImputedPreview();
  if (currentView === VIEW_COMPLETED) stopTicker();
  if (currentView === VIEW_ACTIVE && activeSession) startTicker();
  persistState();
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
  const isProjectModule = currentModule === MODULE_PROJECT;
  const isTimeModule = currentModule === MODULE_TIME;
  const isExpensesModule = currentModule === MODULE_EXPENSES;
  const isBalanceModule = currentModule === MODULE_BALANCE;

  document.body.dataset.view = currentView;
  document.body.dataset.module = currentModule;
  els.viewActive.classList.toggle("is-active", currentView === VIEW_ACTIVE);
  els.viewCompleted.classList.toggle("is-active", currentView === VIEW_COMPLETED);
  els.moduleProject.classList.toggle("is-active", isProjectModule);
  els.moduleTime.classList.toggle("is-active", isTimeModule);
  els.moduleExpenses.classList.toggle("is-active", isExpensesModule);
  els.moduleBalance.classList.toggle("is-active", isBalanceModule);
  els.projectListTitle.textContent = currentView === VIEW_ACTIVE ? "Projets en cours" : "Projets terminés";
  els.activeProjectName.textContent = project?.name || "Aucun projet";
  els.projectStrip.hidden = false;
  els.projectHero.hidden = !hasProject || !isProjectModule;
  els.editProjectButton.hidden = !hasProject;
  els.timerPanel.hidden = currentView === VIEW_COMPLETED || !hasProject || !isTimeModule;
  els.summaryPanel.hidden = !hasProject || !(isTimeModule || isBalanceModule);
  els.historyPanel.hidden = !hasProject || !(isTimeModule || isBalanceModule);
  els.analysisPanel.hidden = !hasProject || !isBalanceModule;
  els.expensesPanel.hidden = !hasProject || !isExpensesModule;
  els.projectActions.hidden = !hasProject || !isBalanceModule;
  els.finishProject.hidden = currentView === VIEW_COMPLETED;
  els.finishProject.disabled = Boolean(activeSession);
  els.clearSessions.hidden = currentView === VIEW_COMPLETED || !(isTimeModule || isBalanceModule);

  renderProjects();
  if (hasProject) {
    renderProjectStatus(project);
    renderHeroMetrics(project);
    if (isTimeModule) {
      renderTimer();
      renderSummary(project);
      renderSessions(project);
    }
    if (isExpensesModule) renderExpenses(project);
    if (isBalanceModule) {
      renderSummary(project);
      renderSessions(project);
      renderAnalysis(project);
    }
  }
}

function renderProjects() {
  els.projectList.innerHTML = "";

  const projects = getProjectsForCurrentView();
  if (!projects.length) {
    els.projectList.innerHTML = `<div class="empty-state wide">${currentView === VIEW_ACTIVE ? "Aucun projet en cours" : "Aucun projet terminé"}</div>`;
    return;
  }

  getClientsWithProjects(projects).forEach(({ client, projects: clientProjects }) => {
    const group = document.createElement("section");
    group.className = "client-project-group";
    group.innerHTML = `
      <div class="client-group-head">
        <strong>${client.name}</strong>
        <span>${clientProjects.length} ${clientProjects.length > 1 ? "projets" : "projet"}</span>
      </div>
      <div class="client-project-row"></div>
    `;
    const row = group.querySelector(".client-project-row");

    clientProjects.forEach((project) => {
      const totalMs = getProjectTotalMs(project);
      const quotaMs = getProjectQuotaMs(project);
      const ratio = quotaMs ? totalMs / quotaMs : 0;
      const profitability = getProfitability(project);
      const selectedProject = getActiveProject();
      const button = document.createElement("button");
      button.type = "button";
      button.className = `project-card ${getQuotaMeterClass(totalMs, quotaMs)}${project.id === selectedProject?.id ? " is-active" : ""}`;
      button.innerHTML = `
        <span class="project-card-top">
          <strong>${project.name}</strong>
          <em>${profitability.label}</em>
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
        currentModule = MODULE_TIME;
        state.currentModule = currentModule;
        saveAndRender();
      });
      row.append(button);
    });

    els.projectList.append(group);
  });
}

function renderCategoryControls() {
  els.categoryGrid.innerHTML = "";
  const activeProject = getActiveProject();

  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-button";
    button.style.color = category.color;
    button.style.setProperty("--category-color", category.color);
    button.style.setProperty("--category-soft", category.softColor);
    button.dataset.category = category.id;
    button.innerHTML = `
      <span class="dot"></span>
      <strong>${category.label}</strong>
      <span>Quota ${formatDuration(hoursToMs(activeProject?.quotas?.[category.id] ?? category.defaultQuota))}</span>
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

function renderProjectClientOptions(selectedClientId = null) {
  const selectedId = selectedClientId || getActiveProject()?.clientId || state.clients[0]?.id;
  els.projectClientInput.innerHTML = state.clients
    .map((client) => `<option value="${client.id}"${client.id === selectedId ? " selected" : ""}>${client.name}</option>`)
    .join("");
}

function renderProjectStatus(project) {
  const profitability = getProfitability(project);
  els.profitStatus.className = "status-pill";
  els.profitStatus.textContent = profitability.label;
  els.profitStatus.classList.add(profitability.className);
}

function renderHeroMetrics(project) {
  els.heroPrice.textContent = formatCurrency(project.price);
  els.heroTime.textContent = formatDuration(getProjectTotalMs(project));
  els.heroQuota.textContent = formatDuration(getProjectQuotaMs(project));
  els.heroRate.textContent = `${formatCurrency(getActualHourlyRate(project))}/h`;
}

function renderTimer() {
  if (currentView === VIEW_COMPLETED) return;
  const selected = getCategory(selectedCategory);
  const runningCategory = activeSession ? getCategory(activeSession.category) : selected;
  const displayCategory = lastImputedSession ? getCategory(lastImputedSession.category) : runningCategory;
  const elapsed = activeSession ? Date.now() - activeSession.start : 0;
  const displayMs = lastImputedSession && !activeSession ? lastImputedSession.duration : elapsed;

  els.timerPanel.style.setProperty("--active-color", displayCategory.softColor || displayCategory.color);
  els.timerPanel.style.setProperty("--active-ink", displayCategory.color);
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

  const selectedId = activeSession ? activeSession.category : selectedCategory;
  const selectedButton = els.categoryGrid.querySelector(`[data-category="${selectedId}"]`);
  if (selectedButton && lastCenteredCategory !== selectedId) {
    selectedButton.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    lastCenteredCategory = selectedId;
  }
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
  els.summaryTitle.textContent = currentModule === MODULE_TIME ? "Bilan des temps" : "Bilan";
  els.businessSummary.hidden = currentModule === MODULE_TIME;
  if (currentModule !== MODULE_TIME) renderBusinessSummary(project);

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

function renderBusinessSummary(project) {
  const expensesTotal = getProjectExpensesTotal(project);
  const net = getProjectNetRevenue(project);
  const actualRate = getActualHourlyRate(project);
  const targetRate = getProjectTargetRate(project);
  const profitability = getProfitability(project);

  els.businessSummary.innerHTML = `
    <div>
      <span>Prix facturé</span>
      <strong>${formatCurrency(project.price)}</strong>
    </div>
    <div>
      <span>Frais</span>
      <strong>${formatCurrency(expensesTotal)}</strong>
    </div>
    <div>
      <span>Net</span>
      <strong>${formatCurrency(net)}</strong>
    </div>
    <div>
      <span>Taux cible</span>
      <strong>${formatCurrency(targetRate)}/h</strong>
    </div>
    <div class="${profitability.className}">
      <span>Taux réel</span>
      <strong>${formatCurrency(actualRate)}/h</strong>
      <em>${getTargetDeltaLabel(project)}</em>
    </div>
  `;
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
      const date = formatShortDate(session.start);
      row.className = "session-row";
      row.innerHTML = `
        <div class="session-category" style="color: ${category.color}">
          <span>${category.label}</span>
          <em>${date}</em>
        </div>
        <span class="session-time">${formatDuration(session.duration)}</span>
      `;
      els.sessionList.append(row);
    });
}

function renderAnalysis(project) {
  const profitability = getProfitability(project);
  const categoryPerformance = getCategoryPerformance(project);
  const underestimated = getUnderestimatedCategories();
  const profitableProjects = getCompletedProjects()
    .filter((item) => getProjectTotalMs(item) && item.price)
    .sort((a, b) => getActualHourlyRate(b) - getActualHourlyRate(a))
    .slice(0, 3);
  const longProjects = getCompletedProjects()
    .filter((item) => getProjectTotalMs(item))
    .sort((a, b) => getProjectTotalMs(b) - getProjectTotalMs(a))
    .slice(0, 3);

  els.analysisStatus.className = `status-pill ${profitability.className}`;
  els.analysisStatus.textContent = profitability.label;
  els.analysisMetrics.innerHTML = `
    <div class="analysis-card">
      <span>Taux réel</span>
      <strong>${formatCurrency(getActualHourlyRate(project))}/h</strong>
      <em>${getTargetDeltaLabel(project)}</em>
    </div>
    <div class="analysis-card">
      <span>Temps</span>
      <strong>${formatDuration(getProjectTotalMs(project))}</strong>
      <em>sur ${formatDuration(getProjectQuotaMs(project))} prévu</em>
    </div>
    <div class="analysis-card">
      <span>Net</span>
      <strong>${formatCurrency(getProjectNetRevenue(project))}</strong>
      <em>après frais</em>
    </div>
  `;

  els.scoreGrid.innerHTML = scoreItems
    .map((score) => {
      const value = Number(project.scores?.[score.id] || 3);
      return `
        <label class="score-item">
          <span>${score.label}</span>
          <strong data-score-value="${score.id}">${value}/5</strong>
          <input type="range" min="1" max="5" step="1" value="${value}" data-score="${score.id}" />
        </label>
      `;
    })
    .join("");

  els.scoreGrid.querySelectorAll("[data-score]").forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.dataset.score;
      project.scores[key] = Number(input.value);
      els.scoreGrid.querySelector(`[data-score-value="${key}"]`).textContent = `${input.value}/5`;
      persistState();
    });
  });

  els.analysisCategoryGaps.innerHTML = categoryPerformance
    .map((item) => {
      const className = getStatusClass(item.used, item.quota);
      return `
        <div class="analysis-row ${className}">
          <span>${item.category.label}</span>
          <strong>${formatDuration(item.used)} / ${formatDuration(item.quota)}</strong>
          <em>${item.deltaLabel}</em>
        </div>
      `;
    })
    .join("");

  els.analysisTrends.innerHTML = `
    ${renderTrendBlock("Sous-estimées", underestimated, (item) => `${item.category.label}: +${item.overPercent}% en moyenne`)}
    ${renderTrendBlock("Plus rentables", profitableProjects, (item) => `${item.name}: ${formatCurrency(getActualHourlyRate(item))}/h`)}
    ${renderTrendBlock("Plus chronophages", longProjects, (item) => `${item.name}: ${formatDuration(getProjectTotalMs(item))}`)}
  `;

  els.analysisTips.innerHTML = generateProjectTips(project, underestimated).map((tip) => `<li>${tip}</li>`).join("");
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
  els.projectSave.textContent = project ? "Enregistrer" : "Créer projet";
  els.deleteProject.hidden = !project;
  els.projectNameInput.value = project?.name || "";
  renderProjectClientOptions(project?.clientId || state.clients[0]?.id);
  els.projectPriceInput.value = project?.price || "";
  els.projectTargetRateInput.value = project?.targetRate || 120;
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
  const clientId = els.projectClientInput.value || state.clients[0]?.id;
  const price = Number(els.projectPriceInput.value || 0);
  const targetRate = Number(els.projectTargetRateInput.value || 0);

  const quotas = {};
  categories.forEach((category) => {
    const amount = Number(els.quotaEditor.querySelector(`[data-quota-amount="${category.id}"]`)?.value || 0);
    const unit = els.quotaEditor.querySelector(`[data-quota-unit="${category.id}"]`)?.value || "hours";
    quotas[category.id] = durationToHours(amount, unit);
  });

  if (editingProjectId) {
    const project = state.projects.find((item) => item.id === editingProjectId);
    project.name = name;
    project.clientId = clientId;
    project.price = price;
    project.targetRate = targetRate;
    project.quotas = quotas;
  } else {
    const id = crypto.randomUUID();
    state.projects.push({
      id,
      name,
      clientId,
      price,
      targetRate,
      quotas,
      sessions: [],
      expenses: [],
      scores: { pleasure: 3, stress: 3, creativity: 3, clientDifficulty: 3 },
      status: VIEW_ACTIVE,
    });
    state.activeProjectId = id;
    currentView = VIEW_ACTIVE;
  }

  els.projectDialog.close();
  saveAndRender();
}

function openClientDialog() {
  els.clientForm.reset();
  els.clientDialog.showModal();
  els.clientNameInput.focus();
}

function saveClientFromDialog() {
  const name = els.clientNameInput.value.trim();
  if (!name) return;

  const client = {
    id: crypto.randomUUID(),
    name,
    contact: els.clientContactInput.value.trim(),
    email: els.clientEmailInput.value.trim(),
  };

  state.clients.push(client);
  els.clientDialog.close();
  persistState();
  renderProjectClientOptions(client.id);
  render();
}

async function deleteEditingProject() {
  if (!editingProjectId) return;
  const deleted = await deleteProject(editingProjectId);
  if (!deleted) return;
  els.projectDialog.close();
}

async function deleteProject(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return false;
  const confirmed = await confirmProjectDeletion(project);
  if (!confirmed) return false;

  if (activeSession?.projectId === project.id) {
    activeSession = null;
    state.activeSession = null;
    stopTicker();
    clearImputedPreview();
  }

  const wasCompleted = project.status === VIEW_COMPLETED;
  state.projects = state.projects.filter((item) => item.id !== project.id);

  if (wasCompleted) {
    state.completedProjectId = state.projects.find((item) => item.status === VIEW_COMPLETED)?.id || null;
  } else {
    state.activeProjectId = state.projects.find((item) => item.status !== VIEW_COMPLETED)?.id || null;
  }

  saveAndRender();
  return true;
}

function confirmProjectDeletion(project) {
  els.deleteConfirmText.textContent = `Voulez-vous vraiment supprimer le projet "${project.name}" ? Cette action est définitive.`;
  els.deleteConfirmDialog.showModal();

  return new Promise((resolve) => {
    deleteConfirmResolver = resolve;
  });
}

function resolveDeleteConfirmation(confirmed) {
  els.deleteConfirmDialog.close();
  if (!deleteConfirmResolver) return;
  deleteConfirmResolver(confirmed);
  deleteConfirmResolver = null;
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

function getClientById(clientId) {
  return state.clients.find((client) => client.id === clientId) || state.clients[0];
}

function getClientsWithProjects(projects) {
  const clientOrder = state.clients.map((client) => client.id);
  const grouped = projects.reduce((groups, project) => {
    const client = getClientById(project.clientId);
    if (!groups.has(client.id)) groups.set(client.id, { client, projects: [] });
    groups.get(client.id).projects.push(project);
    return groups;
  }, new Map());

  return [...grouped.values()].sort((a, b) => {
    const aIndex = clientOrder.indexOf(a.client.id);
    const bIndex = clientOrder.indexOf(b.client.id);
    if (aIndex === -1 && bIndex === -1) return a.client.name.localeCompare(b.client.name);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
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

function getProjectNetRevenue(project) {
  return Number(project.price || 0) - getProjectExpensesTotal(project);
}

function getActualHourlyRate(project) {
  const hours = getProjectTotalMs(project) / 3_600_000;
  if (!hours) return 0;
  return getProjectNetRevenue(project) / hours;
}

function getPlannedHourlyRate(project) {
  const hours = getProjectQuotaMs(project) / 3_600_000;
  if (!hours) return 0;
  return getProjectNetRevenue(project) / hours;
}

function getProjectTargetRate(project) {
  return Number(project.targetRate || 0);
}

function getProfitability(project) {
  const totalMs = getProjectTotalMs(project);
  const net = getProjectNetRevenue(project);
  const actualRate = getActualHourlyRate(project);
  const targetRate = getProjectTargetRate(project);

  if (!project.price || !totalMs) return { label: "À calculer", className: "neutral" };
  if (net <= 0 || actualRate <= 0) return { label: "Perdant", className: "loss" };
  if (!targetRate) return actualRate >= 120
    ? { label: "Rentable", className: "profit" }
    : actualRate >= 108
      ? { label: "Limite", className: "warning" }
      : { label: "Perdant", className: "loss" };
  if (actualRate >= targetRate) return { label: "Rentable", className: "profit" };
  if (actualRate >= targetRate * 0.9) return { label: "Limite", className: "warning" };
  return { label: "Perdant", className: "loss" };
}

function getTargetDeltaLabel(project) {
  const targetRate = getProjectTargetRate(project);
  if (!targetRate) return "Aucun taux cible";
  const delta = getActualHourlyRate(project) - targetRate;
  if (delta >= 0) return `${formatCurrency(delta)}/h au-dessus`;
  return `${formatCurrency(Math.abs(delta))}/h sous cible`;
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

function getCompletedProjects() {
  return state.projects.filter((project) => project.status === VIEW_COMPLETED);
}

function getCategoryPerformance(project) {
  const totals = getTotals(project);
  return categories.map((category) => {
    const used = totals[category.id] || 0;
    const quota = hoursToMs(project.quotas[category.id] || 0);
    const delta = used - quota;
    const ratio = quota ? used / quota : 0;
    let deltaLabel = "Dans le quota";
    if (!quota) deltaLabel = used ? "Sans estimation" : "Non suivi";
    else if (delta > 0) deltaLabel = `+${formatDuration(delta)}`;
    else if (ratio >= 0.9) deltaLabel = "Proche du quota";
    else deltaLabel = `${formatDuration(Math.abs(delta))} dispo`;
    return { category, used, quota, ratio, deltaLabel };
  });
}

function getUnderestimatedCategories() {
  return categories
    .map((category) => {
      const ratios = getCompletedProjects()
        .map((project) => {
          const used = getTotals(project)[category.id] || 0;
          const quota = hoursToMs(project.quotas[category.id] || 0);
          return quota ? used / quota : 0;
        })
        .filter((ratio) => ratio > 0);
      if (!ratios.length) return null;
      const averageRatio = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
      const overCount = ratios.filter((ratio) => ratio > 1).length;
      if (averageRatio <= 1.05 && overCount < 2) return null;
      return {
        category,
        averageRatio,
        overPercent: Math.round((averageRatio - 1) * 100),
        overCount,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.averageRatio - a.averageRatio);
}

function renderTrendBlock(title, items, formatter) {
  if (!items.length) {
    return `
      <div class="trend-block">
        <strong>${title}</strong>
        <span>Aucune donnée suffisante</span>
      </div>
    `;
  }

  return `
    <div class="trend-block">
      <strong>${title}</strong>
      ${items.map((item) => `<span>${formatter(item)}</span>`).join("")}
    </div>
  `;
}

function generateProjectTips(project, underestimated) {
  const tips = [];
  const overCategory = getCategoryPerformance(project)
    .filter((item) => item.quota && item.used > item.quota)
    .sort((a, b) => b.ratio - a.ratio)[0];
  const targetRate = getProjectTargetRate(project);
  const actualRate = getActualHourlyRate(project);
  const scores = project.scores || {};

  if (overCategory) {
    tips.push(`Ajoute une marge en ${overCategory.category.label.toLowerCase()}: cette catégorie dépasse le prévu.`);
  } else if (underestimated[0]) {
    tips.push(`Revois le quota ${underestimated[0].category.label.toLowerCase()}: il est souvent sous-estimé.`);
  }

  if (targetRate && actualRate && actualRate < targetRate) {
    tips.push(`Ajuste prix ou temps: il manque ${formatCurrency(targetRate - actualRate)}/h pour la cible.`);
  } else if (project.price && getProjectQuotaMs(project)) {
    tips.push(`Garde ce modèle de devis: le taux réel reste cohérent avec l'objectif.`);
  }

  if (Number(scores.stress) >= 4 || Number(scores.clientDifficulty) >= 4) {
    tips.push("Ajoute une marge client et cadre mieux les retours dès le devis.");
  } else if (Number(scores.pleasure) >= 4 && Number(scores.creativity) >= 4) {
    tips.push("Ce type de projet est bon pour ton énergie: garde-le dans tes offres.");
  }

  const fallback = [
    "Renseigne toujours les frais: le taux horaire devient beaucoup plus fiable.",
    "Compare le temps réel au quota dès la fin du shooting.",
    "Archive chaque projet terminé pour affiner tes prochains forfaits.",
  ];

  fallback.forEach((tip) => {
    if (tips.length < 3) tips.push(tip);
  });

  return tips.slice(0, 3);
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
  const actualRate = getActualHourlyRate(project);
  const targetRate = getProjectTargetRate(project);
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
        <em>${getProfitability(project).label}</em>
      </div>
      <p class="print-expense-total">Taux réel: ${formatCurrency(actualRate)}/h | Taux cible: ${formatCurrency(targetRate)}/h</p>
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
  const serialized = JSON.stringify(state);
  saveBackupSnapshot(serialized);
  localStorage.setItem(STORAGE_KEY, serialized);
  queueSupabaseSync();
}

async function loadRemoteState() {
  if (!supabaseClient || !currentUser) return;

  const [{ data: clients, error: clientsError }, { data: projects, error: projectsError }] = await Promise.all([
    supabaseClient.from("clients").select("id,user_id,name,contact,email").eq("user_id", currentUser.id).order("name"),
    supabaseClient.from("projects").select("id,user_id,client_id,name,price,target_rate,quotas,sessions,expenses,status").eq("user_id", currentUser.id).order("name"),
  ]);

  if (clientsError || projectsError) {
    setAuthMessage("Synchronisation indisponible. L'app continue avec la sauvegarde locale.");
    remoteReady = false;
    return;
  }

  const remoteClients = (clients || []).map(mapClientFromSupabase);
  const remoteProjects = (projects || []).map(mapProjectFromSupabase);
  const localClients = [...state.clients];
  const localProjects = [...state.projects];

  remoteReady = true;

  if (loadedStateFromStorage && localProjects.length) {
    const mergedState = normalizeState({
      ...state,
      activeSession,
      clients: mergeById(remoteClients, localClients),
      projects: mergeById(remoteProjects, localProjects),
    });
    replaceState(mergedState);
    await syncStateToSupabase({ prune: false });
    return;
  }

  const remoteState = normalizeState({
    ...state,
    activeSession,
    clients: remoteClients,
    projects: remoteProjects,
  });

  replaceState(remoteState);
}

function mergeById(remoteItems, localItems) {
  const merged = new Map(remoteItems.map((item) => [item.id, item]));
  localItems.forEach((item) => {
    merged.set(item.id, { ...(merged.get(item.id) || {}), ...item });
  });
  return [...merged.values()];
}

function replaceState(nextState) {
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, nextState);
  activeSession = state.activeSession || null;
  currentModule = MODULES.includes(state.currentModule) ? state.currentModule : MODULE_TIME;
  if (activeSession) selectedCategory = activeSession.category;
}

function mapClientFromSupabase(client) {
  return {
    id: client.id,
    name: client.name,
    contact: client.contact || "",
    email: client.email || "",
  };
}

function mapProjectFromSupabase(project) {
  return {
    id: project.id,
    clientId: project.client_id,
    name: project.name,
    price: Number(project.price || 0),
    targetRate: Number(project.target_rate || 120),
    quotas: project.quotas || {},
    sessions: project.sessions || [],
    expenses: project.expenses || [],
    status: project.status || VIEW_ACTIVE,
  };
}

function mapClientToSupabase(client) {
  return {
    id: client.id,
    user_id: currentUser.id,
    name: client.name,
    contact: client.contact || "",
    email: client.email || "",
  };
}

function mapProjectToSupabase(project) {
  return {
    id: project.id,
    user_id: currentUser.id,
    client_id: project.clientId,
    name: project.name,
    price: Number(project.price || 0),
    target_rate: Number(project.targetRate || 0),
    quotas: project.quotas || {},
    sessions: project.sessions || [],
    expenses: project.expenses || [],
    status: project.status || VIEW_ACTIVE,
  };
}

function queueSupabaseSync() {
  if (!supabaseClient || !currentUser || !remoteReady) return;
  if (syncInProgress) {
    syncQueued = true;
    return;
  }

  window.setTimeout(syncStateToSupabase, 0);
}

async function syncStateToSupabase(options = {}) {
  if (!supabaseClient || !currentUser) return;
  const { prune = true } = options;

  syncInProgress = true;
  try {
    if (state.clients.length) {
      const { error } = await supabaseClient.from("clients").upsert(state.clients.map(mapClientToSupabase));
      if (error) throw error;
    }

    if (state.projects.length) {
      const { error } = await supabaseClient.from("projects").upsert(state.projects.map(mapProjectToSupabase));
      if (error) throw error;
    }

    if (prune) {
      await pruneRemoteRows("projects", state.projects.map((project) => project.id));
      await pruneRemoteRows("clients", state.clients.map((client) => client.id));
    }
    remoteReady = true;
  } catch {
    setAuthMessage("Sync Supabase en attente. Les données restent sauvegardées localement.");
  } finally {
    syncInProgress = false;
    if (syncQueued) {
      syncQueued = false;
      await syncStateToSupabase();
    }
  }
}

async function pruneRemoteRows(table, keptIds) {
  const { data, error } = await supabaseClient.from(table).select("id").eq("user_id", currentUser.id);
  if (error) throw error;
  const staleIds = (data || []).map((row) => row.id).filter((id) => !keptIds.includes(id));
  if (!staleIds.length) return;
  const { error: deleteError } = await supabaseClient.from(table).delete().eq("user_id", currentUser.id).in("id", staleIds);
  if (deleteError) throw deleteError;
}

function saveBackupSnapshot(serialized) {
  try {
    const key = `${BACKUP_PREFIX}${new Date().toISOString()}`;
    localStorage.setItem(key, serialized);
    const backupKeys = pruneBackupKeys([key, ...getBackupKeys().filter((item) => item !== key)].slice(0, MAX_BACKUPS));
    localStorage.setItem(BACKUP_INDEX_KEY, JSON.stringify(backupKeys));
    getAllBackupKeys()
      .filter((item) => !backupKeys.includes(item))
      .forEach((oldKey) => localStorage.removeItem(oldKey));
  } catch {
    localStorage.setItem(STORAGE_KEY, serialized);
  }
}

function pruneBackupKeys(keys) {
  const kept = [...keys];

  while (kept.length && getBackupStorageBytes(kept) > MAX_BACKUP_BYTES) {
    kept.pop();
  }

  return kept;
}

function getBackupStorageBytes(keys) {
  return keys.reduce((total, key) => {
    const value = localStorage.getItem(key) || "";
    return total + new Blob([value]).size;
  }, 0);
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

function formatShortDate(value) {
  return new Date(value).toLocaleDateString("fr-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}
