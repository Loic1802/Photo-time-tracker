/* ══════════════════════════════════════════════════════
   FRAMES — Mini ERP pour photographe freelance
   app.js · Phase 2 — Onboarding + Shell
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

// Flag onboarding stocké en string brute (fr_onboarding_done = 'true')
const ONBOARDING_KEY = 'fr_onboarding_done';

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

// ════════════════════════════════════════════════════════
// DOM HELPER
// ════════════════════════════════════════════════════════

const $ = id => document.getElementById(id);

// ════════════════════════════════════════════════════════
// ONBOARDING — Module 0
// ════════════════════════════════════════════════════════

let _ob = {}; // données temporaires collectées sur les 3 écrans

function showOnboarding() {
  $('onboarding').hidden = false;
  $('appShell').hidden   = true;
  _showObScreen(1);
}

function _showObScreen(n) {
  [1, 2, 3].forEach(i => {
    const el = $(`ob-screen-${i}`);
    if (i === n) {
      el.hidden = false;
      el.style.opacity    = '0';
      el.style.transition = '';
      requestAnimationFrame(() => {
        el.style.transition = 'opacity 0.25s ease';
        el.style.opacity    = '1';
      });
    } else {
      el.style.opacity    = '';
      el.style.transition = '';
      el.hidden = true;
    }
  });
}

function initOnboarding() {
  // ── Écran 1 → 2
  $('ob-btn-1').addEventListener('click', () => {
    const prenom = $('ob-prenom').value.trim();
    if (!prenom) { $('ob-prenom').focus(); return; }
    _ob.prenom     = prenom;
    _ob.specialite = $('ob-specialite').value;
    _showObScreen(2);
  });

  // ── Écran 2 : calcul temps réel
  ['ob-revenu', 'ob-jours', 'ob-charges'].forEach(id =>
    $(id).addEventListener('input', _updateTauxPreview)
  );
  _updateTauxPreview();

  // ── Écran 2 → 3
  $('ob-btn-2').addEventListener('click', () => {
    const revenu  = parseFloat($('ob-revenu').value)  || 0;
    const jours   = parseFloat($('ob-jours').value)   || 15;
    const charges = parseFloat($('ob-charges').value) || 0;
    if (!revenu) { $('ob-revenu').focus(); return; }
    _ob.revenuCible  = revenu;
    _ob.joursFact    = jours;
    _ob.charges      = charges;
    _ob.tauxPlancher = Math.round((revenu + charges) / (jours * 8));
    _ob.tauxCible    = Math.round(_ob.tauxPlancher * 1.3);
    _showObScreen(3);
  });

  // ── Écran 3 — Créer un projet
  $('ob-btn-3').addEventListener('click', () => {
    _finishOnboarding();
    showShell('studio');
    // TODO Phase 3 : ouvrir bottom sheet nouveau projet
  });

  // ── Écran 3 — Pas maintenant
  $('ob-skip').addEventListener('click', () => {
    _finishOnboarding();
    showShell('studio');
  });
}

function _updateTauxPreview() {
  const revenu  = parseFloat($('ob-revenu').value)  || 0;
  const jours   = parseFloat($('ob-jours').value)   || 15;
  const charges = parseFloat($('ob-charges').value) || 0;

  if (!revenu) {
    $('ob-taux-plancher').textContent = '—';
    $('ob-taux-cible').textContent    = '—';
    return;
  }
  const plancher = Math.round((revenu + charges) / (jours * 8));
  const cible    = Math.round(plancher * 1.3);
  $('ob-taux-plancher').textContent = `CHF ${plancher}/h`;
  $('ob-taux-cible').textContent    = `CHF ${cible}/h`;
}

function _finishOnboarding() {
  state.user = {
    prenom:       _ob.prenom       || '',
    specialite:   _ob.specialite   || '',
    revenuCible:  _ob.revenuCible  || 0,
    joursFact:    _ob.joursFact    || 15,
    charges:      _ob.charges      || 0,
    tauxPlancher: _ob.tauxPlancher || 0,
    tauxCible:    _ob.tauxCible    || 0,
  };
  save.user();
  localStorage.setItem(ONBOARDING_KEY, 'true');
  $('onboarding').hidden = true;
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

let _tabBarReady = false;

function showShell(view = 'studio') {
  $('appShell').hidden = false;
  if (!_tabBarReady) { _renderTabBar(); }
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
  _tabBarReady = true;
}

function navigateTo(view) {
  state.currentView = view;

  // Actif dans le tab bar
  document.querySelectorAll('[data-tab]').forEach(btn =>
    btn.classList.toggle('is-active', btn.dataset.tab === view)
  );

  // Topbar
  _renderTopbar(view);

  // Vue avec fade
  const el = $('viewContainer');
  el.style.opacity    = '0';
  el.style.transition = '';
  requestAnimationFrame(() => {
    _renderView(view, el);
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

  // "+" visible sur Studio et Prospection seulement
  $('topbarAction').hidden = !['studio', 'prospection'].includes(view);
}

// ════════════════════════════════════════════════════════
// VUES — stubs (complétés phase par phase)
// ════════════════════════════════════════════════════════

function _renderView(view, el) {
  switch (view) {
    case 'studio':      el.innerHTML = _viewStudio();      break;
    case 'prospection': el.innerHTML = _viewProspection(); break;
    case 'projet':      el.innerHTML = _viewProjet();      break;
    case 'insights':    el.innerHTML = _viewInsights();    break;
    case 'profil':      el.innerHTML = _viewProfil();      break;
    default:            el.innerHTML = '';
  }
}

function _viewStudio() {
  const prenom = state.user?.prenom ? ` ${state.user.prenom}` : '';
  return `
    <div class="empty-state" style="margin:32px 16px;min-height:200px;">
      <div>
        <p style="font-size:.95rem;font-weight:500;color:rgba(30,50,70,.55);">
          Bonjour${prenom} 👋
        </p>
        <p style="font-size:.8rem;margin-top:6px;color:rgba(30,50,70,.3);">
          Module Studio — Phase 3
        </p>
      </div>
    </div>`;
}

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
  const u = state.user;
  if (!u) return _viewStudio();
  return `
    <div class="empty-state" style="margin:32px 16px;min-height:200px;">
      <div>
        <p style="font-size:.9rem;font-weight:500;color:rgba(30,50,70,.6);">
          ${u.prenom} · ${u.specialite}
        </p>
        <p style="font-size:.8rem;margin-top:4px;color:rgba(30,50,70,.4);">
          Plancher CHF ${u.tauxPlancher}/h · cible CHF ${u.tauxCible}/h
        </p>
        <p style="font-size:.75rem;margin-top:8px;color:rgba(30,50,70,.3);">
          Module Profil — Phase 9
        </p>
      </div>
    </div>`;
}

// ════════════════════════════════════════════════════════
// ICÔNES SVG — déclarées en function pour le hoisting
// ════════════════════════════════════════════════════════

function _ico_camera() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.8"
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
// INIT
// ════════════════════════════════════════════════════════

function init() {
  const done = localStorage.getItem(ONBOARDING_KEY) === 'true';
  if (done) {
    showShell(state.currentView);
  } else {
    initOnboarding();
    showOnboarding();
  }
}

init();
