/* ══════════════════════════════════════════════════════
   FRAMES — Mini ERP pour photographe freelance
   app.js · Phase 3 — Module Studio
   ══════════════════════════════════════════════════════ */

'use strict';

// ════════════════════════════════════════════════════════
// STORAGE — préfixe fr_
// ════════════════════════════════════════════════════════

const Storage = {
  get(key) {
    try {
      const v = localStorage.getItem(`fr_${key}`);
      return v !== null ? JSON.parse(v) : null;
    } catch { return null; }
  },
  set(key, value) {
    try {
      localStorage.setItem(`fr_${key}`, JSON.stringify(value));
    } catch (e) {
      console.warn('Frames: localStorage write failed', e);
    }
  },
  remove(key) { localStorage.removeItem(`fr_${key}`); },
  clearAll() {
    Object.keys(localStorage)
      .filter(k => k.startsWith('fr_'))
      .forEach(k => localStorage.removeItem(k));
  },
};

// ════════════════════════════════════════════════════════
// CATEGORIES — couleurs et labels définitifs
// ════════════════════════════════════════════════════════

const CATEGORIES = {
  admin:     { label: 'Admin',       color: '#8AAAC8', bg: 'rgba(138,170,200,0.18)' },
  prepa:     { label: 'Préparation', color: '#9B7EC8', bg: 'rgba(155,126,200,0.18)' },
  shooting:  { label: 'Shooting',    color: '#E09050', bg: 'rgba(224,144,80,0.18)'  },
  trajet:    { label: 'Trajet',      color: '#6AAAD4', bg: 'rgba(106,170,212,0.18)' },
  edition:   { label: 'Édition',     color: '#5AAE82', bg: 'rgba(90,174,130,0.18)'  },
  revisions: { label: 'Révisions',   color: '#E07878', bg: 'rgba(224,120,120,0.18)' },
};

// ════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════

const state = {
  currentView:    'studio',
  user:           Storage.get('user')     ?? null,
  contacts:       Storage.get('contacts') ?? [],
  projets:        Storage.get('projets')  ?? [],
  activeProjetId: null,    // projet sélectionné dans le module Projet
  projetSubView:  'offre', // sous-onglet actif
};

const save = {
  user:     () => Storage.set('user',     state.user),
  contacts: () => Storage.set('contacts', state.contacts),
  projets:  () => Storage.set('projets',  state.projets),
};

// Comparaisons de taux actives uniquement si fr_user.tauxCible > 0
function hasTaux() {
  return !!(state.user?.tauxCible > 0);
}

// ════════════════════════════════════════════════════════
// DOM HELPERS
// ════════════════════════════════════════════════════════

const $ = id => document.getElementById(id);

function _genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function _fmtCHF(n) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-CH', {
    style: 'currency', currency: 'CHF', maximumFractionDigits: 0,
  }).format(n);
}

// Protection XSS minimale sur les données saisies
function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ════════════════════════════════════════════════════════
// TIMER — état module-level (survit à la navigation)
// ════════════════════════════════════════════════════════

let _timerInterval   = null;
let _timerStart      = null;
let _timerCat        = 'shooting';
let _timerSeconds    = 0;
let _editingProjetId = null; // null = création, string = édition du projet correspondant

// ════════════════════════════════════════════════════════
// SHELL — navigation + topbar
// ════════════════════════════════════════════════════════

const TABS = [
  { id: 'studio',      label: 'Studio',    icon: _ico_camera()  },
  { id: 'prospection', label: 'Prospect.', icon: _ico_users()   },
  { id: 'projet',      label: 'Projet',    icon: _ico_folder()  },
  { id: 'insights',    label: 'Insights',  icon: _ico_chart()   },
  { id: 'profil',      label: 'Profil',    icon: _ico_user()    },
];

function showShell(view = 'studio') {
  _renderTabBar();
  navigateTo(view);
}

function _renderTabBar() {
  const nav = $('moduleTabs');
  nav.innerHTML = TABS.map(t => `
    <button class="module-tab" data-tab="${t.id}" type="button" aria-label="${t.label}">
      ${t.icon}
      <span>${t.label}</span>
    </button>
  `).join('');
  nav.addEventListener('click', e => {
    const btn = e.target.closest('[data-tab]');
    if (btn) navigateTo(btn.dataset.tab);
  });
}

function navigateTo(view) {
  state.currentView = view;

  document.querySelectorAll('[data-tab]').forEach(btn =>
    btn.classList.toggle('is-active', btn.dataset.tab === view)
  );

  _renderTopbar(view);

  const el = $('viewContainer');
  el.style.opacity    = '0';
  el.style.transition = '';
  requestAnimationFrame(() => {
    _renderView(view, el);
    _wireTopbarAction(view);
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.2s ease';
      el.style.opacity    = '1';
    });
  });
}

function _renderTopbar(view) {
  const now  = new Date();
  const mois = now.toLocaleDateString('fr-CH', { month: 'long' });
  const an   = now.getFullYear();
  $('topbarEyebrow').textContent = `Frames · ${mois} ${an}`;
  $('topbarTitle').textContent   = TABS.find(t => t.id === view)?.label ?? 'Frames';
  $('topbarAction').hidden = !['studio', 'prospection'].includes(view);
}

function _wireTopbarAction(view) {
  // Clone pour effacer les anciens listeners sans removeEventListener
  const old   = $('topbarAction');
  const fresh = old.cloneNode(true);
  old.parentNode.replaceChild(fresh, old);

  if (view === 'studio')      fresh.addEventListener('click', _openNewProjectSheet);
  // prospection : Phase 4
}

// ════════════════════════════════════════════════════════
// VUES
// ════════════════════════════════════════════════════════

function _renderView(view, el) {
  switch (view) {
    case 'studio':
      el.innerHTML = _viewStudio();
      _wireStudio();
      break;
    case 'prospection': el.innerHTML = _viewProspection(); break;
    case 'projet':
      el.innerHTML = _viewProjet();
      _wireProjet();
      break;
    case 'insights':    el.innerHTML = _viewInsights();    break;
    case 'profil':
      el.innerHTML = _viewProfil();
      _wireProfilView();
      break;
    default:            el.innerHTML = '';
  }
}

// ════════════════════════════════════════════════════════
// MODULE STUDIO — Phase 3
// ════════════════════════════════════════════════════════

// Dérivé de CATEGORIES pour compatibilité avec _subviewOffre
const CAT_COLORS = Object.fromEntries(
  Object.entries(CATEGORIES).map(([k, v]) => [k, v.color])
);

const TYPE_LABELS = {
  corporate:  'Corporate',
  portrait:   'Portrait',
  mariage:    'Mariage',
  event:      'Événement',
  commercial: 'Commercial',
  autre:      'Autre',
};

function _viewStudio() {
  const caMois    = _statsCaMois();
  const tauxMoyen = _statsTauxMoyen();

  const statsHtml = `
    <div class="stats-row">
      <div class="stat-card glass-card">
        <p class="stat-label">CA ce mois</p>
        <p class="stat-value">${caMois > 0 ? _fmtCHF(caMois) : '—'}</p>
      </div>
      <div class="stat-card glass-card">
        <p class="stat-label">Taux moyen réel</p>
        <p class="stat-value">${tauxMoyen !== null ? _fmtCHF(tauxMoyen) + '/h' : '—'}</p>
      </div>
    </div>`;

  if (!state.projets.length) {
    return statsHtml + `
      <div class="studio-empty">
        ${_ico_camera_lg()}
        <p class="empty-title">Aucun projet pour l'instant</p>
        <p class="empty-sub">Crée ton premier projet<br>pour commencer à suivre ton activité.</p>
        <button class="btn-action" id="btnCreateFirst" type="button">
          Créer mon premier projet
        </button>
      </div>`;
  }

  const groups   = _groupByClient(state.projets);
  const listHtml = groups.map(({ clientNom, items }) => `
    <div class="client-group">
      <p class="client-group-label">${_esc(clientNom)}</p>
      ${items.map(_renderProjetCard).join('')}
    </div>
  `).join('');

  return statsHtml + `<div class="projet-list">${listHtml}</div>`;
}

function _wireStudio() {
  $('btnCreateFirst')?.addEventListener('click', _openNewProjectSheet);

  $('viewContainer').querySelectorAll('[data-projet-id]').forEach(card => {
    card.addEventListener('click', () => {
      // Phase 5 : ouvrir le détail projet — pour l'instant stub
      navigateTo('projet');
    });
  });
}

// ─── Stats ───────────────────────────────────────────────

function _statsCaMois() {
  const now   = new Date();
  const annee = now.getFullYear();
  const mois  = now.getMonth();
  return state.projets
    .filter(p => {
      if (!p.datePrevue) return false;
      const d = new Date(p.datePrevue);
      return d.getFullYear() === annee && d.getMonth() === mois;
    })
    .reduce((sum, p) => sum + (Number(p.prixFacture) || 0), 0);
}

function _statsTauxMoyen() {
  // Nécessite les sessions (Phase 6) — retourne null → affiche "—"
  return null;
}

// ─── Groupement par client ────────────────────────────────

function _groupByClient(projets) {
  const map = new Map();
  projets.forEach(p => {
    const key = p.clientNom?.trim() || 'Sans client';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  });
  return [...map.entries()]
    .map(([clientNom, items]) => ({ clientNom, items }))
    .sort((a, b) => a.clientNom.localeCompare(b.clientNom, 'fr'));
}

// ─── Carte projet ─────────────────────────────────────────

function _renderProjetCard(p) {
  const pill = _statutPill(p);
  const date = p.datePrevue
    ? new Date(p.datePrevue).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })
    : '';
  const type = TYPE_LABELS[p.type] ?? p.type ?? '';
  const prix = p.prixFacture ? _fmtCHF(p.prixFacture) : '—';

  return `
    <button class="projet-card" data-projet-id="${p.id}" type="button">
      <div class="projet-card-header">
        <span class="projet-name">${_esc(p.nom)}</span>
        <span class="statut-pill statut-${pill.cls}">${pill.label}</span>
      </div>
      <div class="projet-card-meta">
        <span>${type}</span>
        ${date ? `<span>·</span><span>${date}</span>` : ''}
        <span class="projet-prix">${prix}</span>
      </div>
    </button>`;
}

function _statutPill(p) {
  switch (p.statut) {
    case 'en_cours': return { label: 'En cours',  cls: 'encours'   };
    case 'livre':    return { label: 'Livré',      cls: 'livre'     };
    case 'archive':  return { label: 'Archivé',   cls: 'archive'   };
    default:         return { label: 'Brouillon', cls: 'brouillon' };
  }
}

// ─── Bottom sheet — nouveau projet ───────────────────────

function _openNewProjectSheet(editProjet = null) {
  if (document.querySelector('.bottom-sheet')) return; // déjà ouvert

  const isEdit  = editProjet !== null;
  const types   = [
    ['corporate', 'Corporate'], ['portrait', 'Portrait'],
    ['mariage',   'Mariage'],   ['event',    'Événement'],
    ['commercial','Commercial'],['autre',    'Autre'],
  ];

  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  overlay.id = 'sheetOverlay';
  overlay.addEventListener('click', () => {
    if (!isEdit) _editingProjetId = null; // reset si fermeture sans save
    _closeSheet();
  });

  const sheet = document.createElement('div');
  sheet.className = 'bottom-sheet';
  sheet.id = 'newProjectSheet';
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <h2 class="sheet-title">${isEdit ? 'Modifier le projet' : 'Nouveau projet'}</h2>
      <button class="icon-button" id="closeSheet" type="button" aria-label="Fermer">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <form class="sheet-form" id="newProjectForm" novalidate>
      <label for="nfNom">
        Nom du projet
        <input id="nfNom" name="nom" type="text"
          placeholder="ex. Shooting corporate ACME" autocomplete="off" required
          value="${isEdit ? _esc(editProjet.nom) : ''}" />
      </label>
      <label for="nfClient">
        Client
        <input id="nfClient" name="clientNom" type="text"
          placeholder="Nom du client ou de l'entreprise" autocomplete="off"
          value="${isEdit && editProjet.clientNom ? _esc(editProjet.clientNom) : ''}" />
      </label>
      <div class="form-row">
        <label for="nfType">
          Type
          <select id="nfType" name="type">
            ${types.map(([v, l]) =>
              `<option value="${v}"${isEdit && editProjet.type === v ? ' selected' : ''}>${l}</option>`
            ).join('')}
          </select>
        </label>
        <label for="nfDate">
          Date prévue
          <input id="nfDate" name="datePrevue" type="date"
            value="${isEdit && editProjet.datePrevue ? editProjet.datePrevue : ''}" />
        </label>
      </div>
      <label for="nfPrix">
        Prix facturé (CHF)
        <input id="nfPrix" name="prixFacture" type="number"
          placeholder="0" min="0" step="50" inputmode="numeric"
          value="${isEdit && editProjet.prixFacture ? editProjet.prixFacture : ''}" />
      </label>
      <button class="btn-action sheet-submit" type="submit">
        ${isEdit ? 'Enregistrer' : 'Créer le projet'}
      </button>
    </form>`;

  document.body.appendChild(overlay);
  document.body.appendChild(sheet);

  $('closeSheet').addEventListener('click', () => {
    _editingProjetId = null;
    _closeSheet();
  });
  $('newProjectForm').addEventListener('submit', _submitNewProject);

  // Animate in
  requestAnimationFrame(() => {
    overlay.classList.add('is-visible');
    sheet.classList.add('is-open');
  });

  setTimeout(() => $('nfNom')?.focus(), 340);
}

function _closeSheet() {
  const overlay = $('sheetOverlay');
  const sheet   = document.querySelector('.bottom-sheet');
  if (!sheet) return;
  overlay?.classList.remove('is-visible');
  sheet.classList.remove('is-open');
  setTimeout(() => { overlay?.remove(); sheet.remove(); }, 340);
}

function _submitNewProject(e) {
  e.preventDefault();
  const form = e.target;
  const nom  = form.nom.value.trim();
  if (!nom) { $('nfNom').focus(); return; }

  const clientNom = form.clientNom.value.trim();

  // Trouver ou créer le contact
  let clientId = null;
  if (clientNom) {
    let contact = state.contacts.find(
      c => c.nom.toLowerCase() === clientNom.toLowerCase()
    );
    if (!contact) {
      contact = {
        id:          _genId(),
        nom:         clientNom,
        entreprise:  '',
        canal:       '',
        dateContact: new Date().toISOString().slice(0, 10),
        statut:      'client',
        note:        '',
        projetId:    null,
      };
      state.contacts.push(contact);
      save.contacts();
    }
    clientId = contact.id;
  }

  // ── Mode édition ──────────────────────────────────────
  if (_editingProjetId) {
    const idx = state.projets.findIndex(p => p.id === _editingProjetId);
    if (idx !== -1) {
      state.projets[idx].nom        = nom;
      state.projets[idx].clientNom  = clientNom;
      state.projets[idx].clientId   = clientId;
      state.projets[idx].type       = form.type.value;
      state.projets[idx].datePrevue = form.datePrevue.value || null;
      state.projets[idx].prixFacture= Number(form.prixFacture.value) || null;
      save.projets();
    }
    _editingProjetId = null;
    _closeSheet();
    // Re-render la sous-vue offre avec les nouvelles données
    setTimeout(() => {
      state.projetSubView = 'offre';
      _refreshProjetSubView();
    }, 360);
    return;
  }

  // ── Mode création ─────────────────────────────────────
  const projet = {
    id:            _genId(),
    nom,
    clientId,
    clientNom,
    type:          form.type.value,
    datePrevue:    form.datePrevue.value || null,
    prixFacture:   Number(form.prixFacture.value) || null,
    statut:        'brouillon',
    quotas:        { admin: 0, prepa: 0, shooting: 0, trajet: 0, edition: 0 },
    checklist:     [],
    sessions:      [],
    frais:         [],
    photosLivrees: null,
    evalClient:    null,
    revisions:     0,
    scores:        {},
    notesLibres:   '',
    dateCreation:  new Date().toISOString(),
    dateCloture:   null,
  };

  state.projets.unshift(projet);
  state.activeProjetId = projet.id;
  save.projets();

  _closeSheet();
  setTimeout(() => navigateTo('studio'), 360);
}

// ════════════════════════════════════════════════════════
// VUES STUB — Phases 4–9
// ════════════════════════════════════════════════════════

function _viewProspection() {
  return `
    <div class="empty-state" style="margin:32px 16px;min-height:200px;">
      <p style="font-size:.8rem;color:rgba(30,50,70,.3);">Module Prospection — Phase 4</p>
    </div>`;
}

function _viewProjet() {
  if (!state.projets.length) {
    return `
      <div class="projet-empty">
        ${_ico_folder_lg()}
        <p class="empty-title">Aucun projet</p>
        <p class="empty-sub">Crée un projet depuis Studio<br>pour construire ton offre.</p>
        <button class="btn-action" id="btnGoCreateProjet" type="button">
          Créer un projet
        </button>
      </div>`;
  }

  // Initialiser ou valider l'activeProjetId
  if (!state.activeProjetId || !state.projets.find(p => p.id === state.activeProjetId)) {
    state.activeProjetId = state.projets[0].id;
  }

  const projet   = state.projets.find(p => p.id === state.activeProjetId);
  const subViews = ['offre', 'temps', 'frais', 'bilan'];

  return `
    <div class="projet-module">

      <!-- Carrousel chips projet -->
      <div class="projet-chips-scroll" id="projetChips">
        ${state.projets.map(p => `
          <button class="projet-chip${p.id === state.activeProjetId ? ' is-active' : ''}"
            data-id="${p.id}" type="button">
            <span class="chip-nom">${_esc(p.nom)}</span>
            ${p.clientNom ? `<span class="chip-client">${_esc(p.clientNom)}</span>` : ''}
          </button>`).join('')}
      </div>

      <!-- Sous-onglets -->
      <div class="projet-subtabs">
        ${subViews.map(v => `
          <button class="projet-subtab${state.projetSubView === v ? ' is-active' : ''}"
            data-subview="${v}" type="button">
            ${v[0].toUpperCase() + v.slice(1)}
          </button>`).join('')}
      </div>

      <!-- Contenu sous-vue -->
      <div id="projetSubView">
        ${_renderProjetSubView(state.projetSubView, projet)}
      </div>

    </div>`;
}

// ─── Wiring module Projet ─────────────────────────────

function _wireProjet() {
  // État vide → créer un projet
  $('btnGoCreateProjet')?.addEventListener('click', () => {
    navigateTo('studio');
    setTimeout(_openNewProjectSheet, 260);
  });

  // Chips projet — sélection
  document.querySelectorAll('.projet-chip').forEach(chip =>
    chip.addEventListener('click', e => {
      const id = e.currentTarget.dataset.id;
      if (id === state.activeProjetId) return;
      state.activeProjetId = id;
      document.querySelectorAll('.projet-chip').forEach(c =>
        c.classList.toggle('is-active', c.dataset.id === id)
      );
      _scrollActiveChip();
      _refreshProjetSubView();
    })
  );
  // Centrer la chip active au chargement
  setTimeout(_scrollActiveChip, 80);

  // Sous-onglets
  document.querySelectorAll('[data-subview]').forEach(btn =>
    btn.addEventListener('click', e => {
      const sv = e.currentTarget.dataset.subview;
      state.projetSubView = sv;
      document.querySelectorAll('[data-subview]').forEach(b =>
        b.classList.toggle('is-active', b.dataset.subview === sv)
      );
      _refreshProjetSubView();
    })
  );

  // Wire la sous-vue courante
  const projet = _activeProjet();
  if (projet) _wireProjetSubView(state.projetSubView, projet);
}

function _scrollActiveChip() {
  document.querySelector('.projet-chip.is-active')
    ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

function _activeProjet() {
  return state.projets.find(p => p.id === state.activeProjetId) ?? null;
}

function _refreshProjetSubView() {
  const projet    = _activeProjet();
  const subViewEl = $('projetSubView');
  if (!projet || !subViewEl) return;
  subViewEl.innerHTML = _renderProjetSubView(state.projetSubView, projet);
  _wireProjetSubView(state.projetSubView, projet);
}

function _renderProjetSubView(sv, projet) {
  switch (sv) {
    case 'offre':  return _subviewOffre(projet);
    case 'temps':  return _subviewTemps(projet);
    case 'frais':  return _subviewFrais(projet);
    case 'bilan':  return _subviewBilan(projet);
    default:       return '';
  }
}

function _wireProjetSubView(sv, projet) {
  if (sv === 'offre')  _wireOffre(projet);
  if (sv === 'temps')  _wireTemps(projet);
  if (sv === 'frais')  _wireFrais(projet);
}

// ════════════════════════════════════════════════════════
// SOUS-VUE OFFRE — Phase 5
// ════════════════════════════════════════════════════════

function _subviewOffre(projet) {

  const totalH = _totalQuotaH(projet);
  const taux   = _calcTauxImplicite(projet, totalH);
  const tauxCls = taux !== null ? _tauxImplClass(taux) : '';

  const date = projet.datePrevue
    ? new Date(projet.datePrevue).toLocaleDateString('fr-CH',
        { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  const cats = [
    ['admin',    'Admin'],
    ['prepa',    'Prépa'],
    ['shooting', 'Shooting'],
    ['trajet',   'Trajet'],
    ['edition',  'Édition'],
  ];

  return `
    <div class="offre-view">

      <!-- Infos + taux implicite -->
      <div class="offre-section glass-card">
        <div class="offre-infos-header">
          <div class="offre-infos-text">
            <p class="offre-nom">${_esc(projet.nom)}</p>
            <p class="offre-meta">${[
              TYPE_LABELS[projet.type],
              projet.clientNom ? _esc(projet.clientNom) : '',
              date,
              projet.prixFacture ? _fmtCHF(projet.prixFacture) : '',
            ].filter(Boolean).join(' · ')}</p>
            <button class="btn-link-edit" id="btnEditProjet" type="button">Modifier</button>
          </div>
          <div class="taux-impl ${tauxCls}" id="tauxImplCard">
            <p class="taux-impl-val" id="tauxImplVal">
              ${taux !== null ? `CHF ${taux}/h` : '—'}
            </p>
            <p class="taux-impl-label">taux implicite</p>
          </div>
        </div>
      </div>

      <!-- Quotas -->
      <div class="offre-section glass-card">
        <p class="offre-section-title">Temps estimé</p>
        ${cats.map(([key, label]) => `
          <div class="quota-cat-row">
            <span class="quota-cat-dot" style="background:${CAT_COLORS[key]}"></span>
            <span class="quota-cat-label">${label}</span>
            <input class="quota-input" type="number"
              data-cat="${key}" min="0" step="0.5"
              value="${projet.quotas[key] ?? 0}" />
            <select class="quota-unit" data-cat="${key}">
              <option value="h">h</option>
              <option value="min">min</option>
              <option value="j">j (8h)</option>
            </select>
          </div>`).join('')}
        <div class="quota-total-bar">
          <span>Total estimé</span>
          <strong id="quotaTotalVal">${_fmtH(totalH)}</strong>
        </div>
      </div>

      <!-- Checklist matériel -->
      <div class="offre-section glass-card">
        <p class="offre-section-title">Matériel</p>
        ${_renderChecklistSection(projet)}
      </div>

      <!-- CTA -->
      <button class="btn-action" id="btnStartChrono" type="button">
        Démarrer le chrono →
      </button>

    </div>`;
}

function _wireOffre(projet) {
  // Quotas — mise à jour temps réel + auto-save
  document.querySelectorAll('.quota-input, .quota-unit').forEach(el =>
    el.addEventListener('input', () => _onQuotaChange(projet))
  );

  // Checklist — toggle avec upsert (items profil pas encore dans proj.checklist)
  _wireChecklistSection(projet);

  // Lien "aller au Profil" si matériel vide
  $('btnGoToProfil')?.addEventListener('click', () => navigateTo('profil'));

  // Modifier le projet → ouvre le sheet en mode édition
  $('btnEditProjet')?.addEventListener('click', () => {
    _editingProjetId = projet.id;
    _openNewProjectSheet(projet);
  });

  // Démarrer le chrono → sous-onglet Temps
  $('btnStartChrono')?.addEventListener('click', () => {
    state.projetSubView = 'temps';
    document.querySelectorAll('[data-subview]').forEach(b =>
      b.classList.toggle('is-active', b.dataset.subview === 'temps')
    );
    _refreshProjetSubView();
  });
}

function _onQuotaChange(projet) {
  const cats = ['admin', 'prepa', 'shooting', 'trajet', 'edition'];
  const quotas = {};
  cats.forEach(cat => {
    const val  = Number(document.querySelector(`.quota-input[data-cat="${cat}"]`)?.value) || 0;
    const unit = document.querySelector(`.quota-unit[data-cat="${cat}"]`)?.value || 'h';
    quotas[cat] = _quotaToHours(val, unit);
  });

  const totalH = Object.values(quotas).reduce((s, h) => s + h, 0);
  const taux   = totalH > 0 ? Math.round((Number(projet.prixFacture) || 0) / totalH) : null;

  const totEl  = $('quotaTotalVal');
  const valEl  = $('tauxImplVal');
  const cardEl = $('tauxImplCard');
  if (totEl)  totEl.textContent = _fmtH(totalH);
  if (valEl)  valEl.textContent = taux !== null ? `CHF ${taux}/h` : '—';
  if (cardEl) cardEl.className  = `taux-impl ${taux !== null ? _tauxImplClass(taux) : ''}`;

  // Auto-save
  const idx = state.projets.findIndex(p => p.id === projet.id);
  if (idx !== -1) {
    state.projets[idx].quotas = quotas;
    save.projets();
  }
}

// ─── Sous-vues stub (Phases 6–7) ─────────────────────

// ════════════════════════════════════════════════════════
// SOUS-VUE TEMPS — Phase 6
// ════════════════════════════════════════════════════════

function _subviewTemps(projet) {
  return `
    <div class="temps-view">

      <!-- Chrono -->
      <div class="glass-card chrono-card">
        <p class="chrono-status" id="chronoStatus">Prêt</p>
        <p class="chrono-display" id="chronoDisplay">00:00:00</p>
        <p class="chrono-sub" id="chronoSub"></p>
      </div>

      <!-- Chips catégories -->
      <div class="cat-chips-scroll" id="catChips">
        ${_renderCatChips(_timerCat)}
      </div>

      <!-- Boutons -->
      <div class="chrono-actions">
        <button class="btn-action" id="btnToggleChrono" type="button">
          Démarrer
        </button>
        <button class="btn-secondary" id="btnManuelTime" type="button">
          ${_ico_clock_plus()}
          Manuel
        </button>
      </div>

      <!-- Stats -->
      <div class="chrono-stats">
        <div class="glass-card stat-mini">
          <p class="stat-mini-label">Effectif</p>
          <p class="stat-mini-val" id="statEffectif">${_statEffectif(projet)}</p>
        </div>
        <div class="glass-card stat-mini">
          <p class="stat-mini-label">Quota</p>
          <p class="stat-mini-val" id="statQuota">${_statQuota(projet)}</p>
        </div>
        <div class="glass-card stat-mini">
          <p class="stat-mini-label">CHF/h réel</p>
          <p class="stat-mini-val ${_tauxReelClass(projet)}" id="statTaux">${_statTauxReel(projet)}</p>
        </div>
      </div>

      <!-- Sessions -->
      <div class="sessions-section">
        <div class="sessions-head">
          <p class="sessions-title">Sessions</p>
          ${(projet.sessions ?? []).length > 0
            ? `<button class="btn-text-danger" id="btnClearSessions">Tout effacer</button>`
            : ''}
        </div>
        <div id="sessionsList">
          ${_renderSessionsList(projet)}
        </div>
      </div>

    </div>`;
}

function _wireTemps(projet) {
  _wireCatChips(projet);

  $('btnToggleChrono')?.addEventListener('click', () => {
    if (_timerInterval) _stopChrono(projet);
    else                _startChrono();
  });

  $('btnManuelTime')?.addEventListener('click', () => _openManualTimeSheet(projet));

  $('btnClearSessions')?.addEventListener('click', () => {
    if (confirm('Effacer toutes les sessions de ce projet ?')) {
      const idx = state.projets.findIndex(p => p.id === projet.id);
      if (idx !== -1) {
        state.projets[idx].sessions = [];
        save.projets();
        _refreshTempsDisplay(state.projets[idx]);
      }
    }
  });

  _wireSessionDeletes(projet);

  // Restaurer l'état si le chrono tourne déjà
  if (_timerInterval) {
    const btn = $('btnToggleChrono');
    if (btn) btn.textContent = 'Arrêter';
    _updateChronoStatus();
    _tickTimer();
  }
}

function _wireCatChips(projet) {
  document.querySelectorAll('.cat-chip').forEach(chip =>
    chip.addEventListener('click', e => {
      const cat = e.currentTarget.dataset.cat;
      _timerCat = cat;
      const el = $('catChips');
      if (el) {
        el.innerHTML = _renderCatChips(cat);
        _wireCatChips(projet);
      }
      if (_timerInterval) _updateChronoStatus();
    })
  );
}

function _renderCatChips(activeCat) {
  return Object.entries(CATEGORIES).map(([key, cat]) => `
    <button
      class="cat-chip${activeCat === key ? ' is-active' : ''}"
      data-cat="${key}"
      style="${activeCat === key
        ? `background:${cat.color};border-color:${cat.color};`
        : `background:${cat.bg};border-color:${cat.color}44;`}"
      type="button">
      ${cat.label}
    </button>`).join('');
}

function _startChrono() {
  _timerStart    = Date.now() - (_timerSeconds * 1000);
  _timerInterval = setInterval(_tickTimer, 1000);
  const btn = $('btnToggleChrono');
  if (btn) btn.textContent = 'Arrêter';
  _updateChronoStatus();
}

function _stopChrono(projet) {
  clearInterval(_timerInterval);
  _timerInterval = null;

  const dureeMin = Math.max(1, Math.round(_timerSeconds / 60));
  const session  = {
    id:        _genId(),
    categorie: _timerCat,
    duree:     dureeMin,
    date:      new Date().toISOString(),
    type:      'chrono',
  };

  const idx = state.projets.findIndex(p => p.id === projet.id);
  if (idx !== -1) {
    state.projets[idx].sessions.push(session);
    save.projets();
  }

  _timerSeconds = 0;
  _timerStart   = null;

  const btn      = $('btnToggleChrono');
  const statusEl = $('chronoStatus');
  const displayEl= $('chronoDisplay');
  const subEl    = $('chronoSub');
  if (btn)      btn.textContent      = 'Démarrer';
  if (displayEl)displayEl.textContent= '00:00:00';
  if (subEl)    subEl.textContent    = '';
  if (statusEl) {
    statusEl.textContent = 'Prêt';
    statusEl.classList.remove('is-active');
    statusEl.style.color = '';
  }

  if (idx !== -1) _refreshTempsDisplay(state.projets[idx]);
}

function _tickTimer() {
  _timerSeconds = Math.floor((Date.now() - _timerStart) / 1000);
  const h = Math.floor(_timerSeconds / 3600);
  const m = Math.floor((_timerSeconds % 3600) / 60);
  const s = _timerSeconds % 60;
  const el = $('chronoDisplay');
  if (el) el.textContent = [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

function _updateChronoStatus() {
  const cat      = CATEGORIES[_timerCat] ?? { label: _timerCat, color: '#D4700A' };
  const statusEl = $('chronoStatus');
  const subEl    = $('chronoSub');
  if (statusEl) {
    statusEl.textContent = `● ${cat.label} EN COURS`;
    statusEl.classList.add('is-active');
    statusEl.style.color = cat.color;
  }
  if (subEl) subEl.textContent = 'Session en cours…';
}

function _refreshTempsDisplay(projet) {
  const el = $('sessionsList');
  if (el) {
    el.innerHTML = _renderSessionsList(projet);
    _wireSessionDeletes(projet);
  }
  if ($('statEffectif')) $('statEffectif').textContent = _statEffectif(projet);
  if ($('statQuota'))    $('statQuota').textContent    = _statQuota(projet);
  const tauxEl = $('statTaux');
  if (tauxEl) {
    tauxEl.textContent = _statTauxReel(projet);
    tauxEl.className   = `stat-mini-val ${_tauxReelClass(projet)}`;
  }
  // Bouton "Tout effacer" — apparaît/disparaît selon présence de sessions
  const head = document.querySelector('.sessions-head');
  if (head) {
    const existing = $('btnClearSessions');
    if ((projet.sessions ?? []).length > 0 && !existing) {
      const btn = document.createElement('button');
      btn.className   = 'btn-text-danger';
      btn.id          = 'btnClearSessions';
      btn.textContent = 'Tout effacer';
      btn.addEventListener('click', () => {
        if (confirm('Effacer toutes les sessions de ce projet ?')) {
          const idx = state.projets.findIndex(p => p.id === projet.id);
          if (idx !== -1) {
            state.projets[idx].sessions = [];
            save.projets();
            _refreshTempsDisplay(state.projets[idx]);
          }
        }
      });
      head.appendChild(btn);
    } else if ((projet.sessions ?? []).length === 0 && existing) {
      existing.remove();
    }
  }
}

function _wireSessionDeletes(projet) {
  document.querySelectorAll('.session-delete').forEach(btn =>
    btn.addEventListener('click', e => {
      const id  = e.currentTarget.dataset.sessionId;
      const idx = state.projets.findIndex(p => p.id === projet.id);
      if (idx !== -1) {
        state.projets[idx].sessions = state.projets[idx].sessions.filter(s => s.id !== id);
        save.projets();
        _refreshTempsDisplay(state.projets[idx]);
      }
    })
  );
}

function _renderSessionsList(projet) {
  const sessions = [...(projet.sessions ?? [])].reverse();
  if (!sessions.length) {
    return `<p style="font-size:.78rem;color:rgba(30,50,70,.3);padding:10px 0;">
      Aucune session enregistrée.</p>`;
  }
  return sessions.map(s => {
    const cat  = CATEGORIES[s.categorie] ?? { label: s.categorie, color: 'rgba(30,50,70,.4)' };
    const date = new Date(s.date).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' });
    return `
      <div class="session-row">
        <div class="session-dot" style="background:${cat.color}"></div>
        <div class="session-info">
          <span class="session-cat">${cat.label}</span>
          <span class="session-date">${date}${s.type === 'manuel' ? ' · Manuel' : ''}</span>
        </div>
        <span class="session-duree">${_fmtDuree(s.duree)}</span>
        <button class="session-delete" data-session-id="${s.id}"
          type="button" aria-label="Supprimer">×</button>
      </div>`;
  }).join('');
}

// ─── Stats Temps ──────────────────────────────────────

function _statEffectif(projet) {
  const total = (projet.sessions ?? []).reduce((s, x) => s + (Number(x.duree) || 0), 0);
  return _fmtDuree(total);
}

function _statQuota(projet) {
  const h = _totalQuotaH(projet);
  return h > 0 ? _fmtDuree(Math.round(h * 60)) : '—';
}

function _statTauxReel(projet) {
  const totalMin = (projet.sessions ?? []).reduce((s, x) => s + (Number(x.duree) || 0), 0);
  if (totalMin < 1 || !projet.prixFacture) return '—';
  return Math.round(Number(projet.prixFacture) / (totalMin / 60)) + ' CHF/h';
}

function _tauxReelClass(projet) {
  const totalMin = (projet.sessions ?? []).reduce((s, x) => s + (Number(x.duree) || 0), 0);
  if (totalMin < 1 || !hasTaux()) return '';
  const taux = Math.round(Number(projet.prixFacture) / (totalMin / 60));
  const { tauxPlancher, tauxCible } = state.user;
  if (taux >= tauxCible)    return 'is-good';
  if (taux >= tauxPlancher) return 'is-warn';
  return 'is-bad';
}

function _fmtDuree(min) {
  if (!min || min <= 0) return '0 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

// ─── Bottom sheet — ajout manuel ─────────────────────

function _openManualTimeSheet(projet) {
  if (document.querySelector('.bottom-sheet')) return;

  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  overlay.id = 'sheetOverlay';
  overlay.addEventListener('click', _closeSheet);

  const sheet = document.createElement('div');
  sheet.className = 'bottom-sheet';
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <h2 class="sheet-title">Ajout manuel</h2>
      <button class="icon-button" id="closeManualSheet" type="button" aria-label="Fermer">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <div class="sheet-form">
      <label for="mtCat">
        Catégorie
        <select id="mtCat">
          ${Object.entries(CATEGORIES).map(([k, v]) =>
            `<option value="${k}"${k === _timerCat ? ' selected' : ''}>${v.label}</option>`
          ).join('')}
        </select>
      </label>
      <div class="form-row">
        <label for="mtDuree">
          Durée
          <input id="mtDuree" type="number" min="1" step="1"
            value="30" inputmode="numeric" />
        </label>
        <label for="mtUnite">
          Unité
          <select id="mtUnite">
            <option value="min">minutes</option>
            <option value="h">heures</option>
            <option value="j">jours</option>
          </select>
        </label>
      </div>
      <button class="btn-action sheet-submit" id="btnAddManual" type="button">
        Ajouter
      </button>
    </div>`;

  document.body.appendChild(overlay);
  document.body.appendChild(sheet);

  sheet.querySelector('#closeManualSheet').addEventListener('click', _closeSheet);

  sheet.querySelector('#btnAddManual').addEventListener('click', () => {
    const cat   = $('mtCat')?.value   ?? 'shooting';
    const val   = Number($('mtDuree')?.value) || 30;
    const unite = $('mtUnite')?.value ?? 'min';
    let minutes;
    if (unite === 'h') minutes = Math.round(val * 60);
    else if (unite === 'j') minutes = Math.round(val * 480);
    else minutes = Math.round(val);
    if (minutes < 1) minutes = 1;

    const session = {
      id:        _genId(),
      categorie: cat,
      duree:     minutes,
      date:      new Date().toISOString(),
      type:      'manuel',
    };

    const idx = state.projets.findIndex(p => p.id === projet.id);
    if (idx !== -1) {
      state.projets[idx].sessions.push(session);
      save.projets();
      _closeSheet();
      setTimeout(() => _refreshTempsDisplay(state.projets[idx]), 360);
    } else {
      _closeSheet();
    }
  });

  requestAnimationFrame(() => {
    overlay.classList.add('is-visible');
    sheet.classList.add('is-open');
  });

  setTimeout(() => $('mtDuree')?.focus(), 340);
}

// ════════════════════════════════════════════════════════
// SOUS-VUE FRAIS — Phase 7
// ════════════════════════════════════════════════════════

function _subviewFrais(projet) {
  const frais = projet.frais ?? [];
  const total = frais.reduce((s, f) => s + (Number(f.montant) || 0), 0);

  const listHTML = frais.length
    ? `<div class="frais-list">
        ${[...frais].reverse().map(f => {
          const d = new Date(f.date).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' });
          return `
            <div class="frais-row">
              <div class="frais-info">
                <div class="frais-label">${_esc(f.label)}</div>
                <div class="frais-date">${d}</div>
              </div>
              <span class="frais-montant">${_fmtCHF(f.montant)}</span>
              <button class="frais-delete" data-frais-id="${f.id}"
                type="button" aria-label="Supprimer">×</button>
            </div>`;
        }).join('')}
      </div>`
    : `<div class="frais-empty">Aucun frais enregistré.</div>`;

  return `
    <div class="frais-view">

      <!-- Carte total -->
      <div class="glass-card frais-total-card">
        <p class="frais-total-label">Total frais</p>
        <p class="frais-total-value">${total > 0 ? _fmtCHF(total) : '—'}</p>
      </div>

      <!-- Liste -->
      <div class="glass-card" id="fraisList">
        ${listHTML}
      </div>

      <!-- CTA -->
      <button class="btn-action" id="btnAddFrais" type="button">
        + Ajouter un frais
      </button>

    </div>`;
}

function _wireFrais(projet) {
  $('btnAddFrais')?.addEventListener('click', () => _openFraisSheet(projet));
  _wireFraisDeletes(projet);
}

function _wireFraisDeletes(projet) {
  document.querySelectorAll('.frais-delete').forEach(btn =>
    btn.addEventListener('click', e => {
      const id  = e.currentTarget.dataset.fraisId;
      const idx = state.projets.findIndex(p => p.id === projet.id);
      if (idx !== -1) {
        state.projets[idx].frais = state.projets[idx].frais.filter(f => f.id !== id);
        save.projets();
        _refreshFraisDisplay(state.projets[idx]);
      }
    })
  );
}

function _refreshFraisDisplay(projet) {
  const subViewEl = $('projetSubView');
  if (!subViewEl) return;
  subViewEl.innerHTML = _subviewFrais(projet);
  _wireFrais(projet);
}

function _openFraisSheet(projet) {
  if (document.querySelector('.bottom-sheet')) return;

  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  overlay.id = 'sheetOverlay';
  overlay.addEventListener('click', _closeSheet);

  const sheet = document.createElement('div');
  sheet.className = 'bottom-sheet';
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <h2 class="sheet-title">Ajouter un frais</h2>
      <button class="icon-button" id="closeFraisSheet" type="button" aria-label="Fermer">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <div class="sheet-form">
      <label for="fraisLabelInput">
        Description
        <input id="fraisLabelInput" type="text"
          placeholder="Ex. Location véhicule"
          autocapitalize="sentences" autocomplete="off" />
      </label>
      <label for="fraisMontantInput">
        Montant (CHF)
        <input id="fraisMontantInput" type="number"
          min="0" step="0.01" placeholder="0.00"
          inputmode="decimal" />
      </label>
      <button class="btn-action sheet-submit" id="btnSaveFrais" type="button">
        Ajouter
      </button>
    </div>`;

  document.body.appendChild(overlay);
  document.body.appendChild(sheet);

  sheet.querySelector('#closeFraisSheet').addEventListener('click', _closeSheet);

  sheet.querySelector('#btnSaveFrais').addEventListener('click', () => {
    const label   = $('fraisLabelInput')?.value.trim() ?? '';
    const montant = Number($('fraisMontantInput')?.value) || 0;
    if (!label)      { $('fraisLabelInput')?.focus();   return; }
    if (montant <= 0) { $('fraisMontantInput')?.focus(); return; }

    const fraisEntry = {
      id:      _genId(),
      label,
      montant,
      date:    new Date().toISOString(),
    };

    const idx = state.projets.findIndex(p => p.id === projet.id);
    if (idx !== -1) {
      state.projets[idx].frais.push(fraisEntry);
      save.projets();
      _closeSheet();
      setTimeout(() => _refreshFraisDisplay(state.projets[idx]), 360);
    } else {
      _closeSheet();
    }
  });

  requestAnimationFrame(() => {
    overlay.classList.add('is-visible');
    sheet.classList.add('is-open');
  });

  setTimeout(() => $('fraisLabelInput')?.focus(), 340);
}

// ════════════════════════════════════════════════════════
// SOUS-VUE BILAN — Phase 7
// ════════════════════════════════════════════════════════

function _subviewBilan(projet) {
  // ── Données brutes ──
  const prixFacture  = Number(projet.prixFacture) || 0;
  const totalFrais   = (projet.frais ?? []).reduce((s, f) => s + (Number(f.montant) || 0), 0);
  const revenuNet    = prixFacture - totalFrais;

  const totalMin     = (projet.sessions ?? []).reduce((s, x) => s + (Number(x.duree) || 0), 0);
  const heuresEff    = totalMin / 60;
  const tauxReel     = heuresEff > 0 && prixFacture > 0
    ? Math.round(prixFacture / heuresEff)
    : null;

  const totalQuotaH  = _totalQuotaH(projet);
  const tauxOffre    = totalQuotaH > 0 && prixFacture > 0
    ? Math.round(prixFacture / totalQuotaH)
    : null;

  // ── Calcul de la classe (profit / warn / loss / neutral) ──
  function _cls(taux) {
    if (taux === null || !hasTaux()) return 'is-neutral';
    const { tauxPlancher, tauxCible } = state.user;
    if (taux >= tauxCible)    return 'is-profit';
    if (taux >= tauxPlancher) return 'is-warn';
    return 'is-loss';
  }

  // Référence : taux réel s'il existe, sinon taux offre
  const refTaux  = tauxReel ?? tauxOffre;
  const clsBilan = _cls(refTaux);

  // Barre de performance (% du taux cible, plafonnée à 100%)
  let barPct = 0;
  if (refTaux !== null && hasTaux() && state.user.tauxCible > 0) {
    barPct = Math.min(100, Math.round((refTaux / state.user.tauxCible) * 100));
  }

  // Verdict
  const verdicts = {
    'is-profit':  { icon: '✓', text: 'Projet rentable'      },
    'is-warn':    { icon: '≈', text: 'Marge serrée'          },
    'is-loss':    { icon: '↓', text: 'Sous le plancher'      },
    'is-neutral': { icon: '○', text: 'Données incomplètes'   },
  };
  const v = verdicts[clsBilan];

  // Classe de la valeur revenu net
  const clsNet = prixFacture <= 0 ? 'is-neutral'
    : revenuNet < 0 ? 'is-loss'
    : 'is-profit';

  return `
    <div class="bilan-view">

      <!-- ── CA & frais ── -->
      <div class="glass-card bilan-section">
        <p class="bilan-section-title">Chiffre d'affaires</p>
        <div class="bilan-row">
          <span class="bilan-row-label">Prix facturé</span>
          <span class="bilan-row-value">
            ${prixFacture > 0 ? _fmtCHF(prixFacture) : '—'}
          </span>
        </div>
        <div class="bilan-row">
          <span class="bilan-row-label">Total frais</span>
          <span class="bilan-row-value ${totalFrais > 0 ? 'is-loss' : 'is-neutral'}">
            ${totalFrais > 0 ? _fmtCHF(totalFrais) : '—'}
          </span>
        </div>
        <div class="bilan-divider"></div>
        <div class="bilan-row is-total">
          <span class="bilan-row-label">Revenu net</span>
          <span class="bilan-row-value ${clsNet}">
            ${prixFacture > 0 ? _fmtCHF(revenuNet) : '—'}
          </span>
        </div>
      </div>

      <!-- ── Temps ── -->
      <div class="glass-card bilan-section">
        <p class="bilan-section-title">Temps</p>
        <div class="bilan-row">
          <span class="bilan-row-label">Effectif (sessions)</span>
          <span class="bilan-row-value">
            ${heuresEff > 0 ? _fmtDuree(totalMin) : '—'}
          </span>
        </div>
        <div class="bilan-row">
          <span class="bilan-row-label">Quota offre</span>
          <span class="bilan-row-value">
            ${totalQuotaH > 0 ? _fmtH(totalQuotaH) : '—'}
          </span>
        </div>
      </div>

      <!-- ── Taux horaire ── -->
      <div class="glass-card bilan-section">
        <p class="bilan-section-title">Taux horaire</p>
        <div class="bilan-row">
          <span class="bilan-row-label">Taux offre (quotas)</span>
          <span class="bilan-row-value">
            ${tauxOffre !== null ? tauxOffre + ' CHF/h' : '—'}
          </span>
        </div>
        <div class="bilan-row">
          <span class="bilan-row-label">Taux réel (sessions)</span>
          <span class="bilan-row-value ${_cls(tauxReel)}">
            ${tauxReel !== null ? tauxReel + ' CHF/h' : '—'}
          </span>
        </div>
        ${hasTaux() ? `
        <div class="bilan-divider"></div>
        <div class="bilan-row">
          <span class="bilan-row-label">Plancher</span>
          <span class="bilan-row-value is-neutral">${state.user.tauxPlancher} CHF/h</span>
        </div>
        <div class="bilan-row">
          <span class="bilan-row-label">Cible</span>
          <span class="bilan-row-value is-profit">${state.user.tauxCible} CHF/h</span>
        </div>` : ''}
        ${barPct > 0 ? `
        <div class="bilan-bar-wrap">
          <div class="bilan-bar-fill ${clsBilan}" style="width:${barPct}%"></div>
        </div>` : ''}
      </div>

      <!-- ── Verdict ── -->
      <div class="glass-card bilan-verdict">
        <p class="bilan-verdict-label">Verdict</p>
        <div class="bilan-verdict-icon ${clsBilan}">${v.icon}</div>
        <p class="bilan-verdict-text ${clsBilan}">${v.text}</p>
      </div>

    </div>`;
}

// ─── Helpers Projet ───────────────────────────────────

function _totalQuotaH(projet) {
  return Object.values(projet.quotas || {})
    .reduce((s, h) => s + (Number(h) || 0), 0);
}

function _calcTauxImplicite(projet, totalH) {
  const h = totalH ?? _totalQuotaH(projet);
  if (!h) return null;
  return Math.round((Number(projet.prixFacture) || 0) / h);
}

function _quotaToHours(value, unit) {
  if (unit === 'min') return value / 60;
  if (unit === 'j')   return value * 8;
  return value;
}

function _tauxImplClass(taux) {
  if (!hasTaux()) return '';
  const { tauxPlancher, tauxCible } = state.user;
  if (taux >= tauxCible)    return 'is-profit';
  if (taux >= tauxPlancher) return 'is-warning';
  return 'is-loss';
}

function _fmtH(h) {
  if (!h || h <= 0) return '0h';
  return (Math.round(h * 10) / 10) + 'h';
}

// ════════════════════════════════════════════════════════
// MATÉRIEL / CHECKLIST — logique profil-driven
// ════════════════════════════════════════════════════════

/**
 * Génère le HTML de la section matériel dans Offre.
 * Sources : user.materiel (actif) + projet.checklist items custom.
 * L'état checked est lu depuis projet.checklist par id.
 */
function _renderChecklistSection(projet) {
  const materiel = (state.user?.materiel ?? []).filter(m => m.actif !== false);
  const customItems = (projet.checklist ?? []).filter(c => c.isCustom);

  const noMateriel = materiel.length === 0 && customItems.length === 0;

  const profilRows = materiel.map(m => {
    const entry   = (projet.checklist ?? []).find(c => c.id === m.id);
    const checked = entry?.checked ?? false;
    return `
      <li class="checklist-item${checked ? ' is-checked' : ''}">
        <label class="checklist-label">
          <input type="checkbox" class="checklist-cb"
            data-item-id="${m.id}"
            data-item-label="${_esc(m.label)}"
            data-is-custom="false"
            ${checked ? 'checked' : ''} />
          <span>${_esc(m.label)}</span>
        </label>
      </li>`;
  }).join('');

  const customRows = customItems.map(c => `
    <li class="checklist-item${c.checked ? ' is-checked' : ''}">
      <label class="checklist-label">
        <input type="checkbox" class="checklist-cb"
          data-item-id="${c.id}"
          data-item-label="${_esc(c.label)}"
          data-is-custom="true"
          ${c.checked ? 'checked' : ''} />
        <span>${_esc(c.label)}</span>
      </label>
      <button class="checklist-delete" data-item-id="${c.id}"
        type="button" aria-label="Supprimer">×</button>
    </li>`).join('');

  return `
    ${noMateriel ? `
      <p class="materiel-empty-hint">
        Aucun matériel dans ton profil.
        <button class="btn-link-profil" id="btnGoToProfil" type="button">Ajouter dans Profil →</button>
      </p>` : `
      <ul class="checklist">
        ${profilRows}
        ${customRows}
      </ul>`}
    <div class="checklist-add-row">
      <input id="checklistNewItem" class="checklist-add-input"
        type="text" placeholder="Ajouter pour ce projet…"
        autocapitalize="sentences" autocomplete="off" />
      <button class="checklist-add-btn" id="btnAddChecklistItem" type="button"
        aria-label="Ajouter">+</button>
    </div>`;
}

function _wireChecklistSection(projet) {
  // Toggles checkboxes — upsert dans projet.checklist
  document.querySelectorAll('.checklist-cb').forEach(cb =>
    cb.addEventListener('change', e => {
      const id       = e.target.dataset.itemId;
      const label    = e.target.dataset.itemLabel ?? '';
      const isCustom = e.target.dataset.isCustom === 'true';
      const checked  = e.target.checked;
      e.target.closest('.checklist-item')?.classList.toggle('is-checked', checked);
      const idx = state.projets.findIndex(p => p.id === projet.id);
      if (idx !== -1) {
        const i = state.projets[idx].checklist.findIndex(x => x.id === id);
        if (i !== -1) {
          state.projets[idx].checklist[i].checked = checked;
        } else {
          state.projets[idx].checklist.push({ id, label, checked, isCustom });
        }
        save.projets();
      }
    })
  );

  // Supprimer item custom
  document.querySelectorAll('.checklist-delete').forEach(btn =>
    btn.addEventListener('click', e => {
      const id  = e.currentTarget.dataset.itemId;
      const idx = state.projets.findIndex(p => p.id === projet.id);
      if (idx !== -1) {
        state.projets[idx].checklist = state.projets[idx].checklist.filter(c => c.id !== id);
        save.projets();
        // Refresh uniquement la section checklist
        const section = document.querySelector('.offre-section .checklist')?.closest('.offre-section')
          ?? document.querySelector('.offre-section:has(.checklist-add-row)');
        _refreshChecklistSection(state.projets[idx]);
      }
    })
  );

  // Ajouter item custom
  const addFn = () => _addCustomChecklistItem(projet);
  $('btnAddChecklistItem')?.addEventListener('click', addFn);
  $('checklistNewItem')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addFn(); }
  });
}

function _addCustomChecklistItem(projet) {
  const input = $('checklistNewItem');
  const label = input?.value.trim();
  if (!label) { input?.focus(); return; }

  const item = { id: _genId(), label, checked: false, isCustom: true };
  const idx  = state.projets.findIndex(p => p.id === projet.id);
  if (idx !== -1) {
    state.projets[idx].checklist.push(item);
    save.projets();
    _refreshChecklistSection(state.projets[idx]);
  }
  if (input) input.value = '';
}

function _refreshChecklistSection(projet) {
  // Re-render uniquement le contenu de la card matériel (sans toucher aux quotas)
  const card = document.querySelector('.offre-section.glass-card:has(.checklist-add-row)')
    ?? document.querySelector('.offre-section.glass-card:last-of-type');
  if (!card) { _refreshProjetSubView(); return; }
  const title = card.querySelector('.offre-section-title');
  // Garde le titre, remplace le reste
  card.innerHTML = `<p class="offre-section-title">Matériel</p>${_renderChecklistSection(projet)}`;
  _wireChecklistSection(projet);
  $('btnGoToProfil')?.addEventListener('click', () => navigateTo('profil'));
}

// _ensureChecklist supprimé — remplacé par la logique matériel profil (Phase 4)

function _ico_folder_lg() {
  return `<svg class="empty-icon" width="52" height="52" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.3"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>`;
}

function _viewInsights() {
  return `
    <div class="empty-state" style="margin:32px 16px;min-height:200px;">
      <p style="font-size:.8rem;color:rgba(30,50,70,.3);">Module Insights — Phase 8</p>
    </div>`;
}

function _viewProfil() {
  const u = state.user ?? {};

  const specialites = [
    ['mariage',   'Mariage'],
    ['corporate', 'Corporate'],
    ['evenement', 'Événement'],
    ['packshot',  'Packshot'],
    ['editorial', 'Éditorial'],
    ['mixed',     'Mixed'],
  ];

  return `
    <div class="profil-view">

      <!-- ── Moi ── -->
      <div class="profil-section glass-card">
        <p class="profil-section-title">Moi</p>
        <label for="pfPrenom">
          Prénom
          <input id="pfPrenom" type="text"
            placeholder="Ton prénom"
            value="${_esc(u.prenom ?? '')}"
            autocomplete="given-name" />
        </label>
        <label for="pfSpecialite">
          Spécialité
          <select id="pfSpecialite">
            <option value="">— Sélectionner —</option>
            ${specialites.map(([v, l]) =>
              `<option value="${v}"${u.specialite === v ? ' selected' : ''}>${l}</option>`
            ).join('')}
          </select>
        </label>
      </div>

      <!-- ── Objectifs financiers ── -->
      <div class="profil-section glass-card">
        <p class="profil-section-title">Objectifs financiers</p>
        <label for="pfRevenu">
          Revenu mensuel net visé (CHF)
          <input id="pfRevenu" type="number"
            placeholder="0" min="0" step="100"
            inputmode="numeric"
            value="${u.revenuCible ?? ''}" />
        </label>
        <div class="form-row">
          <label for="pfJours">
            Jours fact. / mois
            <input id="pfJours" type="number"
              placeholder="15" min="1" max="23" step="1"
              inputmode="numeric"
              value="${u.joursFact ?? 15}" />
          </label>
          <label for="pfCharges">
            Charges / mois (CHF)
            <input id="pfCharges" type="number"
              placeholder="0" min="0" step="50"
              inputmode="numeric"
              value="${u.charges ?? ''}" />
          </label>
        </div>
        <div class="taux-preview" id="tauxPreview">
          <div class="taux-preview-item">
            <p class="taux-preview-label">Plancher</p>
            <p class="taux-preview-value" id="pfPlancherVal">—</p>
          </div>
          <div class="taux-preview-sep"></div>
          <div class="taux-preview-item">
            <p class="taux-preview-label">Cible</p>
            <p class="taux-preview-value is-cible" id="pfCibleVal">—</p>
          </div>
        </div>
      </div>

      <!-- ── Enregistrer ── -->
      <button class="btn-action" id="btnSaveProfil" type="button">
        Enregistrer
      </button>

      <!-- ── Mon matériel ── -->
      <div class="profil-section glass-card">
        <p class="profil-section-title">Mon matériel habituel</p>
        <p class="profil-section-hint" style="margin:0 0 4px;">
          Affiché dans la checklist de chaque projet.
        </p>
        <ul class="materiel-list" id="materielList">
          ${_renderMaterielList()}
        </ul>
        <div class="materiel-add-row">
          <input id="materielNewItem" class="materiel-add-input"
            type="text" placeholder="Ex. Boîtier Sony A7 IV"
            autocapitalize="sentences" autocomplete="off" />
          <button class="checklist-add-btn" id="btnAddMateriel"
            type="button" aria-label="Ajouter">+</button>
        </div>
      </div>

      <!-- ── Données ── -->
      <div class="profil-section glass-card">
        <p class="profil-section-title">Données</p>
        <p class="profil-section-hint">
          Efface tous tes projets, contacts et réglages.
        </p>
        <button class="btn-destructive" id="btnResetFrames" type="button">
          Réinitialiser Frames
        </button>
      </div>

    </div>`;
}

// ─── Profil : matériel ────────────────────────────────

function _renderMaterielList() {
  const items = (state.user?.materiel ?? []).filter(m => m.actif !== false);
  if (!items.length) {
    return `<li class="materiel-item-empty">Aucun item — ajoute ci-dessous.</li>`;
  }
  return items.map(m => `
    <li class="materiel-item">
      <span class="materiel-label">${_esc(m.label)}</span>
      <button class="materiel-delete" data-materiel-id="${m.id}"
        type="button" aria-label="Supprimer">×</button>
    </li>`).join('');
}

function _addMaterielItem() {
  const input = $('materielNewItem');
  const label = input?.value.trim();
  if (!label) { input?.focus(); return; }

  if (!state.user) state.user = {};
  if (!state.user.materiel) state.user.materiel = [];

  state.user.materiel.push({ id: _genId(), label, actif: true });
  save.user();

  const el = $('materielList');
  if (el) {
    el.innerHTML = _renderMaterielList();
    _wireMaterielDeletes();
  }
  if (input) input.value = '';
  input?.focus();
}

function _wireMaterielDeletes() {
  document.querySelectorAll('.materiel-delete').forEach(btn =>
    btn.addEventListener('click', e => {
      const id  = e.currentTarget.dataset.materielId;
      if (state.user?.materiel) {
        const idx = state.user.materiel.findIndex(m => m.id === id);
        if (idx !== -1) state.user.materiel[idx].actif = false; // soft delete
        save.user();
        const el = $('materielList');
        if (el) { el.innerHTML = _renderMaterielList(); _wireMaterielDeletes(); }
      }
    })
  );
}

// ─── Profil : wiring ──────────────────────────────────

function _wireProfilView() {
  ['pfRevenu', 'pfJours', 'pfCharges'].forEach(id =>
    $(id)?.addEventListener('input', _updateTauxPreview)
  );
  _updateTauxPreview();

  $('btnSaveProfil')?.addEventListener('click', _saveProfil);

  $('btnResetFrames')?.addEventListener('click', () => {
    if (confirm('Supprimer toutes les données Frames ?\nCette action est irréversible.')) {
      Storage.clearAll();
      location.reload();
    }
  });

  // Matériel — ajouter
  const doAdd = () => _addMaterielItem();
  $('btnAddMateriel')?.addEventListener('click', doAdd);
  $('materielNewItem')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); doAdd(); }
  });

  // Matériel — supprimer
  _wireMaterielDeletes();
}

function _calcTaux(revenu, jours, charges) {
  const j = Number(jours) || 15;
  if (j <= 0) return { plancher: 0, cible: 0 };
  const plancher = Math.round((Number(revenu) + Number(charges)) / (j * 8));
  const cible    = Math.round(plancher * 1.3);
  return { plancher, cible };
}

function _updateTauxPreview() {
  const revenu  = Number($('pfRevenu')?.value)  || 0;
  const jours   = Number($('pfJours')?.value)   || 15;
  const charges = Number($('pfCharges')?.value) || 0;
  const { plancher, cible } = _calcTaux(revenu, jours, charges);
  const pEl = $('pfPlancherVal');
  const cEl = $('pfCibleVal');
  if (pEl) pEl.textContent = plancher > 0 ? `CHF ${plancher}/h` : '—';
  if (cEl) cEl.textContent = cible    > 0 ? `CHF ${cible}/h`    : '—';
}

function _saveProfil() {
  const prenom      = $('pfPrenom')?.value.trim()   ?? '';
  const specialite  = $('pfSpecialite')?.value       ?? '';
  const revenuCible = Number($('pfRevenu')?.value)  || 0;
  const joursFact   = Number($('pfJours')?.value)   || 15;
  const charges     = Number($('pfCharges')?.value) || 0;
  const { plancher, cible } = _calcTaux(revenuCible, joursFact, charges);

  state.user = {
    prenom, specialite, revenuCible, joursFact, charges,
    tauxPlancher: plancher,
    tauxCible:    cible,
    materiel:     state.user?.materiel ?? [], // préservé — géré indépendamment
  };
  save.user();

  const btn = $('btnSaveProfil');
  if (btn) {
    btn.textContent   = 'Sauvegardé ✓';
    btn.disabled      = true;
    btn.style.opacity = '.72';
    setTimeout(() => {
      btn.textContent   = 'Enregistrer';
      btn.disabled      = false;
      btn.style.opacity = '';
    }, 2000);
  }
}

// ════════════════════════════════════════════════════════
// ICÔNES SVG — function declarations pour le hoisting
// ════════════════════════════════════════════════════════

function _ico_camera() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>`;
}

function _ico_camera_lg() {
  return `<svg class="empty-icon" width="52" height="52" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.3"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>`;
}

function _ico_users() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>`;
}

function _ico_folder() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>`;
}

function _ico_chart() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>`;
}

function _ico_user() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>`;
}

function _ico_clock_plus() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 15.5 14"/>
    <line x1="12" y1="19" x2="12" y2="22"/>
    <line x1="10.5" y1="20.5" x2="13.5" y2="20.5"/>
  </svg>`;
}

// ════════════════════════════════════════════════════════
// INIT — ouverture directe sur Studio
// ════════════════════════════════════════════════════════

showShell('studio');
