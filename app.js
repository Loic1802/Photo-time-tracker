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
// STATUTS — source de vérité unique pour labels + couleurs
// ════════════════════════════════════════════════════════

const STATUTS = {
  brouillon: { label: 'Brouillon',     color: 'rgba(30,50,70,0.35)', bg: 'rgba(30,50,70,0.07)'   },
  avenir:    { label: 'À venir',       color: '#3A7ABF',             bg: 'rgba(58,122,191,0.12)' },
  encours:   { label: 'En cours',      color: '#2E7D52',             bg: 'rgba(46,125,82,0.12)'  },
  atraiter:  { label: 'À traiter',     color: '#B8600A',             bg: 'rgba(213,112,10,0.13)' },
  termine:   { label: 'Terminé',       color: '#2E7D52',             bg: 'rgba(46,125,82,0.13)'  },
  sanssuite: { label: 'Sans suite',    color: 'rgba(30,50,70,0.25)', bg: 'rgba(30,50,70,0.05)'   },
  // conservé pour données existantes ayant 'attente'
  attente:   { label: 'Offre envoyée', color: '#B8600A',             bg: 'rgba(213,112,10,0.12)' },
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
  projetSubView:  'preparer', // sous-onglet actif
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
let _tickBarCounter  = 0;        // met à jour les quota bars toutes les 5s
let _editingProjetId = null;     // null = création, string = édition du projet correspondant
let _profilMode      = 'simple'; // 'simple' | 'avance' — mode objectifs financiers

// ════════════════════════════════════════════════════════
// SHELL — navigation + topbar
// ════════════════════════════════════════════════════════

const TABS = [
  { id: 'studio',      label: 'Studio',   icon: _ico_folder()  },
  { id: 'prospection', label: 'Contacts', icon: _ico_users()   },
  { id: 'projet',      label: 'Projets',  icon: _ico_camera()  },
  { id: 'insights',    label: 'Analyse',  icon: _ico_chart()   },
  { id: 'profil',      label: 'Moi',      icon: _ico_user()    },
];

// ════════════════════════════════════════════════════════
// MIGRATION — montée de version des données localStorage
// ════════════════════════════════════════════════════════

function _migrateProjects() {
  let changed = false;
  state.projets.forEach((p, i) => {
    // v1→v2 : datePrevue → dateShooting
    if (p.dateShooting === undefined) {
      state.projets[i].dateShooting = p.dateShooting ?? null;
      changed = true;
    }
    // v1→v2 : feuilleRoute absent
    if (!state.projets[i].feuilleRoute) {
      state.projets[i].feuilleRoute = { contact: '', lieu: '', notes: '', shots: [] };
      changed = true;
    }
    // v1→v2 : revisions absent dans quotas
    if (state.projets[i].quotas && state.projets[i].quotas.revisions === undefined) {
      state.projets[i].quotas.revisions = 0;
      changed = true;
    }
  });
  if (changed) save.projets();

  // Re-calculer les statuts auto après migration (sans écraser termine/sanssuite)
  state.projets.forEach((_, i) => _autoStatut(i));
}

function showShell(view = 'studio') {
  _migrateProjects();
  _renderTabBar();
  _injectFAB();
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

  // FAB : masqué sur Profil uniquement
  const fab = $('fabGlobal');
  if (fab) fab.style.display = view === 'profil' ? 'none' : '';

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
  if (view === 'prospection') fresh.addEventListener('click', () => _openContactSheet());
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
    case 'prospection':
      el.innerHTML = _viewProspection();
      _wireProspection();
      break;
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

  // ── Hero card — projet urgent (encours = today, ou atraiter = passé non clôturé) ──
  const enCours = state.projets.find(p => p.statut === 'encours' || p.statut === 'atraiter');
  const heroHtml = enCours ? (() => {
    const tauxAff = (() => {
      const min = (enCours.sessions ?? []).reduce((s, x) => s + (Number(x.duree) || 0), 0);
      if (min > 0 && Number(enCours.prixFacture) > 0)
        return Math.round(Number(enCours.prixFacture) / (min / 60)) + ' CHF/h réel';
      const qH = _totalQuotaH(enCours);
      if (qH > 0 && Number(enCours.prixFacture) > 0)
        return Math.round(Number(enCours.prixFacture) / qH) + ' CHF/h (offre)';
      return '';
    })();
    const date = enCours.dateShooting
      ? new Date(enCours.dateShooting).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })
      : '';
    return `
    <div class="studio-hero-card glass-card" data-hero-id="${enCours.id}" role="button" tabindex="0">
      <p class="hero-eyebrow" style="color:${enCours.statut === 'atraiter' ? '#B8600A' : 'inherit'}">${enCours.statut === 'atraiter' ? 'À traiter' : 'En cours'}</p>
      <p class="hero-nom">${_esc(enCours.nom)}</p>
      <div class="hero-meta">
        ${enCours.clientNom ? `<span>${_esc(enCours.clientNom)}</span>` : ''}
        ${date ? `<span>·</span><span>${date}</span>` : ''}
      </div>
      <div class="hero-footer">
        ${tauxAff ? `<span class="hero-taux">${tauxAff}</span>` : '<span></span>'}
        <span class="hero-arrow">→</span>
      </div>
    </div>`;
  })() : '';

  // ── Next card — prochain par date de shooting (statut "avenir") ──
  const prochain = state.projets
    .filter(p => p.statut === 'avenir' && p.dateShooting)
    .sort((a, b) => new Date(a.dateShooting) - new Date(b.dateShooting))[0] ?? null;
  const nextHtml = prochain ? (() => {
    const dateStr = new Date(prochain.dateShooting).toLocaleDateString('fr-CH',
      { day: 'numeric', month: 'long' });
    const s = STATUTS[prochain.statut] ?? STATUTS.brouillon;
    return `
    <div class="studio-next-card glass-card" data-next-id="${prochain.id}" role="button" tabindex="0">
      <div class="next-header">
        <p class="next-eyebrow">À venir</p>
        <span class="statut-pill" style="color:${s.color};background:${s.bg};">${s.label}</span>
      </div>
      <p class="next-nom">${_esc(prochain.nom)}</p>
      <div class="next-meta">
        ${prochain.clientNom ? `<span>${_esc(prochain.clientNom)}</span><span>·</span>` : ''}
        <span class="next-date">${dateStr}</span>
      </div>
    </div>`;
  })() : '';

  const statsHtml = `
    <div class="stats-row">
      <div class="stat-card glass-card">
        <p class="stat-label">CA ce mois</p>
        <p class="stat-value">${caMois > 0 ? _fmtCHF(caMois) : '—'}</p>
      </div>
      <div class="stat-card glass-card">
        <p class="stat-label">Taux moyen réel</p>
        <p class="stat-value">${tauxMoyen !== null ? tauxMoyen + ' CHF/h' : '—'}</p>
      </div>
    </div>`;

  if (!state.projets.length) {
    return statsHtml + `
      <div class="empty-state-view">
        ${_ico_empty_tripod()}
        <p class="empty-state-title">Ton premier projet attend.</p>
        <button class="btn-action" id="btnCreateFirst" type="button">
          Créer un projet
        </button>
      </div>`;
  }

  const insightHtml = _renderInsightCard();

  const groups   = _groupByClient(state.projets);
  const listHtml = groups.map(({ clientNom, items }) => `
    <div class="client-group">
      <p class="client-group-label">${_esc(clientNom)}</p>
      ${items.map(_renderProjetCard).join('')}
    </div>
  `).join('');

  return heroHtml + nextHtml + statsHtml + insightHtml + `<div class="projet-list">${listHtml}</div>`;
}

// ── Insight card (si ≥ 3 projets terminés) ────────────────
function _renderInsightCard() {
  const termines = state.projets.filter(p => p.statut === 'termine' && Number(p.prixFacture) > 0);
  if (termines.length < 3) return '';

  // Type le plus rentable (avec sessions, min 2 projets du même type)
  const byType = {};
  termines.forEach(p => {
    const t = p.type ?? 'autre';
    if (!byType[t]) byType[t] = { count: 0, totalPrix: 0, totalMin: 0 };
    byType[t].count++;
    byType[t].totalPrix += Number(p.prixFacture);
    byType[t].totalMin  += (p.sessions ?? []).reduce((s, x) => s + (Number(x.duree) || 0), 0);
  });

  let bestType = null, bestTaux = 0;
  Object.entries(byType).forEach(([t, d]) => {
    if (d.count >= 2 && d.totalMin > 0) {
      const taux = Math.round(d.totalPrix / (d.totalMin / 60));
      if (taux > bestTaux) { bestTaux = taux; bestType = t; }
    }
  });

  let insightText;
  if (bestType) {
    insightText = `Type le plus rentable : <strong>${TYPE_LABELS[bestType] ?? bestType}</strong> à <strong>${bestTaux} CHF/h</strong> en moyenne.`;
  } else {
    // Fallback : taux moyen global sur tous les terminés avec sessions
    const avecSess = termines.filter(p => (p.sessions ?? []).length > 0);
    if (!avecSess.length) return '';
    const totMin  = avecSess.reduce((s, p) => s + (p.sessions ?? []).reduce((a, x) => a + (Number(x.duree) || 0), 0), 0);
    const totPrix = avecSess.reduce((s, p) => s + Number(p.prixFacture), 0);
    if (!totMin) return '';
    const avg = Math.round(totPrix / (totMin / 60));
    insightText = `Taux moyen réel : <strong>${avg} CHF/h</strong> sur ${avecSess.length} projet${avecSess.length > 1 ? 's' : ''} terminé${avecSess.length > 1 ? 's' : ''}.`;
  }

  return `
    <div class="insight-card glass-card">
      <p class="insight-eyebrow">💡 Insight</p>
      <p class="insight-text">${insightText}</p>
    </div>`;
}

function _wireStudio() {
  $('btnCreateFirst')?.addEventListener('click', _openNewProjectSheet);

  // Hero card — ouvrir le projet en cours → Temps
  const heroCard = $('viewContainer').querySelector('[data-hero-id]');
  if (heroCard) {
    heroCard.addEventListener('click', () => {
      state.activeProjetId = heroCard.dataset.heroId;
      state.projetSubView  = 'temps';
      navigateTo('projet');
    });
    heroCard.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); heroCard.click(); }
    });
  }

  // Next card — ouvrir le prochain projet → Préparer
  const nextCard = $('viewContainer').querySelector('[data-next-id]');
  if (nextCard) {
    nextCard.addEventListener('click', () => {
      state.activeProjetId = nextCard.dataset.nextId;
      state.projetSubView  = 'preparer';
      navigateTo('projet');
    });
    nextCard.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nextCard.click(); }
    });
  }

  // Cartes projet — clic sur la carte → ouvrir dans Projet
  $('viewContainer').querySelectorAll('[data-projet-id]').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.projet-menu-btn')) return; // géré séparément
      const id  = card.dataset.projetId;
      const p   = state.projets.find(x => x.id === id);
      if (!p) return;
      state.activeProjetId = id;
      // Routing intelligent par statut
      if      (p.statut === 'encours' || p.statut === 'atraiter') state.projetSubView = 'temps';
      else if (p.statut === 'termine')                           state.projetSubView = 'bilan';
      else                                                       state.projetSubView = 'preparer';
      navigateTo('projet');
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
    });
  });

  // Boutons menu "···"
  $('viewContainer').querySelectorAll('.projet-menu-btn').forEach(btn =>
    btn.addEventListener('click', e => {
      e.stopPropagation();
      _openProjetMenu(btn.dataset.menuProjetId, btn);
    })
  );
}

function _openProjetMenu(projetId, triggerEl) {
  if (document.querySelector('.bottom-sheet')) return;

  const projet = state.projets.find(p => p.id === projetId);
  if (!projet) return;

  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  overlay.id = 'sheetOverlay';
  overlay.addEventListener('click', _closeSheet);

  const sheet = document.createElement('div');
  sheet.className = 'bottom-sheet projet-menu-sheet';
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <h2 class="sheet-title">${_esc(projet.nom)}</h2>
    </div>
    <div class="menu-sheet-actions">
      <button class="menu-sheet-item" data-action="modifier" type="button">
        Modifier
      </button>
      <button class="menu-sheet-item menu-sheet-item--warn" data-action="sanssuite" type="button">
        Marquer sans suite
      </button>
      <button class="menu-sheet-item menu-sheet-item--danger" data-action="supprimer" type="button">
        Supprimer
      </button>
    </div>
    <div style="height:env(safe-area-inset-bottom,16px)"></div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(sheet);

  requestAnimationFrame(() => {
    overlay.classList.add('is-visible');
    sheet.classList.add('is-open');
  });

  sheet.querySelectorAll('.menu-sheet-item').forEach(btn =>
    btn.addEventListener('click', e => {
      const action = e.currentTarget.dataset.action;
      _closeSheet();
      setTimeout(() => {
        if (action === 'modifier') {
          _editingProjetId = projetId;
          _openEditProjetSheet(projet);

        } else if (action === 'sanssuite') {
          if (!confirm(`Marquer "${projet.nom}" sans suite ?`)) return;
          const idx = state.projets.findIndex(p => p.id === projetId);
          if (idx !== -1) { state.projets[idx].statut = 'sanssuite'; save.projets(); }
          navigateTo('studio');

        } else if (action === 'supprimer') {
          if (!confirm(`Supprimer "${projet.nom}" définitivement ?`)) return;
          state.projets = state.projets.filter(p => p.id !== projetId);
          if (state.activeProjetId === projetId) state.activeProjetId = null;
          save.projets();
          navigateTo('studio');
        }
      }, 360);
    })
  );
}

// ─── Stats ───────────────────────────────────────────────

function _statsCaMois() {
  const now   = new Date();
  const annee = now.getFullYear();
  const mois  = now.getMonth();
  return state.projets
    .filter(p => {
      if (p.statut === 'sanssuite') return false;
      if (!p.dateShooting) return false;
      const d = new Date(p.dateShooting);
      return d.getFullYear() === annee && d.getMonth() === mois;
    })
    .reduce((sum, p) => sum + (Number(p.prixFacture) || 0), 0);
}

function _statsTauxMoyen() {
  const projetsOk = state.projets.filter(p =>
    p.statut !== 'sanssuite' &&
    (p.sessions ?? []).length > 0 &&
    Number(p.prixFacture) > 0
  );
  if (!projetsOk.length) return null;
  const totalMin  = projetsOk.reduce((s, p) =>
    s + (p.sessions ?? []).reduce((a, x) => a + (Number(x.duree) || 0), 0), 0);
  const totalPrix = projetsOk.reduce((s, p) => s + Number(p.prixFacture), 0);
  return totalMin > 0 ? Math.round(totalPrix / (totalMin / 60)) : null;
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
  const s    = STATUTS[p.statut] ?? STATUTS.brouillon;
  const date = p.dateShooting
    ? new Date(p.dateShooting).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })
    : '';
  const type = TYPE_LABELS[p.type] ?? p.type ?? '';
  const prix = p.prixFacture ? _fmtCHF(p.prixFacture) : '—';

  return `
    <div class="projet-card" data-projet-id="${p.id}" role="button" tabindex="0"
      style="${p.statut === 'sanssuite' ? 'opacity:0.45;' : ''}">
      <div class="projet-card-header">
        <span class="projet-name">${_esc(p.nom)}</span>
        <span class="statut-pill"
          style="color:${s.color};background:${s.bg};">${s.label}</span>
      </div>
      <div class="projet-card-meta">
        <span>${type}</span>
        ${date ? `<span>·</span><span>${date}</span>` : ''}
        <span class="projet-prix">${prix}</span>
      </div>
      <button class="projet-menu-btn" data-menu-projet-id="${p.id}"
        type="button" aria-label="Options" tabindex="-1">···</button>
    </div>`;
}

function _statutPill(p) {
  // Conservé pour rétro-compatibilité interne si besoin
  return STATUTS[p.statut] ?? STATUTS.brouillon;
}

/**
 * Auto-calcule le statut d'un projet à partir de dateShooting.
 * Ne jamais écraser 'termine' ou 'sanssuite' (statuts finaux manuels).
 *
 * Pas de dateShooting          → "brouillon"
 * dateShooting > aujourd'hui   → "avenir"
 * dateShooting = aujourd'hui   → "encours"
 * dateShooting < aujourd'hui   → "atraiter"
 */
function _autoStatut(idx) {
  const p = state.projets[idx];
  if (!p) return;
  if (p.statut === 'termine' || p.statut === 'sanssuite') return;

  const ds = p.dateShooting ?? null;
  let newStatut;
  if (!ds) {
    newStatut = 'brouillon';
  } else {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const shoot = new Date(ds); shoot.setHours(0, 0, 0, 0);
    if (+shoot > +today)        newStatut = 'avenir';
    else if (+shoot === +today) newStatut = 'encours';
    else                        newStatut = 'atraiter';
  }

  if (state.projets[idx].statut !== newStatut) {
    state.projets[idx].statut = newStatut;
    save.projets();
  }
}

// Alias : sheet d'édition depuis le menu ··· ou depuis Préparer
function _openEditProjetSheet(projet) {
  _openNewProjectSheet(projet);
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
          <input id="nfDate" name="dateShooting" type="date"
            value="${isEdit && editProjet.dateShooting ? editProjet.dateShooting : ''}" />
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
  // _selectedClientIdNF : contact sélectionné via dropdown dans ce sheet
  let _selectedClientIdNF = null;
  $('newProjectForm').addEventListener('submit', e => _submitNewProject(e, _selectedClientIdNF));

  // Animate in
  requestAnimationFrame(() => {
    overlay.classList.add('is-visible');
    sheet.classList.add('is-open');
  });

  setTimeout(() => {
    $('nfNom')?.focus();
    _wireClientAutocomplete('nfClient', 'nfClientDrop', contact => {
      _selectedClientIdNF = contact.id;
    });
  }, 340);
}

// ────────────────────────────────────────────────────────
// AUTOCOMPLÉTION CLIENT — partagée par les deux sheets
// ────────────────────────────────────────────────────────

function _normalizeStr(s) {
  return String(s ?? '').toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Wire l'autocomplétion sur un <input> client.
 * @param {string} inputId  — id du champ texte
 * @param {string} dropId   — id du conteneur dropdown (créé dynamiquement)
 * @param {Function} onSelect — callback(contact) quand un item est sélectionné
 */
function _wireClientAutocomplete(inputId, dropId, onSelect) {
  const input = $(inputId);
  if (!input) return;

  // Créer le dropdown juste après l'input
  let drop = document.createElement('div');
  drop.className = 'client-dropdown';
  drop.id = dropId;
  input.parentNode.insertBefore(drop, input.nextSibling);

  const closeDrop = () => { drop.innerHTML = ''; drop.hidden = true; };
  closeDrop();

  input.addEventListener('input', () => {
    const q = _normalizeStr(input.value);
    if (q.length < 2) { closeDrop(); return; }

    const matches = state.contacts
      .filter(c => _normalizeStr(c.nom).includes(q) || _normalizeStr(c.entreprise).includes(q))
      .slice(0, 6);

    if (!matches.length) { closeDrop(); return; }

    drop.hidden = false;
    drop.innerHTML = matches.map(c => `
      <button class="client-dropdown-item" type="button" data-contact-id="${c.id}">
        <span class="dropdown-nom">${_esc(c.nom)}</span>
        ${c.entreprise ? `<span class="dropdown-ent">${_esc(c.entreprise)}</span>` : ''}
      </button>`).join('');

    drop.querySelectorAll('.client-dropdown-item').forEach(btn =>
      btn.addEventListener('mousedown', e => {
        e.preventDefault(); // évite blur avant click
        const contact = state.contacts.find(c => c.id === btn.dataset.contactId);
        if (contact) {
          input.value = contact.nom;
          onSelect(contact);
        }
        closeDrop();
      })
    );
  });

  input.addEventListener('blur', () => setTimeout(closeDrop, 150));
}

// ────────────────────────────────────────────────────────
// FAB global — bouton flottant création rapide
// ────────────────────────────────────────────────────────

function _injectFAB() {
  if ($('fabGlobal')) return; // déjà injecté
  const fab = document.createElement('button');
  fab.id        = 'fabGlobal';
  fab.className = 'fab-global';
  fab.type      = 'button';
  fab.setAttribute('aria-label', 'Créer un projet');
  fab.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none"
    stroke="currentColor" stroke-width="2.5"
    stroke-linecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14"/>
  </svg>`;
  fab.addEventListener('click', _openFABSheet);
  document.body.appendChild(fab);
}

function _openFABSheet() {
  if (document.querySelector('.bottom-sheet')) return;
  let _selectedClientId = null; // renseigné par l'autocomplete

  const types = [
    ['corporate', 'Corporate'], ['portrait', 'Portrait'],
    ['mariage',   'Mariage'],   ['event',    'Événement'],
    ['commercial','Commercial'],['autre',    'Autre'],
  ];

  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  overlay.id        = 'sheetOverlay';
  overlay.addEventListener('click', _closeSheet);

  const sheet = document.createElement('div');
  sheet.className = 'bottom-sheet';
  sheet.id        = 'newProjectSheet';
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
    <form class="sheet-form" id="fabProjectForm" novalidate>
      <label for="fpNom">
        Nom du projet
        <input id="fpNom" name="nom" type="text"
          placeholder="ex. Shooting corporate ACME"
          autocomplete="off" required />
      </label>
      <label for="fpClient">
        Client
        <input id="fpClient" name="clientNom" type="text"
          placeholder="Nom du client ou de l'entreprise"
          autocomplete="off" />
      </label>
      <div class="form-row">
        <label for="fpType">
          Type
          <select id="fpType" name="type">
            ${types.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
          </select>
        </label>
        <label for="fpDate">
          Date prévue
          <input id="fpDate" name="dateShooting" type="date" />
        </label>
      </div>
      <button class="btn-action sheet-submit" type="submit">
        Créer le projet →
      </button>
    </form>`;

  document.body.appendChild(overlay);
  document.body.appendChild(sheet);

  $('closeSheet').addEventListener('click', _closeSheet);

  $('fabProjectForm').addEventListener('submit', e => {
    e.preventDefault();
    const form    = e.target;
    const nom     = form.nom.value.trim();
    if (!nom) { $('fpNom').focus(); return; }

    const clientNom = form.clientNom.value.trim();
    let clientId    = _selectedClientId; // priorité au contact sélectionné dans dropdown
    if (clientNom && !clientId) {
      let contact = state.contacts.find(c => _normalizeStr(c.nom) === _normalizeStr(clientNom));
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
      id:               _genId(),
      nom,
      clientId,
      clientNom,
      type:             form.type.value,
      dateShooting:     form.dateShooting.value || null,
      prixFacture:      null,
      statut:           'brouillon',
      quotas:           { admin: 0, prepa: 0, shooting: 0, trajet: 0, edition: 0, revisions: 0 },
      checklist:        [],
      sessions:         [],
      frais:            [],
      photosCommandees: null,
      photosLivrees:    null,
      feuilleRoute:     { contact: '', lieu: '', notes: '', shots: [] },
      evalClient:       null,
      scores:           {},
      dateCreation:     new Date().toISOString(),
      dateCloture:      null,
    };

    state.projets.unshift(projet);
    state.activeProjetId = projet.id;
    save.projets();

    _closeSheet();
    setTimeout(() => {
      state.projetSubView = 'preparer';
      navigateTo('projet');
    }, 360);
  });

  requestAnimationFrame(() => {
    overlay.classList.add('is-visible');
    sheet.classList.add('is-open');
  });

  setTimeout(() => {
    $('fpNom')?.focus();
    _wireClientAutocomplete('fpClient', 'fpClientDrop', contact => {
      _selectedClientId = contact.id;
    });
  }, 340);
}

function _closeSheet() {
  const overlay = $('sheetOverlay');
  const sheet   = document.querySelector('.bottom-sheet');
  if (!sheet) return;
  overlay?.classList.remove('is-visible');
  sheet.classList.remove('is-open');
  setTimeout(() => { overlay?.remove(); sheet.remove(); }, 340);
}

function _submitNewProject(e, preselectedClientId = null) {
  e.preventDefault();
  const form = e.target;
  const nom  = form.nom.value.trim();
  if (!nom) { $('nfNom').focus(); return; }

  const clientNom = form.clientNom.value.trim();

  // Priorité : contact sélectionné via autocomplete, sinon matching normalisé, sinon création
  let clientId = preselectedClientId;
  if (clientNom && !clientId) {
    let contact = state.contacts.find(
      c => _normalizeStr(c.nom) === _normalizeStr(clientNom)
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
      state.projets[idx].dateShooting = form.dateShooting.value || null;
      state.projets[idx].prixFacture= Number(form.prixFacture.value) || null;
      save.projets();
    }
    _editingProjetId = null;
    _closeSheet();
    // Re-render la sous-vue offre avec les nouvelles données
    setTimeout(() => {
      state.projetSubView = 'preparer';
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
    dateShooting:  form.dateShooting.value || null,
    prixFacture:   Number(form.prixFacture.value) || null,
    statut:        'brouillon',
    quotas:           { admin: 0, prepa: 0, shooting: 0, trajet: 0, edition: 0, revisions: 0 },
    checklist:        [],
    sessions:         [],
    frais:            [],
    photosCommandees: null,
    photosLivrees:    null,
    feuilleRoute:     { contact: '', lieu: '', notes: '', shots: [] },
    evalClient:       null,
    scores:           {},
    dateCreation:     new Date().toISOString(),
    dateCloture:      null,
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
  if (!state.contacts.length) {
    return `
      <div class="empty-state-view">
        ${_ico_empty_lens()}
        <p class="empty-state-title">Commence par ajouter un client.</p>
        <button class="btn-action" id="btnAddFirstContact" type="button">
          Ajouter un contact
        </button>
      </div>`;
  }

  return `
    <div class="contacts-view">
      <div class="contacts-list" id="contactsList">
        ${state.contacts.map(_renderContactCard).join('')}
      </div>
    </div>`;
}

function _renderContactCard(c) {
  const projets = state.projets.filter(p => p.clientId === c.id || p.clientNom === c.nom);
  const nbProjets = projets.length;

  return `
    <div class="contact-card glass-card" data-contact-id="${c.id}">
      <div class="contact-card-header">
        <div class="contact-card-main">
          <p class="contact-nom">${_esc(c.nom)}</p>
          ${c.entreprise ? `<p class="contact-entreprise">${_esc(c.entreprise)}</p>` : ''}
        </div>
        <button class="contact-menu-btn" data-menu-contact-id="${c.id}"
          type="button" aria-label="Options" tabindex="-1">···</button>
      </div>
      <div class="contact-links">
        ${c.telephone ? `
          <a href="tel:${_esc(c.telephone)}" class="contact-link contact-link--tel">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.59 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6 6l.92-.93a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            ${_esc(c.telephone)}
          </a>` : ''}
        ${c.email ? `
          <a href="mailto:${_esc(c.email)}" class="contact-link contact-link--email">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            ${_esc(c.email)}
          </a>` : ''}
      </div>
      ${c.note ? `<p class="contact-note">${_esc(c.note)}</p>` : ''}
      ${nbProjets > 0 ? `
        <p class="contact-projets-count">${nbProjets} projet${nbProjets > 1 ? 's' : ''}</p>` : ''}
    </div>`;
}

function _wireProspection() {
  $('btnAddFirstContact')?.addEventListener('click', _openContactSheet);

  document.querySelectorAll('.contact-menu-btn').forEach(btn =>
    btn.addEventListener('click', e => {
      e.stopPropagation();
      _openContactMenu(btn.dataset.menuContactId);
    })
  );
}

function _openContactMenu(contactId) {
  if (document.querySelector('.bottom-sheet')) return;
  const contact = state.contacts.find(c => c.id === contactId);
  if (!contact) return;

  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  overlay.id = 'sheetOverlay';
  overlay.addEventListener('click', _closeSheet);

  const sheet = document.createElement('div');
  sheet.className = 'bottom-sheet projet-menu-sheet';
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <h2 class="sheet-title">${_esc(contact.nom)}</h2>
    </div>
    <div class="menu-sheet-actions">
      <button class="menu-sheet-item" data-action="modifier" type="button">Modifier</button>
      <button class="menu-sheet-item menu-sheet-item--danger" data-action="supprimer" type="button">Supprimer</button>
    </div>
    <div style="height:env(safe-area-inset-bottom,16px)"></div>`;

  document.body.appendChild(overlay);
  document.body.appendChild(sheet);
  requestAnimationFrame(() => { overlay.classList.add('is-visible'); sheet.classList.add('is-open'); });

  sheet.querySelectorAll('.menu-sheet-item').forEach(btn =>
    btn.addEventListener('click', e => {
      const action = e.currentTarget.dataset.action;
      _closeSheet();
      setTimeout(() => {
        if (action === 'modifier') {
          _openContactSheet(contact);
        } else if (action === 'supprimer') {
          if (!confirm(`Supprimer "${contact.nom}" ?`)) return;
          state.contacts = state.contacts.filter(c => c.id !== contactId);
          save.contacts();
          navigateTo('prospection');
        }
      }, 360);
    })
  );
}

function _openContactSheet(editContact = null) {
  if (document.querySelector('.bottom-sheet')) return;
  const isEdit = editContact !== null;

  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  overlay.id = 'sheetOverlay';
  overlay.addEventListener('click', _closeSheet);

  const sheet = document.createElement('div');
  sheet.className = 'bottom-sheet';
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <h2 class="sheet-title">${isEdit ? 'Modifier le contact' : 'Nouveau contact'}</h2>
      <button class="icon-button" id="closeSheet" type="button" aria-label="Fermer">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <form class="sheet-form" id="contactForm" novalidate>
      <label for="cfNom">
        Nom
        <input id="cfNom" name="nom" type="text"
          placeholder="Prénom Nom" autocomplete="off" required
          value="${isEdit ? _esc(editContact.nom) : ''}" />
      </label>
      <label for="cfEntreprise">
        Entreprise
        <input id="cfEntreprise" name="entreprise" type="text"
          placeholder="Nom de l'entreprise" autocomplete="off"
          value="${isEdit && editContact.entreprise ? _esc(editContact.entreprise) : ''}" />
      </label>
      <label for="cfTel">
        Téléphone
        <input id="cfTel" name="telephone" type="tel"
          placeholder="+41 79 000 00 00" autocomplete="tel"
          value="${isEdit && editContact.telephone ? _esc(editContact.telephone) : ''}" />
      </label>
      <label for="cfEmail">
        Email
        <input id="cfEmail" name="email" type="email"
          placeholder="nom@exemple.com" autocomplete="email"
          value="${isEdit && editContact.email ? _esc(editContact.email) : ''}" />
      </label>
      <label for="cfNote">
        Note
        <textarea id="cfNote" name="note" rows="2"
          placeholder="Canal de contact, contexte…">${isEdit && editContact.note ? _esc(editContact.note) : ''}</textarea>
      </label>
      <button class="btn-action sheet-submit" type="submit">
        ${isEdit ? 'Enregistrer' : 'Ajouter le contact'}
      </button>
    </form>`;

  document.body.appendChild(overlay);
  document.body.appendChild(sheet);
  $('closeSheet').addEventListener('click', _closeSheet);

  $('contactForm').addEventListener('submit', e => {
    e.preventDefault();
    const form = e.target;
    const nom  = form.nom.value.trim();
    if (!nom) { $('cfNom').focus(); return; }

    if (isEdit) {
      const idx = state.contacts.findIndex(c => c.id === editContact.id);
      if (idx !== -1) {
        state.contacts[idx].nom        = nom;
        state.contacts[idx].entreprise = form.entreprise.value.trim();
        state.contacts[idx].telephone  = form.telephone.value.trim();
        state.contacts[idx].email      = form.email.value.trim();
        state.contacts[idx].note       = form.note.value.trim();
        save.contacts();
      }
    } else {
      const contact = {
        id:          _genId(),
        nom,
        entreprise:  form.entreprise.value.trim(),
        telephone:   form.telephone.value.trim(),
        email:       form.email.value.trim(),
        note:        form.note.value.trim(),
        dateContact: new Date().toISOString().slice(0, 10),
        statut:      'client',
        projetId:    null,
      };
      state.contacts.push(contact);
      save.contacts();
    }

    _closeSheet();
    setTimeout(() => navigateTo('prospection'), 360);
  });

  requestAnimationFrame(() => { overlay.classList.add('is-visible'); sheet.classList.add('is-open'); });
  setTimeout(() => $('cfNom')?.focus(), 340);
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
  const subViews = ['preparer', 'temps', 'frais', 'bilan'];

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
            ${{ preparer:'Préparer', temps:'Temps', frais:'Frais', bilan:'Bilan' }[v] ?? v}
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
    case 'preparer': return _subviewPreparer(projet);
    case 'temps':  return _subviewTemps(projet);
    case 'frais':  return _subviewFrais(projet);
    case 'bilan':  return _subviewBilan(projet);
    default:       return '';
  }
}

function _wireProjetSubView(sv, projet) {
  if (sv === 'preparer') _wirePreparer(projet);
  if (sv === 'temps')  _wireTemps(projet);
  if (sv === 'frais')  _wireFrais(projet);
  if (sv === 'bilan')  _wireBilan(projet);
}

function _wireBilan(projet) {
  // Photos livrées — auto-save + refresh badge
  $('photosLivreesInput')?.addEventListener('input', e => {
    const val = Number(e.target.value) || null;
    const idx = state.projets.findIndex(p => p.id === projet.id);
    if (idx !== -1) {
      state.projets[idx].photosLivrees = val;
      save.projets();
    }
  });

  $('btnCloturerProjet')?.addEventListener('click', () => {
    if (!confirm('Clôturer ce projet définitivement ?')) return;

    const idx = state.projets.findIndex(p => p.id === projet.id);
    if (idx !== -1) {
      state.projets[idx].statut      = 'termine';
      state.projets[idx].dateCloture = new Date().toISOString();
      save.projets();
      _showClotureOverlay(state.projets[idx]);
    }
  });
}

function _showClotureOverlay(projet) {
  // Calcul perf
  const prixFacture = Number(projet.prixFacture) || 0;
  const totalMin    = (projet.sessions ?? []).reduce((s, x) => s + (Number(x.duree) || 0), 0);
  const tauxReel    = totalMin > 0 && prixFacture > 0
    ? Math.round(prixFacture / (totalMin / 60)) : null;

  let verdictIcon, verdictText, verdictCls;
  if (tauxReel === null || !hasTaux()) {
    verdictIcon = '✓'; verdictText = 'Projet clôturé !'; verdictCls = 'is-neutral';
  } else {
    const { tauxPlancher, tauxCible } = state.user;
    if (tauxReel >= tauxCible) {
      verdictIcon = '🎉'; verdictText = 'Projet rentable !'; verdictCls = 'is-profit';
    } else if (tauxReel >= tauxPlancher) {
      verdictIcon = '👍'; verdictText = 'Marge correcte'; verdictCls = 'is-warn';
    } else {
      verdictIcon = '📉'; verdictText = 'Sous le plancher'; verdictCls = 'is-loss';
    }
  }

  const overlay = document.createElement('div');
  overlay.className = 'cloture-overlay';
  overlay.innerHTML = `
    <div class="cloture-card">
      <div class="cloture-check">${verdictIcon}</div>
      <p class="cloture-titre">${_esc(projet.nom)}</p>
      ${tauxReel !== null
        ? `<p class="cloture-taux">${tauxReel} CHF/h réel</p>`
        : ''}
      <p class="cloture-verdict ${verdictCls}">${verdictText}</p>
    </div>`;

  document.body.appendChild(overlay);

  // fadeOut puis navigateTo studio
  setTimeout(() => {
    overlay.style.transition = 'opacity .5s ease';
    overlay.style.opacity    = '0';
  }, 2000);
  setTimeout(() => {
    overlay.remove();
    navigateTo('studio');
  }, 2500);
}

// ════════════════════════════════════════════════════════
// SOUS-VUE PRÉPARER — restructuration Phase 3
// ════════════════════════════════════════════════════════

function _subviewPreparer(projet) {
  const totalH  = _totalQuotaH(projet);
  const prixF   = Number(projet.prixFacture) || 0;
  const fr      = projet.feuilleRoute ?? { contact:'', lieu:'', notes:'', shots:[] };

  // ── Taux implicite ──────────────────────────────────
  let tauxVal, tauxLabel, tauxCls;
  if (prixF <= 0) {
    tauxVal = '—'; tauxLabel = 'taux implicite'; tauxCls = '';
  } else if (totalH <= 0) {
    tauxVal   = `CHF ${Math.round(prixF / 8)}/h`;
    tauxLabel = 'Base 1 j · affine tes quotas'; tauxCls = '';
  } else {
    const t   = Math.round(prixF / totalH);
    tauxVal   = `CHF ${t}/h`; tauxLabel = 'taux implicite'; tauxCls = _tauxImplClass(t);
  }

  const dateDisplay = projet.dateShooting
    ? new Date(projet.dateShooting).toLocaleDateString('fr-CH',
        { day:'numeric', month:'short', year:'numeric' })
    : '';

  // ── Prix conseillé ──────────────────────────────────
  const projSimilaires = state.projets.filter(p =>
    p.id !== projet.id && p.type === projet.type &&
    p.statut === 'termine' && Number(p.prixFacture) > 0
  );
  let prixSuggestionHtml = '';
  if (projSimilaires.length >= 2) {
    const moy  = Math.round(projSimilaires.reduce((s,p)=>s+Number(p.prixFacture),0) / projSimilaires.length);
    const low  = Math.round(moy * 0.9 / 50) * 50;
    const high = Math.round(moy * 1.1 / 50) * 50;
    const tauxMoySim = (() => {
      const ts = projSimilaires.filter(p => (p.sessions??[]).length > 0);
      if (!ts.length) return null;
      const totMin = ts.reduce((s,p)=>(p.sessions??[]).reduce((a,x)=>a+(Number(x.duree)||0),s),0);
      const totPrix = ts.reduce((s,p)=>s+Number(p.prixFacture),0);
      return totMin > 0 ? Math.round(totPrix / (totMin/60)) : null;
    })();
    prixSuggestionHtml = `
      <div class="prix-suggestion" id="prixSuggestion">
        <p class="suggestion-label">💡 Suggestion basée sur tes projets passés</p>
        <p class="suggestion-val">${_fmtCHF(low)} – ${_fmtCHF(high)}</p>
        <p class="suggestion-detail">${projSimilaires.length} projet${projSimilaires.length>1?'s':''} ${TYPE_LABELS[projet.type]??projet.type} similaire${projSimilaires.length>1?'s':''}${tauxMoySim ? ` · CHF ${tauxMoySim}/h en moyenne` : ''}</p>
        <button class="btn-suggestion-apply" id="btnApplySuggestion"
          data-prix="${moy}" type="button">
          Utiliser ${_fmtCHF(moy)}
        </button>
      </div>`;
  } else if (totalH > 0 && hasTaux()) {
    const auto = Math.round(totalH * state.user.tauxCible);
    prixSuggestionHtml = `
      <div class="prix-calcul" id="prixCalcul">
        <p class="calcul-label">Basé sur tes quotas × taux cible CHF ${state.user.tauxCible}/h</p>
        <p class="calcul-val" id="prixCalcAuto">${_fmtCHF(auto)}</p>
      </div>`;
  }

  const cats = [
    ['admin',    'Admin'],
    ['prepa',    'Prépa'],
    ['shooting', 'Shooting'],
    ['trajet',   'Trajet'],
    ['edition',  'Édition'],
    ['revisions','Révisions'],
  ];

  const shotsHtml = (fr.shots ?? []).map(s => `
    <div class="shot-row" data-shot-id="${s.id}">
      <input type="checkbox" class="shot-check" data-shot-id="${s.id}"
        ${s.done ? 'checked' : ''} />
      <span class="shot-label${s.done ? ' is-done' : ''}">${_esc(s.label)}</span>
      <button class="shot-delete" data-shot-id="${s.id}" type="button"
        aria-label="Supprimer">×</button>
    </div>`).join('');

  return `
    <div class="offre-view">

      <!-- ── 1. Infos projet ── -->
      <div class="offre-section glass-card">
        <div class="offre-infos-header">
          <div class="offre-infos-text">
            <p class="offre-nom">${_esc(projet.nom)}</p>
            <p class="offre-meta">${[
              TYPE_LABELS[projet.type],
              projet.clientNom ? _esc(projet.clientNom) : '',
            ].filter(Boolean).join(' · ')}</p>
            <div class="offre-date-row">
              <label class="offre-date-label" for="dateShooting">📅 Date de shooting</label>
              <input id="dateShooting" class="offre-date-input" type="date"
                value="${projet.dateShooting ?? ''}" />
            </div>
            <button class="btn-link-edit" id="btnEditProjet" type="button">Modifier</button>
            <div class="photos-cmd-row">
              <label class="photos-cmd-label" for="photosCommandeesInput">Photos commandées</label>
              <input id="photosCommandeesInput" class="photos-cmd-input"
                type="number" min="0" step="1" inputmode="numeric"
                placeholder="—" value="${projet.photosCommandees ?? ''}" />
            </div>
          </div>
          <div class="taux-impl ${tauxCls}" id="tauxImplCard">
            <p class="taux-impl-val" id="tauxImplVal">${tauxVal}</p>
            <p class="taux-impl-label" id="tauxImplLabel">${tauxLabel}</p>
          </div>
        </div>
      </div>

      <!-- ── 2. Prix de l'offre ── -->
      <div class="prix-conseil-card glass-card">
        <p class="offre-section-title">Prix de l'offre</p>
        ${prixSuggestionHtml}
        <label for="prixInput">
          Prix final CHF
          <input id="prixInput" type="number" min="0" step="50"
            inputmode="decimal" placeholder="0"
            value="${projet.prixFacture ?? ''}" />
        </label>
      </div>

      <!-- ── 3. Quotas ── -->
      <div class="offre-section glass-card">
        <p class="offre-section-title">Temps estimé</p>
        ${cats.map(([key, label]) => `
          <div class="quota-cat-row">
            <span class="quota-cat-dot" style="background:${CATEGORIES[key]?.color ?? '#aaa'}"></span>
            <span class="quota-cat-label">${label}</span>
            <input class="quota-input" type="number"
              data-cat="${key}" min="0" step="0.5"
              value="${projet.quotas?.[key] ?? 0}" />
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

      <!-- ── 4. Feuille de route (accordéon, déplié par défaut) ── -->
      <div class="accordion glass-card" data-acc="feuille">
        <button class="accordion-header" type="button" aria-expanded="true" data-acc-btn="feuille">
          <span class="accordion-title">Feuille de route</span>
          <svg class="accordion-chevron is-open" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
        <div class="accordion-body" data-acc-body="feuille">
          <label for="frContact">
            Contact client
            <input id="frContact" type="text"
              placeholder="Nom · +41 79 000 00 00"
              autocomplete="off"
              value="${_esc(fr.contact ?? '')}" />
          </label>
          <label for="frLieu">
            Lieu
            <input id="frLieu" type="text"
              placeholder="Adresse ou lieu"
              autocomplete="off"
              value="${_esc(fr.lieu ?? '')}" />
          </label>
          <label for="frNotes">
            Notes
            <textarea id="frNotes" rows="3"
              placeholder="Ambiance, style, contraintes…"
              style="resize:vertical;">${_esc(fr.notes ?? '')}</textarea>
          </label>
        </div>
      </div>

      <!-- ── 5. Plan de shots (accordéon) ── -->
      <div class="accordion glass-card" data-acc="shots">
        <button class="accordion-header" type="button" aria-expanded="false" data-acc-btn="shots">
          <span class="accordion-title">Plan de shots</span>
          <span class="accordion-badge">${(fr.shots ?? []).length || ''}</span>
          <svg class="accordion-chevron" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
        <div class="accordion-body is-closed" data-acc-body="shots">
          <div id="shotsList">${shotsHtml}</div>
          <div class="shot-add-row">
            <input id="shotInput" type="text"
              placeholder="Ex: Portrait CEO · 3 variantes"
              autocomplete="off" autocapitalize="sentences" />
            <button class="btn-shot-add" id="btnAddShot" type="button" aria-label="Ajouter">+</button>
          </div>
        </div>
      </div>

      <!-- ── 6. Matériel (accordéon) ── -->
      <div class="accordion glass-card" data-acc="materiel">
        <button class="accordion-header" type="button" aria-expanded="false" data-acc-btn="materiel">
          <span class="accordion-title">Matériel</span>
          <svg class="accordion-chevron" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
        <div class="accordion-body is-closed" data-acc-body="materiel">
          ${_renderChecklistSection(projet)}
        </div>
      </div>

      <!-- ── 6. Actions offre ── -->
      ${(projet.statut !== 'encours' && projet.statut !== 'termine' && projet.statut !== 'sanssuite')
        ? `<button class="btn-action" id="btnEnvoyerOffre" type="button">
            Offre envoyée →
          </button>
          <button class="btn-text-muted" id="btnSansSuiteOffre" type="button">
            Marquer sans suite
          </button>`
        : `<button class="btn-action" id="btnStartChrono" type="button">
            Démarrer le chrono →
          </button>`}

    </div>`;
}

function _wirePreparer(projet) {
  const CATS_ALL = ['admin','prepa','shooting','trajet','edition','revisions'];

  // Quotas
  document.querySelectorAll('.quota-input, .quota-unit').forEach(el =>
    el.addEventListener('input', () => _onQuotaChange(projet, CATS_ALL))
  );

  // Prix input — auto-save
  $('prixInput')?.addEventListener('input', e => {
    const val = Number(e.target.value) || null;
    const idx = state.projets.findIndex(p => p.id === projet.id);
    if (idx !== -1) {
      state.projets[idx].prixFacture = val;
      save.projets();
      _autoStatut(idx);
      // Met à jour taux implicite
      _onQuotaChange(state.projets[idx], CATS_ALL);
    }
  });

  // Suggestion — appliquer prix
  $('btnApplySuggestion')?.addEventListener('click', e => {
    const prix = Number(e.currentTarget.dataset.prix);
    const prixEl = $('prixInput');
    if (prixEl) prixEl.value = prix;
    const idx = state.projets.findIndex(p => p.id === projet.id);
    if (idx !== -1) {
      state.projets[idx].prixFacture = prix;
      save.projets();
      _autoStatut(idx);
      _onQuotaChange(state.projets[idx], CATS_ALL);
    }
  });

  // Photos commandées
  $('photosCommandeesInput')?.addEventListener('input', e => {
    const val = Number(e.target.value) || null;
    const idx = state.projets.findIndex(p => p.id === projet.id);
    if (idx !== -1) { state.projets[idx].photosCommandees = val; save.projets(); }
  });

  // Date de shooting — auto-save + autoStatut
  $('dateShooting')?.addEventListener('change', e => {
    const val = e.target.value || null;
    const idx = state.projets.findIndex(p => p.id === projet.id);
    if (idx !== -1) {
      state.projets[idx].dateShooting = val;
      save.projets();
      _autoStatut(idx);
    }
  });

  // Modifier le projet
  $('btnEditProjet')?.addEventListener('click', () => {
    _editingProjetId = projet.id;
    _openEditProjetSheet(projet);
  });

  // Accordéons
  _wireAccordions();

  // Checklist matériel
  _wireChecklistSection(projet);
  $('btnGoToProfil')?.addEventListener('click', () => navigateTo('profil'));

  // Feuille de route — auto-save
  const _saveFR = () => {
    const idx = state.projets.findIndex(p => p.id === projet.id);
    if (idx === -1) return;
    if (!state.projets[idx].feuilleRoute)
      state.projets[idx].feuilleRoute = { contact:'', lieu:'', notes:'', shots:[] };
    state.projets[idx].feuilleRoute.contact = $('frContact')?.value ?? '';
    state.projets[idx].feuilleRoute.lieu    = $('frLieu')?.value    ?? '';
    state.projets[idx].feuilleRoute.notes   = $('frNotes')?.value   ?? '';
    save.projets();
  };
  ['frContact','frLieu','frNotes'].forEach(id => $(id)?.addEventListener('input', _saveFR));

  // Shots — ajouter
  const doAddShot = () => {
    const input = $('shotInput');
    const label = input?.value.trim();
    if (!label) { input?.focus(); return; }
    const idx = state.projets.findIndex(p => p.id === projet.id);
    if (idx !== -1) {
      if (!state.projets[idx].feuilleRoute)
        state.projets[idx].feuilleRoute = { contact:'', lieu:'', notes:'', shots:[] };
      state.projets[idx].feuilleRoute.shots.push({ id: _genId(), label, done: false });
      save.projets();
      _refreshShotsList(state.projets[idx]);
    }
    if (input) input.value = '';
    input?.focus();
  };
  $('btnAddShot')?.addEventListener('click', doAddShot);
  $('shotInput')?.addEventListener('keydown', e => { if (e.key==='Enter'){e.preventDefault();doAddShot();}});

  // Shots — check/uncheck + supprimer
  _wireShotsListeners(projet);

  // Actions
  $('btnEnvoyerOffre')?.addEventListener('click', () => {
    const idx = state.projets.findIndex(p => p.id === projet.id);
    if (idx !== -1) { state.projets[idx].statut = 'attente'; save.projets(); }
    const btn = $('btnEnvoyerOffre');
    if (btn) { btn.textContent='Offre envoyée ✓'; btn.disabled=true; btn.style.opacity='.7'; }
    setTimeout(() => navigateTo('studio'), 1200);
  });
  $('btnSansSuiteOffre')?.addEventListener('click', () => {
    if (!confirm(`Marquer "${projet.nom}" sans suite ?`)) return;
    const idx = state.projets.findIndex(p => p.id === projet.id);
    if (idx !== -1) { state.projets[idx].statut = 'sanssuite'; save.projets(); }
    navigateTo('studio');
  });
  $('btnStartChrono')?.addEventListener('click', () => {
    state.projetSubView = 'temps';
    document.querySelectorAll('[data-subview]').forEach(b =>
      b.classList.toggle('is-active', b.dataset.subview === 'temps')
    );
    _refreshProjetSubView();
  });
}

function _wireShotsListeners(projet) {
  document.querySelectorAll('.shot-check').forEach(cb =>
    cb.addEventListener('change', e => {
      const id   = e.target.dataset.shotId;
      const done = e.target.checked;
      const idx  = state.projets.findIndex(p => p.id === projet.id);
      if (idx !== -1 && state.projets[idx].feuilleRoute?.shots) {
        const si = state.projets[idx].feuilleRoute.shots.findIndex(s => s.id === id);
        if (si !== -1) { state.projets[idx].feuilleRoute.shots[si].done = done; save.projets(); }
      }
      const labelEl = e.target.closest('.shot-row')?.querySelector('.shot-label');
      labelEl?.classList.toggle('is-done', done);
    })
  );
  document.querySelectorAll('.shot-delete').forEach(btn =>
    btn.addEventListener('click', e => {
      const id  = e.currentTarget.dataset.shotId;
      const idx = state.projets.findIndex(p => p.id === projet.id);
      if (idx !== -1 && state.projets[idx].feuilleRoute?.shots) {
        state.projets[idx].feuilleRoute.shots =
          state.projets[idx].feuilleRoute.shots.filter(s => s.id !== id);
        save.projets();
        _refreshShotsList(state.projets[idx]);
      }
    })
  );
}

function _refreshShotsList(projet) {
  const el = $('shotsList');
  if (!el) return;
  const fr = projet.feuilleRoute ?? { shots:[] };
  el.innerHTML = (fr.shots ?? []).map(s => `
    <div class="shot-row" data-shot-id="${s.id}">
      <input type="checkbox" class="shot-check" data-shot-id="${s.id}" ${s.done?'checked':''} />
      <span class="shot-label${s.done?' is-done':''}">${_esc(s.label)}</span>
      <button class="shot-delete" data-shot-id="${s.id}" type="button" aria-label="Supprimer">×</button>
    </div>`).join('');
  _wireShotsListeners(projet);
}

function _onQuotaChange(projet, cats = ['admin', 'prepa', 'shooting', 'trajet', 'edition', 'revisions']) {
  const quotas = {};
  cats.forEach(cat => {
    const val  = Number(document.querySelector(`.quota-input[data-cat="${cat}"]`)?.value) || 0;
    const unit = document.querySelector(`.quota-unit[data-cat="${cat}"]`)?.value || 'h';
    quotas[cat] = _quotaToHours(val, unit);
  });

  const totalH  = Object.values(quotas).reduce((s, h) => s + h, 0);
  const prixF   = Number(projet.prixFacture) || 0;

  // Logique 3-cas : pas de prix · prix sans quotas · prix avec quotas
  let tvVal, tvLabel, tvCls;
  if (prixF <= 0) {
    tvVal = '—'; tvLabel = 'taux implicite'; tvCls = '';
  } else if (totalH <= 0) {
    tvVal  = `CHF ${Math.round(prixF / 8)}/h`;
    tvLabel = 'Base 1 j · affine tes quotas';
    tvCls  = '';
  } else {
    const t = Math.round(prixF / totalH);
    tvVal  = `CHF ${t}/h`;
    tvLabel = 'taux implicite';
    tvCls  = _tauxImplClass(t);
  }

  const totEl   = $('quotaTotalVal');
  const valEl   = $('tauxImplVal');
  const lblEl   = $('tauxImplLabel');
  const cardEl  = $('tauxImplCard');
  if (totEl)  totEl.textContent  = _fmtH(totalH);
  if (valEl)  valEl.textContent  = tvVal;
  if (lblEl)  lblEl.textContent  = tvLabel;
  if (cardEl) cardEl.className   = `taux-impl ${tvCls}`;

  // Auto-save + statut auto
  const idx = state.projets.findIndex(p => p.id === projet.id);
  if (idx !== -1) {
    state.projets[idx].quotas = quotas;
    save.projets();
    _autoStatut(idx);
  }
}

// ─── Sous-vues stub (Phases 6–7) ─────────────────────

// ════════════════════════════════════════════════════════
// SOUS-VUE TEMPS — Phase 6
// ════════════════════════════════════════════════════════

function _subviewTemps(projet) {
  return `
    <div class="temps-view">

      <!-- 1. Chrono -->
      <div class="glass-card chrono-card">
        <p class="chrono-status" id="chronoStatus">Prêt</p>
        <p class="chrono-display" id="chronoDisplay">00:00:00</p>
        <p class="chrono-sub" id="chronoSub"></p>
      </div>

      <!-- 2. Boutons -->
      <div class="chrono-actions">
        <button class="btn-action" id="btnToggleChrono" type="button">
          Démarrer
        </button>
        <button class="btn-secondary" id="btnManuelTime" type="button">
          ${_ico_clock_plus()}
          Manuel
        </button>
      </div>

      <!-- 3. Chips catégories -->
      <div class="cat-chips-scroll" id="catChips">
        ${_renderCatChips(_timerCat)}
      </div>

      <!-- 4. Barres de progression quotas -->
      <div class="quota-bars" id="quotaBars">
        <p class="quota-bars-title">Quotas</p>
        ${_renderQuotaBars(projet)}
      </div>

      <!-- 5. Stats + Sessions -->
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
    _autoStatut(idx); // passer en 'encours' dès la première session
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

  // Mise à jour des barres quota toutes les 5 secondes
  _tickBarCounter++;
  if (_tickBarCounter % 5 === 0) {
    const p = _activeProjet();
    if (p) _updateQuotaBars(p);
  }
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
  _updateQuotaBars(projet);
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

// ─── Barres de progression quotas ─────────────────────

function _renderQuotaBars(projet) {
  const catOrder = ['admin', 'prepa', 'shooting', 'trajet', 'edition', 'revisions'];

  // Effectif par catégorie (en minutes)
  const effMin = {};
  (projet.sessions ?? []).forEach(s => {
    effMin[s.categorie] = (effMin[s.categorie] ?? 0) + (Number(s.duree) || 0);
  });

  // Ne garder que les catégories avec quota > 0
  const rows = catOrder
    .filter(cat => (Number(projet.quotas?.[cat]) || 0) > 0)
    .map(cat => {
      const c        = CATEGORIES[cat];
      const quotaH   = Number(projet.quotas[cat]) || 0;
      const quotaMin = Math.round(quotaH * 60);
      const eff      = effMin[cat] ?? 0;
      const rawPct   = quotaMin > 0 ? Math.round((eff / quotaMin) * 100) : 0;
      const visPct   = Math.min(100, rawPct);

      // Couleur fill : < 80 → catégorie · 80-99 → orange · ≥ 100 → rouge
      const fillColor = rawPct >= 100 ? '#E07878'
        : rawPct >= 80              ? '#E09050'
        : c.color;
      const isOver = rawPct >= 100;

      return `
        <div class="quota-row">
          <div class="quota-row-head">
            <div class="quota-dot" style="background:${c.color}"></div>
            <span class="quota-cat-label">${c.label}</span>
            <span class="quota-time${isOver ? ' is-over' : ''}">
              ${_fmtDuree(eff)} / ${_fmtDuree(quotaMin)}
            </span>
          </div>
          <div class="quota-track">
            <div class="quota-fill"
              style="width:${visPct}%;background:${fillColor};"></div>
          </div>
        </div>`;
    });

  if (rows.length === 0) {
    return `<p class="quota-bars-empty">Définis tes quotas dans l'onglet Préparer.</p>`;
  }
  return rows.join('');
}

function _updateQuotaBars(projet) {
  const el = $('quotaBars');
  if (!el) return;
  el.innerHTML = `<p class="quota-bars-title">Quotas</p>${_renderQuotaBars(projet)}`;
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

  // ── Référence taux : réel si sessions existent, offre sinon ──
  // (suit exactement la logique de la spec : réel > offre > vide)
  const refTaux = tauxReel !== null ? tauxReel
    : tauxOffre !== null            ? tauxOffre
    : null;

  // ── Verdict : basé sur l'existence de refTaux, puis sur taux profil ──
  let clsBilan, verdictIcon, verdictText;
  if (refTaux === null) {
    clsBilan = 'is-neutral'; verdictIcon = '○'; verdictText = 'Données incomplètes';
  } else if (!hasTaux()) {
    clsBilan = 'is-neutral'; verdictIcon = '·'; verdictText = 'Configure ton taux dans Profil';
  } else {
    const { tauxPlancher, tauxCible } = state.user;
    if      (refTaux >= tauxCible)    { clsBilan = 'is-profit'; verdictIcon = '✓'; verdictText = 'Projet rentable'; }
    else if (refTaux >= tauxPlancher) { clsBilan = 'is-warn';   verdictIcon = '≈'; verdictText = 'Marge serrée'; }
    else                              { clsBilan = 'is-loss';   verdictIcon = '↓'; verdictText = 'Sous le plancher'; }
  }

  // ── Classe couleur pour les valeurs de taux ──
  function _cls(taux) {
    if (taux === null || !hasTaux()) return 'is-neutral';
    const { tauxPlancher, tauxCible } = state.user;
    if (taux >= tauxCible)    return 'is-profit';
    if (taux >= tauxPlancher) return 'is-warn';
    return 'is-loss';
  }

  // ── Barre de performance (plafonnée visuellement à 100%, mais clsBilan vert si > 100) ──
  let barPct = 0;
  if (refTaux !== null && hasTaux() && state.user.tauxCible > 0) {
    barPct = Math.round((refTaux / state.user.tauxCible) * 100);
  }
  const barWidth = Math.min(100, barPct);

  // Couleur revenu net
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

      <!-- ── Photos ── -->
      ${(() => {
        const cmd = Number(projet.photosCommandees) || 0;
        const liv = Number(projet.photosLivrees)    || 0;
        const prixParPhoto = cmd > 0 && prixFacture > 0
          ? Math.round(prixFacture / cmd) : null;
        const delta = cmd > 0 ? liv - cmd : null;
        const deltaSign = delta === null ? '' : delta > 0 ? `+${delta}` : `${delta}`;
        const deltaCls  = delta === null ? '' : delta > 0 ? 'is-warn' : delta < 0 ? 'is-neutral' : '';
        return `
      <div class="glass-card bilan-section">
        <p class="bilan-section-title">Photos</p>
        <div class="bilan-row">
          <span class="bilan-row-label">Commandées</span>
          <span class="bilan-row-value">${cmd > 0 ? cmd : '—'}</span>
        </div>
        <div class="bilan-row">
          <span class="bilan-row-label">Livrées</span>
          <div class="bilan-photos-edit">
            <input id="photosLivreesInput" class="bilan-photos-input"
              type="number" min="0" step="1" inputmode="numeric"
              placeholder="—"
              value="${projet.photosLivrees ?? ''}" />
            ${delta !== null ? `<span class="bilan-photos-badge ${deltaCls}">${deltaSign}</span>` : ''}
          </div>
        </div>
        ${prixParPhoto !== null ? `
        <div class="bilan-row">
          <span class="bilan-row-label">CHF / photo</span>
          <span class="bilan-row-value">${prixParPhoto} CHF</span>
        </div>` : ''}
      </div>`;
      })()}

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
        ${barWidth > 0 ? `
        <div class="bilan-bar-wrap">
          <div class="bilan-bar-fill ${clsBilan}" style="width:${barWidth}%"></div>
        </div>` : ''}
      </div>

      <!-- ── Verdict ── -->
      <div class="glass-card bilan-verdict">
        <p class="bilan-verdict-label">Verdict</p>
        <div class="bilan-verdict-icon ${clsBilan}">${verdictIcon}</div>
        <p class="bilan-verdict-text ${clsBilan}">${verdictText}</p>
      </div>

      <!-- ── Clôture ── -->
      ${projet.statut === 'termine'
        ? `<div class="bilan-termine-badge">Projet terminé ✓</div>`
        : `<button class="btn-action" id="btnCloturerProjet" type="button">
            Clôturer le projet ✓
          </button>`}

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
  // Le contenu est maintenant dans l'accordéon body[data-acc-body="materiel"]
  const body = document.querySelector('[data-acc-body="materiel"]');
  if (!body) { _refreshProjetSubView(); return; }
  body.innerHTML = _renderChecklistSection(projet);
  _wireChecklistSection(projet);
  $('btnGoToProfil')?.addEventListener('click', () => navigateTo('profil'));
}

// _ensureChecklist supprimé — remplacé par la logique matériel profil (Phase 4)

// ════════════════════════════════════════════════════════
// ACCORDÉONS — générique, réutilisable
// ════════════════════════════════════════════════════════

function _wireAccordions() {
  document.querySelectorAll('[data-acc-btn]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key  = btn.dataset.accBtn;
      const body = document.querySelector(`[data-acc-body="${key}"]`);
      if (!body) return;
      const isOpen = !body.classList.contains('is-closed');
      body.classList.toggle('is-closed', isOpen);
      btn.setAttribute('aria-expanded', String(!isOpen));
      const chevron = btn.querySelector('.accordion-chevron');
      if (chevron) chevron.classList.toggle('is-open', !isOpen);
    });
  });
}

function _ico_folder_lg() {
  return `<svg class="empty-icon" width="52" height="52" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.3"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>`;
}

function _viewInsights() {
  const termines = state.projets.filter(p => p.statut === 'termine');
  const manquent = Math.max(0, 3 - termines.length);

  return `
    <div class="empty-state-view">
      ${_ico_empty_flash()}
      <p class="empty-state-title">${
        manquent > 0
          ? `${manquent} projet${manquent > 1 ? 's' : ''} terminé${manquent > 1 ? 's' : ''} de plus pour débloquer tes insights.`
          : '3 projets terminés pour débloquer tes insights.'
      }</p>
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
      ${(() => {
        const mode = u.profilMode ?? 'simple';
        return `
      <div class="profil-section glass-card">
        <p class="profil-section-title">Objectifs financiers</p>

        <!-- Toggle simple / avancé -->
        <div class="profil-mode-toggle" id="profilModeToggle">
          <button class="profil-mode-btn${mode === 'simple' ? ' is-active' : ''}"
            data-mode="simple" type="button">Simple</button>
          <button class="profil-mode-btn${mode === 'avance' ? ' is-active' : ''}"
            data-mode="avance" type="button">Avancé</button>
        </div>

        <!-- Mode simple : saisie directe du taux cible -->
        <div id="pfModeSimple"${mode !== 'simple' ? ' class="is-hidden"' : ''}>
          <label for="pfTauxCible">
            Taux horaire cible (CHF/h)
            <input id="pfTauxCible" type="number"
              placeholder="120" min="0" step="5"
              inputmode="numeric"
              value="${u.tauxCible ?? ''}" />
          </label>
          <p class="profil-section-hint" style="margin:4px 0 0;">
            Le plancher sera calculé à 75 % de cette valeur.
          </p>
        </div>

        <!-- Mode avancé : calcul depuis revenus/jours/charges -->
        <div id="pfModeAvance"${mode !== 'avance' ? ' class="is-hidden"' : ''}>
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
        </div>

        <!-- Preview taux (commun aux deux modes) -->
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
      </div>`;
      })()}

      <!-- ── Enregistrer ── -->
      <button class="btn-action" id="btnSaveProfil" type="button">
        Enregistrer
      </button>

      <!-- ── Mon matériel (accordéon) ── -->
      ${(() => {
        const hasMat = (state.user?.materiel ?? []).filter(m => m.actif !== false).length > 0;
        return `
      <div class="accordion profil-section glass-card" data-acc="profil-mat">
        <button class="accordion-header" type="button"
          aria-expanded="${hasMat}" data-acc-btn="profil-mat">
          <span class="accordion-title">Mon matériel habituel</span>
          <svg class="accordion-chevron${hasMat ? ' is-open' : ''}" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
        <div class="accordion-body${hasMat ? '' : ' is-closed'}" data-acc-body="profil-mat">
          <p class="profil-section-hint" style="margin:0 0 8px;">
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
      </div>`;
      })()}

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
  // Accordéons Profil
  _wireAccordions();

  // Initialiser le mode depuis les données sauvegardées
  _profilMode = state.user?.profilMode ?? 'simple';

  // Toggle simple / avancé
  document.querySelectorAll('.profil-mode-btn').forEach(btn =>
    btn.addEventListener('click', e => {
      _profilMode = e.currentTarget.dataset.mode;
      document.querySelectorAll('.profil-mode-btn').forEach(b =>
        b.classList.toggle('is-active', b.dataset.mode === _profilMode)
      );
      $('pfModeSimple')?.classList.toggle('is-hidden', _profilMode !== 'simple');
      $('pfModeAvance')?.classList.toggle('is-hidden', _profilMode !== 'avance');
      _updateTauxPreview();
    })
  );

  // Inputs live-preview
  ['pfTauxCible', 'pfRevenu', 'pfJours', 'pfCharges'].forEach(id =>
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
  let plancher, cible;
  if (_profilMode === 'simple') {
    cible    = Number($('pfTauxCible')?.value) || 0;
    plancher = Math.round(cible * 0.75);
  } else {
    const revenu  = Number($('pfRevenu')?.value)  || 0;
    const jours   = Number($('pfJours')?.value)   || 15;
    const charges = Number($('pfCharges')?.value) || 0;
    ({ plancher, cible } = _calcTaux(revenu, jours, charges));
  }
  const pEl = $('pfPlancherVal');
  const cEl = $('pfCibleVal');
  if (pEl) pEl.textContent = plancher > 0 ? `CHF ${plancher}/h` : '—';
  if (cEl) cEl.textContent = cible    > 0 ? `CHF ${cible}/h`    : '—';
}

function _saveProfil() {
  const prenom     = $('pfPrenom')?.value.trim()    ?? '';
  const specialite = $('pfSpecialite')?.value        ?? '';
  let tauxPlancher, tauxCible, revenuCible, joursFact, charges;

  if (_profilMode === 'simple') {
    tauxCible    = Number($('pfTauxCible')?.value) || 0;
    tauxPlancher = Math.round(tauxCible * 0.75);
    // Conserver les données avancées précédentes si elles existent
    revenuCible  = state.user?.revenuCible ?? 0;
    joursFact    = state.user?.joursFact   ?? 15;
    charges      = state.user?.charges     ?? 0;
  } else {
    revenuCible  = Number($('pfRevenu')?.value)  || 0;
    joursFact    = Number($('pfJours')?.value)   || 15;
    charges      = Number($('pfCharges')?.value) || 0;
    const calc   = _calcTaux(revenuCible, joursFact, charges);
    tauxPlancher = calc.plancher;
    tauxCible    = calc.cible;
  }

  state.user = {
    prenom, specialite, revenuCible, joursFact, charges,
    tauxPlancher, tauxCible,
    materiel:   state.user?.materiel   ?? [], // préservé — géré indépendamment
    profilMode: _profilMode,
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

// ── Icônes état vide ────────────────────────────────────

function _ico_empty_tripod() {
  return `<svg class="empty-state-icon" width="80" height="80" viewBox="0 0 80 80"
    fill="none" stroke="rgba(20,40,60,0.2)" stroke-width="1.5"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <!-- tête -->
    <rect x="24" y="14" width="32" height="18" rx="4"/>
    <circle cx="40" cy="23" r="5"/>
    <!-- pied central -->
    <line x1="40" y1="32" x2="40" y2="58"/>
    <!-- pieds latéraux -->
    <line x1="40" y1="48" x2="20" y2="68"/>
    <line x1="40" y1="48" x2="60" y2="68"/>
    <!-- tablette -->
    <line x1="30" y1="57" x2="50" y2="57"/>
  </svg>`;
}

function _ico_empty_lens() {
  return `<svg class="empty-state-icon" width="80" height="80" viewBox="0 0 80 80"
    fill="none" stroke="rgba(20,40,60,0.2)" stroke-width="1.5"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <!-- objectif — cercles concentriques -->
    <circle cx="40" cy="40" r="26"/>
    <circle cx="40" cy="40" r="18"/>
    <circle cx="40" cy="40" r="9"/>
    <!-- traits de mise au point -->
    <line x1="40" y1="10" x2="40" y2="16"/>
    <line x1="40" y1="64" x2="40" y2="70"/>
    <line x1="10" y1="40" x2="16" y2="40"/>
    <line x1="64" y1="40" x2="70" y2="40"/>
  </svg>`;
}

function _ico_empty_flash() {
  return `<svg class="empty-state-icon" width="80" height="80" viewBox="0 0 80 80"
    fill="none" stroke="rgba(20,40,60,0.2)" stroke-width="1.5"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <!-- éclair -->
    <polyline points="46,10 30,42 42,42 34,70 54,34 42,34"/>
  </svg>`;
}

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
