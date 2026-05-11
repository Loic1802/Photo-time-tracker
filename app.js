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

const CAT_COLORS = {
  admin:    'rgba(30,50,70,0.45)',
  prepa:    '#C09030',
  shooting: '#D4700A',
  trajet:   '#6B8CA8',
  edition:  '#7B5EA7',
};

const CHECKLIST_SUGGESTIONS = {
  mariage:    ['Boîtier principal', 'Boîtier backup', 'Flash speedlite',
               'Objectif 35mm', 'Objectif 85mm', 'Batteries ×4',
               'Cartes mémoire ×6', 'Réflecteur', 'Sac photo'],
  portrait:   ['Boîtier principal', 'Objectif 85mm', 'Réflecteur',
               'Trépied', 'Fond studio', 'Batteries ×2', 'Cartes mémoire'],
  corporate:  ['Boîtier principal', 'Objectif 24-70mm', 'Flash studio',
               'Trépied', 'Fond studio', 'Batteries ×2', 'Cartes mémoire', 'Laptop'],
  event:      ['Boîtier principal', 'Boîtier backup', 'Flash speedlite',
               'Objectif 24-70mm', 'Objectif 70-200mm', 'Batteries ×4', 'Cartes mémoire ×4'],
  commercial: ['Boîtier principal', 'Flash studio', 'Trépied',
               'Fond studio', 'Objectif 24-70mm', 'Laptop', 'Cartes mémoire'],
  autre:      ['Boîtier principal', 'Batteries ×2', 'Cartes mémoire'],
};

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

function _openNewProjectSheet() {
  if ($('newProjectSheet')) return; // déjà ouvert

  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  overlay.id = 'sheetOverlay';
  overlay.addEventListener('click', _closeSheet);

  const sheet = document.createElement('div');
  sheet.className = 'bottom-sheet';
  sheet.id = 'newProjectSheet';
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <h2 class="sheet-title">Nouveau projet</h2>
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
          placeholder="ex. Shooting corporate ACME" autocomplete="off" required />
      </label>
      <label for="nfClient">
        Client
        <input id="nfClient" name="clientNom" type="text"
          placeholder="Nom du client ou de l'entreprise" autocomplete="off" />
      </label>
      <div class="form-row">
        <label for="nfType">
          Type
          <select id="nfType" name="type">
            <option value="corporate">Corporate</option>
            <option value="portrait">Portrait</option>
            <option value="mariage">Mariage</option>
            <option value="event">Événement</option>
            <option value="commercial">Commercial</option>
            <option value="autre">Autre</option>
          </select>
        </label>
        <label for="nfDate">
          Date prévue
          <input id="nfDate" name="datePrevue" type="date" />
        </label>
      </div>
      <label for="nfPrix">
        Prix facturé (CHF)
        <input id="nfPrix" name="prixFacture" type="number"
          placeholder="0" min="0" step="50" inputmode="numeric" />
      </label>
      <button class="btn-action sheet-submit" type="submit">
        Créer le projet
      </button>
    </form>`;

  document.body.appendChild(overlay);
  document.body.appendChild(sheet);

  $('closeSheet').addEventListener('click', _closeSheet);
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
  const sheet   = $('newProjectSheet');
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
  state.activeProjetId = projet.id; // sélectionne le nouveau projet dans le module Projet
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

      <!-- Sélecteur projet -->
      <div class="projet-selector-bar">
        <select id="projetSelectEl">
          ${state.projets.map(p => `
            <option value="${p.id}"${p.id === state.activeProjetId ? ' selected' : ''}>
              ${_esc(p.nom)}${p.clientNom ? ' · ' + _esc(p.clientNom) : ''}
            </option>`).join('')}
        </select>
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

  // Changement de projet sélectionné
  $('projetSelectEl')?.addEventListener('change', e => {
    state.activeProjetId = e.target.value;
    _refreshProjetSubView();
  });

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
  if (sv === 'offre') _wireOffre(projet);
}

// ════════════════════════════════════════════════════════
// SOUS-VUE OFFRE — Phase 5
// ════════════════════════════════════════════════════════

function _subviewOffre(projet) {
  _ensureChecklist(projet);

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
        <ul class="checklist">
          ${projet.checklist.map(item => `
            <li class="checklist-item${item.checked ? ' is-checked' : ''}">
              <label class="checklist-label">
                <input type="checkbox" class="checklist-cb"
                  data-item-id="${item.id}"
                  ${item.checked ? 'checked' : ''} />
                <span>${_esc(item.label)}</span>
              </label>
            </li>`).join('')}
        </ul>
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

  // Checklist — auto-save + toggle visuel
  document.querySelectorAll('.checklist-cb').forEach(cb =>
    cb.addEventListener('change', e => {
      const id      = e.target.dataset.itemId;
      const checked = e.target.checked;
      e.target.closest('.checklist-item')?.classList.toggle('is-checked', checked);
      const idx = state.projets.findIndex(p => p.id === projet.id);
      if (idx !== -1) {
        const i = state.projets[idx].checklist.findIndex(x => x.id === id);
        if (i !== -1) state.projets[idx].checklist[i].checked = checked;
        save.projets();
      }
    })
  );

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

function _subviewTemps(projet) {
  return `<div class="empty-state" style="margin:24px 16px;min-height:160px;">
    <p style="font-size:.8rem;color:rgba(30,50,70,.3);">Chrono &amp; sessions — Phase 6</p>
  </div>`;
}

function _subviewFrais(projet) {
  return `<div class="empty-state" style="margin:24px 16px;min-height:160px;">
    <p style="font-size:.8rem;color:rgba(30,50,70,.3);">Frais — Phase 7</p>
  </div>`;
}

function _subviewBilan(projet) {
  return `<div class="empty-state" style="margin:24px 16px;min-height:160px;">
    <p style="font-size:.8rem;color:rgba(30,50,70,.3);">Bilan — Phase 7</p>
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

function _ensureChecklist(projet) {
  if (projet.checklist.length > 0) return;
  const suggestions = CHECKLIST_SUGGESTIONS[projet.type] ?? CHECKLIST_SUGGESTIONS['autre'];
  projet.checklist = suggestions.map(label => ({ id: _genId(), label, checked: false }));
  const idx = state.projets.findIndex(p => p.id === projet.id);
  if (idx !== -1) {
    state.projets[idx].checklist = projet.checklist;
    save.projets();
  }
}

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

// ════════════════════════════════════════════════════════
// INIT — ouverture directe sur Studio
// ════════════════════════════════════════════════════════

showShell('studio');
