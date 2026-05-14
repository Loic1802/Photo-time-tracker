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
  brouillon:     { label: 'Brouillon',      color: 'rgba(30,50,70,0.35)', bg: 'rgba(30,50,70,0.07)'   },
  offreenvoyee:  { label: 'Offre envoyée',  color: '#3A7ABF',             bg: 'rgba(58,122,191,0.12)' },
  offreacceptee: { label: 'Offre acceptée', color: '#5AAE82',             bg: 'rgba(90,174,130,0.12)' },
  avenir:        { label: 'À venir',        color: '#3A7ABF',             bg: 'rgba(58,122,191,0.12)' },
  encours:       { label: 'En cours',       color: '#2E7D52',             bg: 'rgba(46,125,82,0.12)'  },
  atraiter:      { label: 'À traiter',      color: '#B8600A',             bg: 'rgba(213,112,10,0.13)' },
  termine:       { label: 'Terminé',        color: '#2E7D52',             bg: 'rgba(46,125,82,0.13)'  },
  sanssuite:     { label: 'Sans suite',     color: 'rgba(30,50,70,0.25)', bg: 'rgba(30,50,70,0.05)'   },
  // rétro-compat données existantes avec statut 'attente'
  attente:       { label: 'Offre envoyée',  color: '#3A7ABF',             bg: 'rgba(58,122,191,0.12)' },
};

// ════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════

const state = {
  currentView:    'studio',
  user:           Storage.get('user')     ?? null,
  contacts:       Storage.get('contacts') ?? [],
  projets:        Storage.get('projets')  ?? [],
  activeProjetId: null,   // projet sélectionné dans Terrain
  projetSubView:  'brief', // sous-onglet actif (brief/chrono/frais/bilan)
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
  { id: 'studio',      label: 'Studio',  icon: _ico_folder()  },
  { id: 'terrain',     label: 'Terrain', icon: _ico_camera()  },
  { id: 'prospection', label: 'À venir', icon: _ico_users()   },
  { id: 'insight',     label: 'Insight', icon: _ico_chart()   },
  { id: 'moi',         label: 'Moi',     icon: _ico_user()    },
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
    // v2→v3 : attente → offreenvoyee
    if (state.projets[i].statut === 'attente') {
      state.projets[i].statut = 'offreenvoyee';
      changed = true;
    }
    // v3→v4 : frais réels — champ categorie absent
    (state.projets[i].frais ?? []).forEach((f, fi) => {
      if (!f.categorie) {
        state.projets[i].frais[fi].categorie = 'autre';
        changed = true;
      }
    });
    // v3→v4 : feuilleRoute — champs contact séparés
    const fr = state.projets[i].feuilleRoute;
    if (fr && fr.telephone === undefined) {
      fr.telephone = '';
      fr.email     = '';
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

  // FAB : masqué sur Moi et Ficheoffre
  const fab = $('fabGlobal');
  if (fab) fab.style.display = (view === 'moi' || view === 'ficheoffre') ? 'none' : '';

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
  if (view === 'ficheoffre') {
    const p = state.projets.find(x => x.id === state.activeProjetId);
    const eyebrow = $('topbarEyebrow');
    eyebrow.textContent = '← Studio';
    eyebrow.style.cursor = 'pointer';
    eyebrow.style.color  = '#3A7ABF';
    eyebrow.onclick = () => navigateTo('studio');
    $('topbarTitle').textContent = p ? p.nom : 'Fiche offre';
    $('topbarAction').hidden = true;
    return;
  }
  const eyebrowEl = $('topbarEyebrow');
  eyebrowEl.style.cursor = '';
  eyebrowEl.style.color  = '';
  eyebrowEl.onclick = null;
  eyebrowEl.textContent = `Frames · ${mois} ${an}`;
  $('topbarTitle').textContent   = TABS.find(t => t.id === view)?.label ?? 'Frames';
  $('topbarAction').hidden = view !== 'studio';
}

function _wireTopbarAction(view) {
  // Clone pour effacer les anciens listeners sans removeEventListener
  const old   = $('topbarAction');
  const fresh = old.cloneNode(true);
  old.parentNode.replaceChild(fresh, old);

  if (view === 'studio') fresh.addEventListener('click', _openNewProjectSheet);
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
    case 'ficheoffre':
      el.innerHTML = _viewFicheOffre();
      _wireFicheOffre();
      break;
    case 'terrain':
      el.innerHTML = _viewTerrain();
      _wireTerrain();
      break;
    case 'prospection':
      el.innerHTML = _viewProspection();
      _wireProspection();
      break;
    case 'insight':
      el.innerHTML = _viewInsights();
      break;
    case 'moi':
      el.innerHTML = _viewProfil();
      _wireProfilView();
      break;
    // Alias rétro-compat (anciens bookmarks)
    case 'insights': el.innerHTML = _viewInsights(); break;
    case 'profil':   el.innerHTML = _viewProfil(); _wireProfilView(); break;
    default:         el.innerHTML = '';
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
  packshot:   'Packshot',
  editorial:  'Éditorial',
  autre:      'Autre',
};

// ════════════════════════════════════════════════════════
// MODULE FICHE OFFRE — Phase 2
// ════════════════════════════════════════════════════════

const DROITS_OPTIONS = [
  { key: 'aucun',      label: 'Aucun droit cédé',              pct: 0    },
  { key: 'prive',      label: 'Usage privé',                    pct: 0    },
  { key: 'comm_local', label: 'Commercial local (1 an)',         pct: 0.15 },
  { key: 'comm_nat',   label: 'Commercial national (2 ans)',     pct: 0.25 },
  { key: 'comm_world', label: 'Commercial mondial illimité',     pct: 0.40 },
  { key: 'editorial',  label: 'Éditorial / presse',              pct: 0.10 },
];

function _ensureOffreFields(p) {
  if (!p.typeClient)             p.typeClient        = 'nouveau';
  if (p.noteInterne   == null)   p.noteInterne       = '';
  if (p.videosCommandees == null) p.videosCommandees = 0;
  if (p.roundsRevisions  == null) p.roundsRevisions  = 1;
  if (!p.modeFacturation)        p.modeFacturation   = 'forfait';
  if (p.forfaitJours  == null)   p.forfaitJours      = 0;
  if (!p.droitsUtilisation)      p.droitsUtilisation = 'aucun';
  if (!p.fraisEstimes)           p.fraisEstimes      = { deplacement: 0, repas: 0, hebergement: 0, materiel: 0, autre: 0 };
  if (p.acompte       == null)   p.acompte           = 30;
  if (p.delaiLivraison == null)  p.delaiLivraison    = 14;
  if (p.dateEnvoi     == null)   p.dateEnvoi         = null;
  if (p.joursShooting == null)   p.joursShooting     = 1;
}

function _calcPerdiem(p) {
  const h = Number(p.quotas?.shooting ?? 0);
  return Math.round((h / 8) * (state.user?.perdiem ?? 50));
}

function _calcTotalFraisEstimes(p) {
  return Object.values(p.fraisEstimes ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);
}

function _getDroitsPct(key) {
  return DROITS_OPTIONS.find(o => o.key === key)?.pct ?? 0;
}

// Retourne { prix, tauxMoyen, count } ou null si pas assez de données
function _prixConseilleSimil(p) {
  function _tempsReelH(proj) {
    return (proj.sessions ?? []).reduce((s, x) => s + (Number(x.duree) || 0), 0) / 60;
  }
  const similaires = state.projets.filter(x =>
    x.id !== p.id && x.type === p.type && x.statut === 'termine'
    && Number(x.prixFacture) > 0 && _tempsReelH(x) > 0
  );
  if (!similaires.length) return null;

  const totalPrix   = similaires.reduce((s, x) => s + Number(x.prixFacture), 0);
  const totalHeures = similaires.reduce((s, x) => s + _tempsReelH(x), 0);
  const tauxMoyen   = totalPrix / totalHeures;

  // Prix pour ce projet : quotas estimés × taux moyen + frais estimés
  const quotasH   = Object.values(p.quotas ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);
  const fraisEst  = _calcTotalFraisEstimes(p);
  const prix      = Math.round(quotasH * tauxMoyen + fraisEst);

  return { prix, tauxMoyen: Math.round(tauxMoyen), count: similaires.length };
}

function _prixConseilleQuotas(p) {
  const taux = Number(state.user?.tauxCible ?? 0);
  if (!taux) return null;
  const heures = Object.values(p.quotas ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);
  const base   = heures * taux;
  const frais  = _calcTotalFraisEstimes(p);
  const droits = _getDroitsPct(p.droitsUtilisation ?? 'aucun');
  return Math.round(base * (1 + droits) + frais);
}

function _renderPrixConseille(p) {
  const simil  = _prixConseilleSimil(p);   // { prix, tauxMoyen, count } | null
  const quotas = _prixConseilleQuotas(p);  // nombre | null

  const quotasH  = Object.values(p.quotas ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);
  const fraisEst = _calcTotalFraisEstimes(p);
  const typeLbl  = p.type
    ? (p.type.charAt(0).toUpperCase() + p.type.slice(1)) : 'ce type';

  // Ligne similaires
  let similRow;
  if (simil) {
    similRow = `
      <div class="fo-prix-item">
        <div class="fo-prix-item-main">
          <span class="fo-prix-label">Projets similaires</span>
          <span class="fo-prix-val" id="foPrixSimil">${_fmtCHF(simil.prix)}</span>
        </div>
        <span class="fo-prix-detail">${simil.tauxMoyen} CHF/h moyen · ${simil.count} projet${simil.count > 1 ? 's' : ''} ${typeLbl}</span>
      </div>`;
  } else {
    similRow = `
      <div class="fo-prix-item">
        <div class="fo-prix-item-main">
          <span class="fo-prix-label">Projets similaires</span>
          <span class="fo-prix-val is-neutral" id="foPrixSimil">—</span>
        </div>
        <span class="fo-prix-detail">Pas encore assez de données</span>
      </div>`;
  }

  // Ligne quotas × taux
  let quotasRow;
  if (quotas != null) {
    const base    = Math.round(quotasH * (state.user?.tauxCible ?? 0));
    const details = [
      quotasH > 0 ? `${_fmtH(quotasH)} × ${state.user.tauxCible} CHF/h` : null,
      fraisEst > 0 ? `+ ${_fmtCHF(fraisEst)} frais` : null,
    ].filter(Boolean).join(' ');
    quotasRow = `
      <div class="fo-prix-item">
        <div class="fo-prix-item-main">
          <span class="fo-prix-label">Quotas × taux cible</span>
          <span class="fo-prix-val" id="foPrixQuotas">${_fmtCHF(quotas)}</span>
        </div>
        ${details ? `<span class="fo-prix-detail">${details}</span>` : ''}
      </div>`;
  } else {
    quotasRow = `
      <div class="fo-prix-item">
        <div class="fo-prix-item-main">
          <span class="fo-prix-label">Quotas × taux cible</span>
          <span class="fo-prix-val is-neutral" id="foPrixQuotas">—</span>
        </div>
        <span class="fo-prix-detail">Configure ton taux dans Profil</span>
      </div>`;
  }

  return `<div class="fo-prix-conseil">${similRow}<div class="fo-prix-sep"></div>${quotasRow}</div>`;
}

function _renderOffreActions(p) {
  if (p.statut === 'brouillon') {
    return `
      <button class="btn-action" id="btnEnvoyerOffre" type="button">
        Envoyer l'offre →
      </button>`;
  }
  if (p.statut === 'offreenvoyee' || p.statut === 'attente') {
    const jours = p.dateEnvoi
      ? Math.floor((Date.now() - new Date(p.dateEnvoi)) / 86400000)
      : null;
    return `
      ${jours != null ? `<p class="fo-envoi-date">Envoyée il y a ${jours}j</p>` : ''}
      <button class="btn-action" id="btnAccepterOffre" type="button">
        Offre acceptée ✓
      </button>
      <button class="btn-action btn-secondary" id="btnMajOffre" type="button">
        Offre mise à jour et renvoyée →
      </button>
      <button class="fo-corriger-btn" id="btnSansSuiteOffre" type="button">
        Sans suite
      </button>`;
  }
  return '';
}

function _viewFicheOffre() {
  const p = state.projets.find(x => x.id === state.activeProjetId);
  if (!p) return `<div class="fo-view"><p style="padding:32px;text-align:center;opacity:.4;">Projet introuvable.</p></div>`;

  _ensureOffreFields(p);
  save.projets();

  const locked = p.statut === 'offreacceptee';
  const dis    = locked ? ' disabled' : '';

  const typeOptions = [
    ['corporate','Corporate'], ['portrait','Portrait'], ['mariage','Mariage'],
    ['event','Événement'], ['commercial','Commercial'],
    ['packshot','Packshot'], ['editorial','Éditorial'], ['autre','Autre'],
  ];
  const totalFrais = _calcTotalFraisEstimes(p);
  const perdiem    = _calcPerdiem(p);

  return `
    <div class="fo-view">

      ${locked ? `
      <!-- Bandeau verrouillé -->
      <div class="fo-locked-banner">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        Offre acceptée — fiche verrouillée
      </div>` : ''}

      <!-- 1 · Infos projet -->
      <div class="fo-section glass-card">
        <p class="fo-section-title">Infos projet</p>
        <label for="foNom">Nom du projet
          <input id="foNom" type="text" value="${_esc(p.nom)}"
            autocomplete="off" data-field="nom"${dis} />
        </label>
        <label for="foClientNom">Client
          <input id="foClientNom" type="text" value="${_esc(p.clientNom ?? '')}"
            autocomplete="off" placeholder="Nom du client" data-field="clientNom"${dis} />
        </label>
        <div class="form-row">
          <label for="foType">Type
            <select id="foType" data-field="type"${dis}>
              ${typeOptions.map(([v, l]) =>
                `<option value="${v}"${p.type === v ? ' selected' : ''}>${l}</option>`
              ).join('')}
            </select>
          </label>
          <label>Relation client
            <div class="fo-radio-group">
              <label class="fo-radio">
                <input type="radio" name="foTypeClient" value="nouveau"
                  ${p.typeClient !== 'fidele' ? 'checked' : ''}${dis} />
                Nouveau
              </label>
              <label class="fo-radio">
                <input type="radio" name="foTypeClient" value="fidele"
                  ${p.typeClient === 'fidele' ? 'checked' : ''}${dis} />
                Fidèle
              </label>
            </div>
          </label>
        </div>
        <label for="foNoteInterne">Note interne
          <textarea id="foNoteInterne" rows="2"
            placeholder="Remarques privées, contexte, historique…"
            data-field="noteInterne"${dis}>${_esc(p.noteInterne ?? '')}</textarea>
        </label>
      </div>

      <!-- 2 · Livrables -->
      <div class="fo-section glass-card">
        <p class="fo-section-title">Livrables</p>
        <div class="form-row">
          <label for="foPhotos">Photos livrées
            <input id="foPhotos" type="number" min="0" step="1" inputmode="numeric"
              value="${p.photosCommandees ?? ''}" placeholder="0"
              data-field="photosCommandees"${dis} />
          </label>
          <label for="foVideos">Vidéos
            <input id="foVideos" type="number" min="0" step="1" inputmode="numeric"
              value="${p.videosCommandees ?? ''}" placeholder="0"
              data-field="videosCommandees"${dis} />
          </label>
        </div>
        <div class="form-row">
          <label for="foRevisions">Rounds retouches
            <input id="foRevisions" type="number" min="0" step="1" inputmode="numeric"
              value="${p.roundsRevisions ?? 1}" placeholder="1"
              data-field="roundsRevisions"${dis} />
          </label>
          <label for="foDelai">Délai livraison (j)
            <input id="foDelai" type="number" min="0" step="1" inputmode="numeric"
              value="${p.delaiLivraison ?? 14}" placeholder="14"
              data-field="delaiLivraison"${dis} />
          </label>
        </div>
        <label for="foDateShooting">Date prévue
          <input id="foDateShooting" type="date"
            value="${p.dateShooting ?? ''}"
            data-field="dateShooting"${dis} />
        </label>
      </div>

      <!-- 3 · Mode facturation -->
      <div class="fo-section glass-card">
        <p class="fo-section-title">Mode de facturation</p>
        <div class="fo-radio-group fo-radio-group--row">
          <label class="fo-radio">
            <input type="radio" name="foModeFactu" value="forfait"
              ${p.modeFacturation === 'forfait' ? 'checked' : ''}${dis} />
            Forfait
          </label>
          <label class="fo-radio">
            <input type="radio" name="foModeFactu" value="taux"
              ${p.modeFacturation === 'taux' ? 'checked' : ''}${dis} />
            Taux horaire
          </label>
          <label class="fo-radio">
            <input type="radio" name="foModeFactu" value="jour"
              ${p.modeFacturation === 'jour' ? 'checked' : ''}${dis} />
            Jour
          </label>
        </div>
        <div id="foForfaitJoursRow" class="${p.modeFacturation !== 'jour' ? 'is-hidden' : ''}">
          <label for="foForfaitJours">Nombre de jours
            <input id="foForfaitJours" type="number" min="0.5" step="0.5" inputmode="decimal"
              value="${p.forfaitJours || ''}" placeholder="1"
              data-field="forfaitJours"${dis} />
          </label>
        </div>
      </div>

      <!-- 4 · Temps estimés -->
      <div class="fo-section glass-card">
        <p class="fo-section-title">Temps estimés</p>
        <!-- Jours de shooting -->
        <div class="fo-quota-row fo-jours-row">
          <span class="fo-quota-label">Jours de shooting</span>
          <input id="foJoursShooting" type="number" min="1" step="1" inputmode="numeric"
            value="${p.joursShooting ?? 1}" placeholder="1"
            class="fo-jours-input"
            data-field="joursShooting"${dis} />
        </div>
        ${Number(p.joursShooting) > 1 ? `
        <p class="fo-jours-hint" id="foJoursHint">
          ${p.joursShooting} jour${p.joursShooting > 1 ? 's' : ''} × ${_fmtTimePicker(Number(p.quotas?.shooting ?? 0) / (p.joursShooting || 1))} / jour
        </p>` : ''}
        <!-- Quotas par catégorie -->
        ${Object.entries(CATEGORIES).map(([cat, info]) => {
          const hVal = Number(p.quotas?.[cat]) || 0;
          return `
          <div class="fo-quota-row">
            <span class="fo-quota-label">${info.label}</span>
            <button class="time-picker-btn${locked ? ' is-locked' : ''}"
              type="button" data-quota="${cat}"
              ${locked ? 'disabled' : ''}
              aria-label="${info.label} : ${_fmtTimePicker(hVal)}">
              ${_fmtTimePicker(hVal)}
            </button>
          </div>`;
        }).join('')}
        <div class="fo-quota-total" id="foQuotaTotal">
          Total : <strong>${_fmtH(Object.values(p.quotas ?? {}).reduce((s,v)=>s+(Number(v)||0),0))}</strong>
        </div>
        <!-- Perdiem — masqué par défaut, activable -->
        <div class="fo-perdiem-toggle">
          <button class="btn-text-muted fo-perdiem-toggle-btn" id="btnTogglePerdiem" type="button">
            ${p.fraisEstimes?.perdiem > 0 ? '▾ Masquer le perdiem' : '+ Ajouter un perdiem'}
          </button>
          <div id="foPerdiemSection" style="${p.fraisEstimes?.perdiem > 0 ? '' : 'display:none;'}">
            <p class="fo-perdiem-hint" id="foPerdiemHint">
              ${perdiem > 0
                ? `Perdiem estimé : <strong>${_fmtCHF(perdiem)}</strong>
                   (${p.quotas?.shooting ?? 0}h shooting ÷ 8 × ${state.user?.perdiem ?? 50} CHF/j)`
                : 'Ajoute les jours de shooting et configure ton perdiem dans Profil.'}
            </p>
          </div>
        </div>
      </div>

      <!-- 5 · Droits d'utilisation -->
      <div class="fo-section glass-card">
        <p class="fo-section-title">Droits d'utilisation</p>
        <label for="foDroits">
          <select id="foDroits" data-field="droitsUtilisation"${dis}>
            ${DROITS_OPTIONS.map(o =>
              `<option value="${o.key}"${p.droitsUtilisation === o.key ? ' selected' : ''}>${o.label}${o.pct > 0 ? ` (+${Math.round(o.pct * 100)} %)` : ''}</option>`
            ).join('')}
          </select>
        </label>
      </div>

      <!-- 6 · Frais estimés -->
      <div class="fo-section glass-card">
        <p class="fo-section-title">Frais estimés (CHF)</p>
        ${[
          ['deplacement', 'Déplacement'],
          ['repas',       'Repas'],
          ['hebergement', 'Hébergement'],
          ['materiel',    'Matériel loué'],
          ['autre',       'Autre'],
        ].map(([k, l]) => `
          <label for="foFrais_${k}">${l}
            <input id="foFrais_${k}" type="number" min="0" step="5" inputmode="numeric"
              value="${p.fraisEstimes?.[k] ?? 0}" placeholder="0"
              data-frais="${k}"${dis} />
          </label>`).join('')}
        <div class="fo-frais-total" id="foFraisTotal">
          Total frais : <strong>${_fmtCHF(totalFrais)}</strong>
        </div>
      </div>

      <!-- 7 · Prix -->
      <div class="fo-section glass-card">
        <p class="fo-section-title">Prix</p>
        <p class="fo-section-hint">Prix conseillé</p>
        ${_renderPrixConseille(p)}
        <label for="foPrixFacture">Prix de l'offre (CHF)
          <input id="foPrixFacture" type="number" min="0" step="50" inputmode="numeric"
            value="${p.prixFacture ?? ''}" placeholder="0"
            data-field="prixFacture"${dis} />
        </label>
        <label for="foAcompte">Acompte (%)
          <input id="foAcompte" type="number" min="0" max="100" step="5" inputmode="numeric"
            value="${p.acompte ?? 30}" placeholder="30"
            data-field="acompte"${dis} />
        </label>
        <p class="fo-acompte-hint" id="foAcompteVal">${
          p.prixFacture && p.acompte
            ? `Acompte : ${_fmtCHF(Math.round(Number(p.prixFacture) * Number(p.acompte) / 100))}`
            : ''
        }</p>
      </div>

      <!-- 8 · Actions -->
      <div class="fo-section fo-section-actions">
        ${locked ? '' : _renderOffreActions(p)}
      </div>

      ${locked ? `
      <!-- Corriger une erreur (usage exceptionnel) -->
      <div class="fo-corriger-wrap">
        <button class="fo-corriger-btn" id="btnCorrigerErreur" type="button">
          Corriger une erreur
        </button>
      </div>` : ''}

      <div style="height:calc(env(safe-area-inset-bottom,16px) + 32px)"></div>
    </div>`;
}

// ─── Picker roue — temps estimés ───────────────────────

function _fmtTimePicker(h) {
  if (!h || h <= 0) return '—';
  const totalMin = Math.round(h * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  if (hh === 0)        return `${mm}min`;
  if (mm === 0)        return `${hh}h`;
  return `${hh}h${String(mm).padStart(2, '0')}`;
}

function _openTimePicker(cat, currentH, onConfirm) {
  if (document.querySelector('.bottom-sheet')) return;

  const totalMin    = Math.round((currentH || 0) * 60);
  const initH       = Math.floor(totalMin / 60);
  const initMRaw    = totalMin % 60;
  const MINS        = [0, 15, 30, 45];
  const initMIdx    = MINS.reduce((best, m, i) =>
    Math.abs(m - initMRaw) < Math.abs(MINS[best] - initMRaw) ? i : best, 0);

  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  overlay.id = 'sheetOverlay';
  overlay.addEventListener('click', _closeSheet);

  const sheet = document.createElement('div');
  sheet.className = 'bottom-sheet';
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <h2 class="sheet-title">Durée estimée</h2>
      <button class="icon-button" id="closePickerSheet" type="button" aria-label="Fermer">
        <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="time-picker-wrap">
      <div class="time-picker-highlight" aria-hidden="true"></div>
      <div class="time-picker-col" id="pickerHours" role="listbox" aria-label="Heures">
        ${Array.from({length: 13}, (_, i) =>
          `<div class="time-picker-item" data-val="${i}" role="option">${i}h</div>`
        ).join('')}
      </div>
      <div class="time-picker-col" id="pickerMins" role="listbox" aria-label="Minutes">
        ${MINS.map(m =>
          `<div class="time-picker-item" data-val="${m}" role="option">${String(m).padStart(2,'0')}</div>`
        ).join('')}
      </div>
    </div>
    <div class="sheet-form" style="padding-top:0;">
      <div class="form-row">
        <button class="btn-secondary" id="btnPickerCancel" type="button">Annuler</button>
        <button class="btn-action" id="btnPickerConfirm" type="button">Confirmer</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  document.body.appendChild(sheet);

  // Positionner les roues sur la valeur initiale
  const ITEM_H = 44;
  const colH   = document.querySelector('.time-picker-col');
  // Scroll après paint
  requestAnimationFrame(() => {
    overlay.classList.add('is-visible');
    sheet.classList.add('is-open');
    const hCol = $('pickerHours');
    const mCol = $('pickerMins');
    if (hCol) hCol.scrollTop = initH * ITEM_H;
    if (mCol) mCol.scrollTop = initMIdx * ITEM_H;
  });

  sheet.querySelector('#closePickerSheet').addEventListener('click', _closeSheet);
  sheet.querySelector('#btnPickerCancel').addEventListener('click', _closeSheet);

  sheet.querySelector('#btnPickerConfirm').addEventListener('click', () => {
    const hCol  = $('pickerHours');
    const mCol  = $('pickerMins');
    const selH  = Math.round((hCol?.scrollTop ?? 0) / ITEM_H);
    const selMI = Math.round((mCol?.scrollTop ?? 0) / ITEM_H);
    const hours = Math.min(12, Math.max(0, selH));
    const mins  = MINS[Math.min(3, Math.max(0, selMI))] ?? 0;
    _closeSheet();
    onConfirm(hours + mins / 60);
  });
}

function _wireFicheOffre() {
  const projetIdx = state.projets.findIndex(x => x.id === state.activeProjetId);
  if (projetIdx === -1) return;

  // Fiche verrouillée : seul "Corriger une erreur" est actif
  if (state.projets[projetIdx].statut === 'offreacceptee') {
    $('btnCorrigerErreur')?.addEventListener('click', () => {
      if (!confirm('Modifier une offre acceptée ?\nLe statut repassera en brouillon.')) return;
      state.projets[projetIdx].statut = 'brouillon';
      save.projets();
      navigateTo('ficheoffre');
    });
    return;
  }

  // Auto-save : champs simples
  $('viewContainer').querySelectorAll('[data-field]').forEach(el => {
    el.addEventListener('change', () => {
      const f = el.dataset.field;
      const v = el.type === 'number' ? (el.value !== '' ? Number(el.value) : null)
              : el.type === 'date'   ? (el.value || null)
              : el.value;
      state.projets[projetIdx][f] = v;
      if (f === 'dateShooting') _autoStatut(projetIdx);
      save.projets();
      _refreshFoCalcs(projetIdx);
    });
  });

  // Auto-save : type client
  $('viewContainer').querySelectorAll('[name="foTypeClient"]').forEach(r =>
    r.addEventListener('change', () => {
      state.projets[projetIdx].typeClient = r.value;
      save.projets();
    })
  );

  // Auto-save : mode facturation + toggle ligne jours
  $('viewContainer').querySelectorAll('[name="foModeFactu"]').forEach(r =>
    r.addEventListener('change', () => {
      state.projets[projetIdx].modeFacturation = r.value;
      save.projets();
      $('foForfaitJoursRow')?.classList.toggle('is-hidden', r.value !== 'jour');
    })
  );

  // Picker roue : quotas de temps
  $('viewContainer').querySelectorAll('.time-picker-btn[data-quota]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat     = btn.dataset.quota;
      const current = Number(state.projets[projetIdx].quotas?.[cat]) || 0;
      _openTimePicker(cat, current, (newVal) => {
        if (!state.projets[projetIdx].quotas) state.projets[projetIdx].quotas = {};
        state.projets[projetIdx].quotas[cat] = newVal;
        save.projets();
        // Mettre à jour le bouton affiché
        btn.textContent = _fmtTimePicker(newVal);
        btn.setAttribute('aria-label', `${CATEGORIES[cat]?.label ?? cat} : ${_fmtTimePicker(newVal)}`);
        // Mettre à jour le total
        const totalH = Object.values(state.projets[projetIdx].quotas)
          .reduce((s, v) => s + (Number(v) || 0), 0);
        const totEl = $('foQuotaTotal');
        if (totEl) totEl.innerHTML = `Total : <strong>${_fmtH(totalH)}</strong>`;
        _refreshFoCalcs(projetIdx);
      });
    });
  });

  // Auto-save : frais estimés — `input` pour mise à jour en temps réel
  $('viewContainer').querySelectorAll('[data-frais]').forEach(el =>
    el.addEventListener('input', () => {
      const k = el.dataset.frais;
      if (!state.projets[projetIdx].fraisEstimes) state.projets[projetIdx].fraisEstimes = {};
      state.projets[projetIdx].fraisEstimes[k] = Number(el.value) || 0;
      save.projets();
      _refreshFoFraisTotal(projetIdx);
      _refreshFoPrixQuotas(projetIdx);
    })
  );

  // Jours de shooting — auto-save + hint
  $('foJoursShooting')?.addEventListener('input', e => {
    const jours = Math.max(1, Number(e.target.value) || 1);
    state.projets[projetIdx].joursShooting = jours;
    save.projets();
    // Mise à jour du hint
    const hint = $('foJoursHint');
    const shootH = Number(state.projets[projetIdx].quotas?.shooting ?? 0);
    if (jours > 1) {
      const perJour = jours > 0 ? shootH / jours : 0;
      if (hint) {
        hint.textContent = `${jours} jours × ${_fmtTimePicker(perJour)} / jour`;
        hint.style.display = '';
      } else {
        // Insérer dynamiquement si absent
        const joursRow = $('foJoursShooting')?.closest('.fo-jours-row');
        if (joursRow) {
          const p2 = document.createElement('p');
          p2.id = 'foJoursHint';
          p2.className = 'fo-jours-hint';
          p2.textContent = `${jours} jours × ${_fmtTimePicker(perJour)} / jour`;
          joursRow.insertAdjacentElement('afterend', p2);
        }
      }
    } else {
      if (hint) hint.style.display = 'none';
    }
  });

  // Toggle perdiem
  $('btnTogglePerdiem')?.addEventListener('click', () => {
    const sec = $('foPerdiemSection');
    const btn = $('btnTogglePerdiem');
    if (!sec) return;
    const isOpen = sec.style.display !== 'none';
    sec.style.display = isOpen ? 'none' : '';
    if (btn) btn.textContent = isOpen ? '+ Ajouter un perdiem' : '▾ Masquer le perdiem';
  });

  _wireOffreActions(projetIdx);
}

function _wireOffreActions(idx) {
  $('btnEnvoyerOffre')?.addEventListener('click', () => {
    const p = state.projets[idx];
    if (!p.prixFacture || Number(p.prixFacture) <= 0) {
      if (!confirm('Prix non défini. Envoyer l\'offre quand même ?')) return;
    }
    p.statut    = 'offreenvoyee';
    p.dateEnvoi = new Date().toISOString().slice(0, 10);
    save.projets();
    navigateTo('studio');
  });

  $('btnMajOffre')?.addEventListener('click', () => {
    state.projets[idx].dateEnvoi = new Date().toISOString().slice(0, 10);
    save.projets();
    _refreshOffreActionsEl(idx);
  });

  $('btnAccepterOffre')?.addEventListener('click', () => {
    state.projets[idx].statut = 'offreacceptee';
    save.projets();
    state.projetSubView = 'brief';
    navigateTo('terrain');
  });

  $('btnSansSuiteOffre')?.addEventListener('click', () => {
    if (!confirm('Marquer cette offre sans suite ?')) return;
    state.projets[idx].statut = 'sanssuite';
    save.projets();
    navigateTo('studio');
  });
}

function _refreshOffreActionsEl(idx) {
  const p  = state.projets[idx];
  const el = $('viewContainer')?.querySelector('.fo-section-actions');
  if (!el) return;
  el.innerHTML = _renderOffreActions(p);
  _wireOffreActions(idx);
}

function _refreshFoCalcs(idx) {
  const p = state.projets[idx];
  _refreshFoFraisTotal(idx);
  _refreshFoPrixQuotas(idx);

  const perdiem = _calcPerdiem(p);
  const hint    = $('viewContainer')?.querySelector('.fo-perdiem-hint');
  if (hint) {
    hint.style.display = perdiem > 0 ? '' : 'none';
    if (perdiem > 0) {
      hint.innerHTML = `Perdiem estimé : <strong>${_fmtCHF(perdiem)}</strong>
        (${p.quotas?.shooting ?? 0} h shooting ÷ 8 × ${state.user?.perdiem ?? 50} CHF/j)`;
    }
  }

  const acompteHint = $('foAcompteVal');
  if (acompteHint) {
    const px = Number(p.prixFacture) || 0;
    const ac = Number(p.acompte)    || 0;
    acompteHint.textContent = px && ac
      ? `Acompte : ${_fmtCHF(Math.round(px * ac / 100))}`
      : '';
  }
}

function _refreshFoFraisTotal(idx) {
  const el = $('foFraisTotal');
  if (el) el.innerHTML = `Total frais : <strong>${_fmtCHF(_calcTotalFraisEstimes(state.projets[idx]))}</strong>`;
}

function _refreshFoPrixQuotas(idx) {
  const p = state.projets[idx];
  const elQ = $('foPrixQuotas');
  if (elQ) {
    const v = _prixConseilleQuotas(p);
    elQ.textContent = v != null ? _fmtCHF(v) : '—';
  }
  const elS = $('foPrixSimil');
  if (elS) {
    const s = _prixConseilleSimil(p);
    elS.textContent = s ? _fmtCHF(s.prix) : '—';
  }
}

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

  // Seuls les projets non clôturés apparaissent dans Studio
  const projetsActifs = state.projets.filter(p => p.statut !== 'termine' && p.statut !== 'sanssuite');
  const groups   = _groupByClient(projetsActifs);
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

  // Hero card (encours/atraiter) → Terrain / Chrono
  const heroCard = $('viewContainer').querySelector('[data-hero-id]');
  if (heroCard) {
    heroCard.addEventListener('click', () => {
      state.activeProjetId = heroCard.dataset.heroId;
      state.projetSubView  = 'chrono';
      navigateTo('terrain');
    });
    heroCard.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); heroCard.click(); }
    });
  }

  // Next card (avenir) → Terrain / Brief
  const nextCard = $('viewContainer').querySelector('[data-next-id]');
  if (nextCard) {
    nextCard.addEventListener('click', () => {
      state.activeProjetId = nextCard.dataset.nextId;
      state.projetSubView  = 'brief';
      navigateTo('terrain');
    });
    nextCard.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nextCard.click(); }
    });
  }

  // Cartes projet — routing par statut (spec diagramme)
  $('viewContainer').querySelectorAll('[data-projet-id]').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.projet-menu-btn')) return;
      const id = card.dataset.projetId;
      const p  = state.projets.find(x => x.id === id);
      if (!p) return;
      state.activeProjetId = id;
      if (p.statut === 'brouillon' || p.statut === 'offreenvoyee' || p.statut === 'attente') {
        navigateTo('ficheoffre');
      } else if (p.statut === 'offreacceptee' || p.statut === 'avenir' || p.statut === 'encours') {
        state.projetSubView = 'brief';
        navigateTo('terrain');
      } else if (p.statut === 'atraiter') {
        state.projetSubView = 'bilan';
        navigateTo('terrain');
      }
      // termine / sanssuite ne sont pas dans la liste Studio
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

  // Rappel "Acceptée ?" si offreenvoyee > 7 jours
  let rappelHtml = '';
  if (p.statut === 'offreenvoyee' && p.dateEnvoi) {
    const jours = Math.floor((Date.now() - new Date(p.dateEnvoi)) / 86400000);
    if (jours > 7) {
      rappelHtml = `<span class="projet-card-rappel">⚠️ Acceptée ? (${jours}j)</span>`;
    }
  }

  return `
    <div class="projet-card" data-projet-id="${p.id}" role="button" tabindex="0"
      style="border-left: 3px solid ${s.color};">
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
      ${rappelHtml}
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
  // Statuts manuels — jamais écrasés par la logique de date
  if (p.statut === 'brouillon'    || p.statut === 'offreenvoyee' ||
      p.statut === 'sanssuite'    || p.statut === 'termine') return;

  const ds = p.dateShooting ?? null;
  let newStatut;
  if (!ds) {
    // Sans date : garde offreacceptee si c'est le statut actuel, sinon brouillon
    newStatut = p.statut === 'offreacceptee' ? 'offreacceptee' : 'brouillon';
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
    ['corporate', 'Corporate'], ['portrait',  'Portrait'],
    ['mariage',   'Mariage'],   ['event',     'Événement'],
    ['commercial','Commercial'],['packshot',  'Packshot'],
    ['editorial', 'Éditorial'], ['autre',     'Autre'],
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
    // Après création : reste sur Studio (tap sur la carte pour ouvrir l'offre)
    setTimeout(() => navigateTo('studio'), 360);
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
      state.projetSubView = 'brief';
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

// Projets éligibles au module Terrain (offre acceptée = projet en cours)
function _projetsTerrain() {
  return state.projets.filter(p =>
    ['offreacceptee', 'avenir', 'encours', 'atraiter'].includes(p.statut)
  );
}

function _viewTerrain() {
  const projets = _projetsTerrain();

  if (!projets.length) {
    return `
      <div class="projet-empty">
        ${_ico_camera_lg()}
        <p class="empty-title">Aucun projet en cours.</p>
        <p class="empty-sub">Accepte une offre depuis Studio<br>pour commencer.</p>
        <button class="btn-action" id="btnGoStudio" type="button">
          Aller à Studio
        </button>
      </div>`;
  }

  // Sélectionner le projet actif parmi les projets Terrain
  if (!state.activeProjetId || !projets.find(p => p.id === state.activeProjetId)) {
    state.activeProjetId = projets[0].id;
  }

  const projet   = projets.find(p => p.id === state.activeProjetId);
  const subViews = ['brief', 'chrono', 'frais', 'bilan'];
  const subLabels = { brief:'Brief', chrono:'Chrono', frais:'Frais', bilan:'Bilan' };

  return `
    <div class="projet-module">

      <!-- Carrousel chips projet -->
      <div class="projet-chips-scroll" id="projetChips">
        ${projets.map(p => `
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
            ${subLabels[v] ?? v}
          </button>`).join('')}
      </div>

      <!-- Contenu sous-vue -->
      <div id="projetSubView">
        ${_renderProjetSubView(state.projetSubView, projet)}
      </div>

    </div>`;
}

// Alias rétro-compat (utilisé dans quelques endroits encore)
function _viewProjet() { return _viewTerrain(); }

// ─── Wiring module Terrain ────────────────────────────

function _wireTerrain() {
  $('btnGoStudio')?.addEventListener('click', () => navigateTo('studio'));
  _wireTerrainCore();
}

// Alias rétro-compat
function _wireProjet() { _wireTerrain(); }

function _wireTerrainCore() {
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
  _removeChronoFAB(); // toujours nettoyer avant de rendre une sous-vue
  switch (sv) {
    case 'brief':    return _subviewPreparer(projet); // Phase 3 remplacera par _subviewBrief
    case 'chrono':   return _subviewTemps(projet);    // Phase 4 remplacera par _subviewChrono
    case 'preparer': return _subviewPreparer(projet);
    case 'temps':    return _subviewTemps(projet);
    case 'frais':    return _subviewFrais(projet);
    case 'bilan':    return _subviewBilan(projet);
    default:         return '';
  }
}

function _wireProjetSubView(sv, projet) {
  if (sv === 'brief' || sv === 'preparer') _wirePreparer(projet);
  if (sv === 'chrono' || sv === 'temps') _wireTemps(projet);
  if (sv === 'frais')  _wireFrais(projet);
  if (sv === 'bilan')  _wireBilan(projet);
}

function _wireBilan(projet) {
  // Stagger d'entrée sur les cards
  document.querySelectorAll('[data-bilan-card]').forEach(card => {
    const idx = Number(card.dataset.bilanCard);
    card.style.opacity   = '0';
    card.style.transform = 'translateY(14px)';
    setTimeout(() => {
      card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      card.style.opacity    = '1';
      card.style.transform  = 'translateY(0)';
    }, idx * 100);
  });

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
  // ── Données ──
  const prixFacture  = Number(projet.prixFacture) || 0;
  const totalFraisR  = (projet.frais ?? []).reduce((s, f) => s + (Number(f.montant) || 0), 0);
  const netEncaisse  = prixFacture - totalFraisR;
  const totalMin     = (projet.sessions ?? []).reduce((s, x) => s + (Number(x.duree) || 0), 0);
  const tempsReel    = totalMin / 60;
  const tempsEstime  = _totalQuotaH(projet);
  const deltaH       = tempsEstime > 0 ? +(tempsReel - tempsEstime).toFixed(1) : null;
  const tauxReel     = tempsReel > 0 && prixFacture > 0
    ? Math.round(prixFacture / tempsReel) : null;
  const photosCmd    = Number(projet.photosCommandees) || 0;
  const photosLiv    = Number(projet.photosLivrees)    || 0;
  const prixParPhoto = photosCmd > 0 && prixFacture > 0
    ? Math.round(prixFacture / photosCmd) : null;

  // ── Performance ──
  let perf;
  if (tauxReel === null || !hasTaux()) {
    perf = { color: 'rgba(255,255,255,0.6)', label: 'Projet clôturé', deltaStr: '', isProfit: false };
  } else {
    const { tauxPlancher, tauxCible } = state.user;
    if (tauxReel >= tauxCible) {
      const d = Math.round((tauxReel - tauxCible) / tauxCible * 100);
      perf = { color: '#5AAE82', label: 'Projet rentable', deltaStr: `+${d}% vs cible`, isProfit: true };
    } else if (tauxReel >= tauxPlancher) {
      perf = { color: '#F59332', label: 'Dans les clous', deltaStr: 'Taux plancher atteint', isProfit: false };
    } else {
      const d = Math.round((tauxReel - tauxCible) / tauxCible * 100);
      perf = { color: '#E07878', label: 'Sous le plancher', deltaStr: `${d}% vs cible`, isProfit: false };
    }
  }

  // ── Lignes des cards deploy ──
  function _dcRow(label, val, cls = '') {
    return `<div class="deploy-row">
      <span>${label}</span>
      <span class="deploy-val${cls ? ' ' + cls : ''}">${val}</span>
    </div>`;
  }

  const dc1 = [
    _dcRow('Net encaissé', prixFacture > 0 ? _fmtCHF(netEncaisse) : '—',
      prixFacture > 0 ? (netEncaisse >= 0 ? 'green' : 'red') : ''),
    hasTaux() && tauxReel !== null && perf.deltaStr
      ? _dcRow('vs taux cible', perf.deltaStr,
          perf.isProfit ? 'green' : perf.color === '#F59332' ? 'orange' : 'red')
      : '',
  ].join('');

  const deltaSign = deltaH === null ? '' : deltaH > 0 ? `+${deltaH}h` : `${deltaH}h`;
  const dc2 = [
    _dcRow('Estimé', tempsEstime > 0 ? _fmtH(tempsEstime) : '—'),
    _dcRow('Réel',   tempsReel > 0 ? _fmtDuree(totalMin) : '—',
      deltaH !== null ? (Math.abs(deltaH) < 0.1 ? 'green' : deltaH < 0 ? 'green' : 'orange') : ''),
    deltaH !== null ? _dcRow('Delta', deltaSign || '±0h',
      Math.abs(deltaH) < 0.1 ? 'green' : deltaH < 0 ? 'green' : 'orange') : '',
  ].join('');

  const hasDc3 = photosCmd > 0 || photosLiv > 0 || prixParPhoto !== null;
  const dc3 = hasDc3 ? [
    photosCmd > 0 ? _dcRow('Commandées', photosCmd) : '',
    photosLiv > 0 ? _dcRow('Livrées', photosLiv,
      photosCmd > 0 ? (photosLiv >= photosCmd ? 'green' : 'orange') : '') : '',
    prixParPhoto  ? _dcRow('CHF / photo', `${prixParPhoto} CHF`, 'green') : '',
  ].join('') : '';

  // ── HTML overlay ──
  const overlay = document.createElement('div');
  overlay.id        = 'clotureOverlay';
  overlay.className = 'cloture-overlay';
  overlay.innerHTML = `
    <div class="confetti-container" id="clotureConfetti"></div>

    <div class="phase-countdown" id="cloturePhase1">
      <div class="countdown-ring">
        <svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="42" fill="none"
            stroke="rgba(255,255,255,0.08)" stroke-width="6"/>
          <circle id="arcCd" cx="50" cy="50" r="42" fill="none"
            stroke="#F59332" stroke-width="6" stroke-linecap="round"
            stroke-dasharray="264" stroke-dashoffset="264"
            transform="rotate(-90 50 50)"/>
        </svg>
        <div class="countdown-num" id="clotureNum">3</div>
      </div>
      <p class="countdown-label">Calcul en cours…</p>
    </div>

    <div class="phase-reveal" id="cloturePhase2">
      <div class="reveal-num" id="revealNum">${tauxReel !== null ? '0' : '—'}</div>
      <div class="reveal-unit">CHF/h réel</div>
      <div class="reveal-verdict" id="revealVerdict"></div>
    </div>

    <div class="phase-deploy" id="cloturePhase3">
      <div class="deploy-taux">
        <div class="deploy-taux-num" id="deployTauxNum" style="color:${perf.color}">
          ${tauxReel !== null ? tauxReel + ' CHF/h' : '—'}
        </div>
        <div class="deploy-taux-label">${perf.label}</div>
      </div>
      <div class="deploy-card" id="cdc1">
        <div class="deploy-card-label">Financier</div>
        ${dc1}
      </div>
      <div class="deploy-card" id="cdc2">
        <div class="deploy-card-label">Temps</div>
        ${dc2}
      </div>
      ${hasDc3 ? `<div class="deploy-card" id="cdc3">
        <div class="deploy-card-label">Livrables</div>
        ${dc3}
      </div>` : ''}
      <button class="btn-retour-studio" id="btnClotureRetour" type="button">
        Retour Studio
      </button>
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-visible'));

  // ── Phase 1 : arc se remplit + décompte 3→2→1 ──
  let count = 3;
  let arcProgress = 0;
  const ARC_TOTAL      = 264;
  const TICK_MS        = 50;
  const TICKS_PER_SEC  = 1000 / TICK_MS;

  const arcInterval = setInterval(() => {
    arcProgress += ARC_TOTAL / (3 * TICKS_PER_SEC);
    const arcEl = document.getElementById('arcCd');
    if (arcEl) arcEl.setAttribute('stroke-dashoffset',
      String(ARC_TOTAL - Math.min(arcProgress, ARC_TOTAL)));
  }, TICK_MS);

  const cdInterval = setInterval(() => {
    count--;
    const cdEl = document.getElementById('clotureNum');
    if (count > 0) {
      if (cdEl) cdEl.textContent = count;
    } else {
      clearInterval(cdInterval);
      clearInterval(arcInterval);

      // ── Phase 2 : révélation du taux ──
      const ph1 = document.getElementById('cloturePhase1');
      const ph2 = document.getElementById('cloturePhase2');
      if (ph1) ph1.style.display = 'none';
      if (ph2) ph2.style.display = 'block';

      if (tauxReel !== null) {
        _animateTauxCounter('revealNum', tauxReel, 1200, () => {
          const rnEl = document.getElementById('revealNum');
          const rvEl = document.getElementById('revealVerdict');
          if (rnEl) rnEl.style.color = perf.color;
          if (rvEl) {
            rvEl.textContent = perf.label + (perf.deltaStr ? ' · ' + perf.deltaStr : '');
            rvEl.style.color = perf.color;
            rvEl.classList.add('visible');
          }
          if (perf.isProfit) _spawnConfetti();
          _showDeployPhase(overlay, hasDc3);
        });
      } else {
        setTimeout(() => _showDeployPhase(overlay, hasDc3), 600);
      }
    }
  }, 1000);
}

function _spawnConfetti() {
  const container  = document.getElementById('clotureConfetti');
  if (!container) return;
  const colors     = ['#F59332','#5AAE82','#f0f4f8','#3A7ABF','#E09050'];
  const animations = ['confetto-fall-0','confetto-fall-1','confetto-fall-2'];
  for (let i = 0; i < 40; i++) {
    const el = document.createElement('div');
    el.className = 'confetto';
    el.style.cssText = [
      `left:${(Math.random()*100).toFixed(1)}%`,
      `background:${colors[Math.floor(Math.random()*colors.length)]}`,
      `transform:rotate(${Math.floor(Math.random()*360)}deg)`,
      `animation:${animations[i%3]} ${(0.8+Math.random()*1.2).toFixed(2)}s ${(Math.random()*0.8).toFixed(2)}s ease-in forwards`,
    ].join(';');
    container.appendChild(el);
  }
}

function _showDeployPhase(overlay, hasDc3) {
  setTimeout(() => {
    const ph2 = document.getElementById('cloturePhase2');
    const ph3 = document.getElementById('cloturePhase3');
    if (ph2) ph2.style.display = 'none';
    if (ph3) ph3.style.display = 'block';

    const cardIds = ['cdc1','cdc2', hasDc3 ? 'cdc3' : null].filter(Boolean);
    cardIds.forEach((id, i) => {
      setTimeout(() => document.getElementById(id)?.classList.add('visible'), i * 100);
    });

    setTimeout(() => {
      document.getElementById('btnClotureRetour')?.classList.add('visible');
    }, cardIds.length * 100 + 200);

    document.getElementById('btnClotureRetour')?.addEventListener('click', () => {
      overlay.style.transition = 'opacity 0.35s ease';
      overlay.style.opacity    = '0';
      setTimeout(() => { overlay.remove(); navigateTo('studio'); }, 370);
    });
  }, 1800);
}

function _animateTauxCounter(elId, target, duration, onDone) {
  const el = document.getElementById(elId);
  if (!el || target <= 0) { if (onDone) onDone(); return; }
  const startTime = performance.now();
  function frame(now) {
    const t    = Math.min(1, (now - startTime) / duration);
    const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
    el.textContent = String(Math.round(target * ease));
    if (t < 1) requestAnimationFrame(frame);
    else { el.textContent = String(target); if (onDone) onDone(); }
  }
  requestAnimationFrame(frame);
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

  // Shots triés : non cochés en premier
  const sortedShots = [...(fr.shots ?? [])].sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
  const shotsHtml = sortedShots.map(s => `
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

      <!-- ── 4. Offre (accordéon, lecture seule) ── -->
      ${(() => {
        const hasPrix = Number(projet.prixFacture) > 0;
        const droitsLabel = DROITS_OPTIONS.find(o => o.key === (projet.droitsUtilisation ?? 'aucun'))?.label ?? '—';
        const totalFraisOff = _calcTotalFraisEstimes(projet);
        const acompteVal = hasPrix && projet.acompte
          ? _fmtCHF(Math.round(Number(projet.prixFacture) * Number(projet.acompte) / 100))
          : null;
        return `
      <div class="accordion glass-card" data-acc="offre">
        <button class="accordion-header" type="button" aria-expanded="false" data-acc-btn="offre">
          <span class="accordion-title">Offre acceptée</span>
          <span class="accordion-badge">${hasPrix ? _fmtCHF(Number(projet.prixFacture)) : '—'}</span>
          <svg class="accordion-chevron" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
        <div class="accordion-body is-closed" data-acc-body="offre">
          <dl class="offre-recap-list">
            ${hasPrix ? `<div class="offre-recap-row">
              <dt>Prix</dt><dd>${_fmtCHF(Number(projet.prixFacture))}</dd>
            </div>` : ''}
            ${projet.photosCommandees ? `<div class="offre-recap-row">
              <dt>Photos</dt><dd>${projet.photosCommandees}</dd>
            </div>` : ''}
            ${projet.videosCommandees ? `<div class="offre-recap-row">
              <dt>Vidéos</dt><dd>${projet.videosCommandees}</dd>
            </div>` : ''}
            ${projet.roundsRevisions ? `<div class="offre-recap-row">
              <dt>Retouches</dt><dd>${projet.roundsRevisions} round${projet.roundsRevisions > 1 ? 's' : ''}</dd>
            </div>` : ''}
            ${projet.delaiLivraison ? `<div class="offre-recap-row">
              <dt>Livraison</dt><dd>${projet.delaiLivraison} j</dd>
            </div>` : ''}
            ${projet.droitsUtilisation && projet.droitsUtilisation !== 'aucun' ? `<div class="offre-recap-row">
              <dt>Droits</dt><dd>${droitsLabel}</dd>
            </div>` : ''}
            ${totalFraisOff > 0 ? `<div class="offre-recap-row">
              <dt>Frais estimés</dt><dd>${_fmtCHF(totalFraisOff)}</dd>
            </div>` : ''}
            ${acompteVal ? `<div class="offre-recap-row">
              <dt>Acompte ${projet.acompte} %</dt><dd>${acompteVal}</dd>
            </div>` : ''}
          </dl>
        </div>
      </div>`; })()}

      <!-- ── 5. Feuille de route (accordéon, déplié par défaut) ── -->
      <div class="accordion glass-card" data-acc="feuille">
        <button class="accordion-header" type="button" aria-expanded="true" data-acc-btn="feuille">
          <span class="accordion-title">Feuille de route</span>
          <svg class="accordion-chevron is-open" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
        <div class="accordion-body" data-acc-body="feuille">
          <label for="frNomContact">Contact client
            <input id="frNomContact" type="text"
              placeholder="Prénom Nom"
              autocomplete="off"
              value="${_esc(fr.contact ?? '')}" />
          </label>
          <div class="form-row">
            <label for="frTel">Téléphone
              <input id="frTel" type="tel"
                placeholder="+41 79 000 00 00"
                autocomplete="tel"
                value="${_esc(fr.telephone ?? '')}" />
            </label>
            <label for="frEmail">Email
              <input id="frEmail" type="email"
                placeholder="client@exemple.com"
                autocomplete="email"
                value="${_esc(fr.email ?? '')}" />
            </label>
          </div>
          <label for="frLieu">Lieu
            <input id="frLieu" type="text"
              placeholder="Adresse ou lieu"
              autocomplete="off"
              value="${_esc(fr.lieu ?? '')}" />
          </label>
          <!-- Boutons contact — visibles uniquement si valeur renseignée -->
          <div class="contact-icon-row" id="contactIconRow">
            ${fr.telephone ? `
            <a class="contact-icon-btn" id="frTelBtn"
              href="tel:${_esc(fr.telephone.replace(/\s/g,''))}"
              aria-label="Appeler">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07
                  A19.5 19.5 0 0 1 4.07 13 19.79 19.79 0 0 1 1 4.18 2 2 0 0 1
                  2.96 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0
                  1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1
                  2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 17z"/>
              </svg>
            </a>` : ''}
            ${fr.email ? `
            <a class="contact-icon-btn" id="frEmailBtn"
              href="mailto:${_esc(fr.email)}"
              aria-label="Écrire">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <polyline points="2,4 12,13 22,4"/>
              </svg>
            </a>` : ''}
            ${fr.lieu ? `
            <a class="contact-icon-btn" id="frLieuBtn"
              href="https://maps.apple.com/?q=${encodeURIComponent(fr.lieu)}"
              target="_blank" rel="noopener"
              aria-label="Ouvrir Maps">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </a>` : ''}
          </div>
          <label for="frNotes">Notes terrain
            <textarea id="frNotes" rows="3"
              placeholder="Ambiance, style, contraintes, parking…"
              style="resize:vertical;">${_esc(fr.notes ?? '')}</textarea>
          </label>
        </div>
      </div>

      <!-- ── 6. Plan de shots (accordéon) ── -->
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

      <!-- ── 7. Matériel (accordéon) ── -->
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

      <!-- ── 8. Action : FAB injecté par _wirePreparer ── -->

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
  $('btnGoToProfil')?.addEventListener('click', () => navigateTo('moi'));

  // Feuille de route — auto-save
  const _saveFR = () => {
    const idx = state.projets.findIndex(p => p.id === projet.id);
    if (idx === -1) return;
    if (!state.projets[idx].feuilleRoute)
      state.projets[idx].feuilleRoute = { contact:'', telephone:'', email:'', lieu:'', notes:'', shots:[] };
    state.projets[idx].feuilleRoute.contact   = $('frNomContact')?.value ?? '';
    state.projets[idx].feuilleRoute.telephone = $('frTel')?.value        ?? '';
    state.projets[idx].feuilleRoute.email     = $('frEmail')?.value      ?? '';
    state.projets[idx].feuilleRoute.lieu      = $('frLieu')?.value       ?? '';
    state.projets[idx].feuilleRoute.notes     = $('frNotes')?.value      ?? '';
    save.projets();
  };
  ['frNomContact','frNotes'].forEach(id => $(id)?.addEventListener('input', _saveFR));

  // Lieu / Tel / Email : save + mise à jour icônes contact
  ['frLieu','frTel','frEmail'].forEach(id =>
    $(id)?.addEventListener('input', () => {
      _saveFR();
      _refreshContactIcons();
    })
  );

  function _refreshContactIcons() {
    const row = $('contactIconRow');
    if (!row) return;
    const tel  = $('frTel')?.value.trim()   ?? '';
    const email= $('frEmail')?.value.trim()  ?? '';
    const lieu = $('frLieu')?.value.trim()   ?? '';
    const mkSVG = (path) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
    row.innerHTML = [
      tel  ? `<a class="contact-icon-btn" href="tel:${tel.replace(/\s/g,'')}" aria-label="Appeler">
        ${mkSVG('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.07 13 19.79 19.79 0 0 1 1 4.18 2 2 0 0 1 2.96 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 17z"/>')}</a>` : '',
      email? `<a class="contact-icon-btn" href="mailto:${email}" aria-label="Écrire">
        ${mkSVG('<rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/>')}</a>` : '',
      lieu ? `<a class="contact-icon-btn" href="https://maps.apple.com/?q=${encodeURIComponent(lieu)}"
        target="_blank" rel="noopener" aria-label="Ouvrir Maps">
        ${mkSVG('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>')}</a>` : '',
    ].join('');
  }

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

  // FAB flottant "Chrono" — visible uniquement si le timer ne tourne pas
  _injectChronoFAB(projet);
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
  // Tri : non cochés en premier
  const sorted = [...(fr.shots ?? [])].sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
  el.innerHTML = sorted.map(s => `
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

// ════════════════════════════════════════════════════════
// CHRONO — helpers Phase 4
// ════════════════════════════════════════════════════════

const _RING_C = 2 * Math.PI * 80; // ≈ 502.65 — circonférence du ring r=80

// Fonds chrono — variations subtiles bleu foncé uniquement (pas les couleurs vives des catégories)
const CHRONO_BG = {
  admin:     'rgba(20,45,80,.07)',
  prepa:     'rgba(20,40,75,.09)',
  shooting:  'rgba(15,45,90,.10)',
  trajet:    'rgba(25,50,80,.08)',
  edition:   'rgba(20,50,75,.09)',
  revisions: 'rgba(25,45,85,.11)',
};

function _ringOffset(projet) {
  const quotaMin = Math.round((Number(projet?.quotas?.[_timerCat]) || 0) * 60);
  if (!quotaMin) return _RING_C;
  const sessionsMin = (projet?.sessions ?? [])
    .filter(s => s.categorie === _timerCat)
    .reduce((sum, s) => sum + (Number(s.duree) || 0), 0);
  const liveMin = _timerInterval ? Math.floor(_timerSeconds / 60) : 0;
  return _RING_C * (1 - Math.min(1, (sessionsMin + liveMin) / quotaMin));
}

function _renderChronoRing(projet) {
  const cat    = CATEGORIES[_timerCat] ?? { color: '#D4700A' };
  const offset = _ringOffset(projet);
  return `
    <svg class="chrono-ring" viewBox="0 0 200 200" aria-hidden="true">
      <circle class="chrono-ring-track" cx="100" cy="100" r="80"/>
      <circle id="chronoRingFill" class="chrono-ring-fill"
        cx="100" cy="100" r="80"
        stroke="${cat.color}"
        stroke-dasharray="${_RING_C.toFixed(2)}"
        stroke-dashoffset="${offset.toFixed(2)}"
        transform="rotate(-90 100 100)"/>
    </svg>`;
}

function _updateChronoRing(projet) {
  const el = $('chronoRingFill');
  if (!el) return;
  const cat = CATEGORIES[_timerCat] ?? { color: '#D4700A' };
  el.style.stroke = cat.color;
  el.setAttribute('stroke-dashoffset', _ringOffset(projet).toFixed(2));
}

function _renderCatGrid(projet, activeCat) {
  const effMin = {};
  (projet.sessions ?? []).forEach(s => {
    effMin[s.categorie] = (effMin[s.categorie] ?? 0) + (Number(s.duree) || 0);
  });
  return Object.entries(CATEGORIES).map(([key, cat]) => {
    const quotaMin  = Math.round((Number(projet.quotas?.[key]) || 0) * 60);
    const eff       = effMin[key] ?? 0;
    const pct       = quotaMin > 0 ? Math.min(100, Math.round(eff / quotaMin * 100)) : 0;
    const isActive  = key === activeCat;
    const fillColor = pct >= 100 ? '#E07878' : pct >= 80 ? '#E09050' : cat.color;
    const pctDisplay = quotaMin > 0
      ? `<span class="cat-grid-pct${pct > 100 ? ' is-over' : ''}">${pct}%${pct > 100 ? '!' : ''}</span>`
      : '';
    return `
      <button class="cat-grid-cell${isActive ? ' is-active' : ''}"
        data-cat="${key}" type="button"
        style="${isActive
          ? `border-color:${cat.color};background:${cat.bg};`
          : ''}">
        <span class="cat-grid-label">${cat.label}</span>
        <span class="cat-grid-eff">${eff > 0 ? _fmtDuree(eff) : '—'}</span>
        ${pctDisplay}
        <div class="cat-grid-bar-wrap">
          <div class="cat-grid-bar-fill"
            style="width:${pct}%;background:${fillColor};"></div>
        </div>
      </button>`;
  }).join('');
}

function _wireCatGrid(projet) {
  document.querySelectorAll('.cat-grid-cell').forEach(cell =>
    cell.addEventListener('click', e => {
      const cat = e.currentTarget.dataset.cat;
      if (!cat) return;
      _timerCat = cat;
      _refreshCatGrid(projet);
      _updateChronoRing(projet);
      _updateChronoBg();
      if (_timerInterval) _updateChronoStatus();
    })
  );
}

function _refreshCatGrid(projet) {
  const el = $('catGrid');
  if (el) { el.innerHTML = _renderCatGrid(projet, _timerCat); _wireCatGrid(projet); }
}

function _updateChronoBg() {
  const view = document.querySelector('.temps-view');
  if (!view) return;
  view.style.background = _timerInterval ? (CHRONO_BG[_timerCat] ?? '') : '';
}

function _injectChronoFAB(projet) {
  _removeChronoFAB();
  if (_timerInterval) return;
  const fab = document.createElement('button');
  fab.id        = 'fabChrono';
  fab.className = 'fab-chrono';
  fab.type      = 'button';
  fab.setAttribute('aria-label', 'Démarrer le chrono');
  fab.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"
    fill="currentColor" aria-hidden="true">
    <polygon points="5,3 19,12 5,21"/>
  </svg>Chrono`;
  fab.addEventListener('click', () => {
    _removeChronoFAB();
    state.projetSubView = 'chrono';
    document.querySelectorAll('[data-subview]').forEach(b =>
      b.classList.toggle('is-active', b.dataset.subview === 'chrono')
    );
    _refreshProjetSubView();
  });
  document.body.appendChild(fab);
}

function _removeChronoFAB() { $('fabChrono')?.remove(); }

function _subviewTemps(projet) {
  return `
    <div class="temps-view">

      <!-- 1. Ring + Timer -->
      <div class="chrono-ring-wrap">
        ${_renderChronoRing(projet)}
        <div class="chrono-center">
          <p class="chrono-status" id="chronoStatus">Prêt</p>
          <p class="chrono-display" id="chronoDisplay">00:00:00</p>
          <p class="chrono-sub" id="chronoSub"></p>
        </div>
      </div>

      <!-- 2. Boutons -->
      <div class="chrono-actions">
        <button class="btn-action" id="btnToggleChrono" type="button">
          ${_timerInterval ? 'Arrêter' : 'Démarrer'}
        </button>
        <button class="btn-secondary" id="btnManuelTime" type="button">
          ${_ico_clock_plus()} Manuel
        </button>
      </div>

      <!-- 3. Grille catégories 2×3 -->
      <div class="cat-grid" id="catGrid">
        ${_renderCatGrid(projet, _timerCat)}
      </div>

      <!-- 4. Stats -->
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

      <!-- 5. Sessions -->
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
  _wireCatGrid(projet);

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

  // Restaurer l'état visuel si le chrono tourne déjà
  if (_timerInterval) {
    _updateChronoStatus();
    _updateChronoBg();
    _updateChronoRing(projet);
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

  _updateChronoBg(); // reset fond
  if (idx !== -1) _refreshTempsDisplay(state.projets[idx]);
}

function _tickTimer() {
  _timerSeconds = Math.floor((Date.now() - _timerStart) / 1000);
  const h = Math.floor(_timerSeconds / 3600);
  const m = Math.floor((_timerSeconds % 3600) / 60);
  const s = _timerSeconds % 60;
  const el = $('chronoDisplay');
  if (el) el.textContent = [h, m, s].map(n => String(n).padStart(2, '0')).join(':');

  // Ring : chaque seconde (résolution fluide)
  const p = _activeProjet();
  if (p) _updateChronoRing(p);

  // Grille (re-render DOM) : toutes les 60 s suffit
  _tickBarCounter++;
  if (_tickBarCounter % 60 === 0 && p) _refreshCatGrid(p);
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
  _updateChronoBg();
}

function _refreshTempsDisplay(projet) {
  _refreshCatGrid(projet);
  _updateChronoRing(projet);
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

function _renderFraisComparison(projet) {
  const FRAIS_CATS = [
    ['deplacement', 'Déplacement'],
    ['repas',       'Repas'],
    ['hebergement', 'Hébergement'],
    ['materiel',    'Matériel loué'],
    ['autre',       'Autre'],
  ];
  const estimes = projet.fraisEstimes ?? {};
  const reelByCat = {};
  (projet.frais ?? []).forEach(f => {
    const cat = f.categorie ?? 'autre';
    reelByCat[cat] = (reelByCat[cat] ?? 0) + (Number(f.montant) || 0);
  });

  const totalEst  = Object.values(estimes).reduce((s, v) => s + (Number(v) || 0), 0);
  const totalReel = (projet.frais ?? []).reduce((s, f) => s + (Number(f.montant) || 0), 0);
  const delta     = totalReel - totalEst;

  const rows = FRAIS_CATS.map(([key, label]) => {
    const est = Number(estimes[key]) || 0;
    const ree = reelByCat[key]      || 0;
    if (est === 0 && ree === 0) return '';
    const over = est > 0 && ree > est;
    return `
      <div class="frais-cmp-row">
        <span class="frais-cmp-cat">${label}</span>
        <span class="frais-cmp-est">${est > 0 ? _fmtCHF(est) : '—'}</span>
        <span class="frais-cmp-reel${over ? ' is-over' : ''}">${ree > 0 ? _fmtCHF(ree) : '—'}</span>
      </div>`;
  }).filter(Boolean).join('');

  const noCmp = totalEst === 0 && totalReel === 0;
  if (noCmp) return '';

  const deltaSign = delta > 0 ? '+' : '';
  const deltaCls  = delta > 0 ? ' is-over' : delta < 0 ? ' is-under' : '';

  return `
    <div class="frais-cmp glass-card">
      <div class="frais-cmp-head">
        <span></span>
        <span class="frais-cmp-col">Estimé</span>
        <span class="frais-cmp-col">Réel</span>
      </div>
      ${rows}
      <div class="frais-cmp-total">
        <span>Total</span>
        <span>${totalEst > 0 ? _fmtCHF(totalEst) : '—'}</span>
        <span class="${deltaCls}">
          ${totalReel > 0 ? _fmtCHF(totalReel) : '—'}
          ${totalEst > 0 && totalReel > 0 && delta !== 0
            ? `<small>${deltaSign}${_fmtCHF(Math.abs(delta))}</small>` : ''}
        </span>
      </div>
    </div>`;
}

function _subviewFrais(projet) {
  const frais = projet.frais ?? [];

  const listHTML = frais.length
    ? `<div class="frais-list">
        ${[...frais].reverse().map(f => {
          const d   = new Date(f.date).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' });
          const cat = f.categorie
            ? ({ deplacement:'Dépl.', repas:'Repas', hebergement:'Héberg.',
                 materiel:'Matériel', autre:'Autre' }[f.categorie] ?? f.categorie)
            : '';
          return `
            <div class="frais-row">
              <div class="frais-info">
                <div class="frais-label">${_esc(f.label)}</div>
                <div class="frais-date">${d}${cat ? ` · ${cat}` : ''}</div>
              </div>
              <span class="frais-montant">${_fmtCHF(f.montant)}</span>
              <button class="frais-delete" data-frais-id="${f.id}"
                type="button" aria-label="Supprimer">×</button>
            </div>`;
        }).join('')}
      </div>`
    : `<div class="frais-empty">Aucun frais réel enregistré.</div>`;

  return `
    <div class="frais-view">

      <!-- Comparaison estimé / réel -->
      ${_renderFraisComparison(projet)}

      <!-- Liste frais réels -->
      <div class="glass-card" id="fraisList">
        ${listHTML}
      </div>

      <!-- CTA -->
      <button class="btn-action" id="btnAddFrais" type="button">
        + Ajouter un frais réel
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
      <div class="form-row">
        <label for="fraisCatInput">
          Catégorie
          <select id="fraisCatInput">
            <option value="deplacement">Déplacement</option>
            <option value="repas">Repas</option>
            <option value="hebergement">Hébergement</option>
            <option value="materiel">Matériel loué</option>
            <option value="autre" selected>Autre</option>
          </select>
        </label>
        <label for="fraisMontantInput">
          Montant (CHF)
          <input id="fraisMontantInput" type="number"
            min="0" step="0.01" placeholder="0.00"
            inputmode="decimal" />
        </label>
      </div>
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
      id:        _genId(),
      label,
      montant,
      categorie: $('fraisCatInput')?.value ?? 'autre',
      date:      new Date().toISOString(),
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
      <div class="glass-card bilan-section" data-bilan-card="0">
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
      <div class="glass-card bilan-section" data-bilan-card="1">
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
      <div class="glass-card bilan-section" data-bilan-card="2">
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
      <div class="glass-card bilan-section" data-bilan-card="3">
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
      <div class="glass-card bilan-verdict" data-bilan-card="4">
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
  // Tri : non cochés en premier
  const materiel = (state.user?.materiel ?? [])
    .filter(m => m.actif !== false)
    .sort((a, b) => {
      const aChecked = (projet.checklist ?? []).find(c => c.id === a.id)?.checked ?? false;
      const bChecked = (projet.checklist ?? []).find(c => c.id === b.id)?.checked ?? false;
      return (aChecked ? 1 : 0) - (bChecked ? 1 : 0);
    });
  const customItems = (projet.checklist ?? [])
    .filter(c => c.isCustom)
    .sort((a, b) => (a.checked ? 1 : 0) - (b.checked ? 1 : 0));

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
  $('btnGoToProfil')?.addEventListener('click', () => navigateTo('moi'));
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
    perdiem:    state.user?.perdiem    ?? 50,  // préservé
    materiel:   state.user?.materiel   ?? [],  // préservé — géré indépendamment
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
