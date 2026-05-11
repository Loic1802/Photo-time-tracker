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
  currentView: 'studio',
  user:        Storage.get('user')     ?? null,
  contacts:    Storage.get('contacts') ?? [],
  projets:     Storage.get('projets')  ?? [],
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
    case 'projet':      el.innerHTML = _viewProjet();      break;
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
  return `
    <div class="empty-state" style="margin:32px 16px;min-height:200px;">
      <p style="font-size:.8rem;color:rgba(30,50,70,.3);">Module Projet — Phase 5–7</p>
    </div>`;
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
