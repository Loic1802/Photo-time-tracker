/* ══════════════════════════════════════════════════════
   FRAMES — Mini ERP pour photographe freelance
   app.js · Phase 2 — Shell + Navigation
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

// Comparaisons de taux (vert/orange/rouge) actives
// uniquement si fr_user.tauxCible est défini et > 0
function hasTaux() {
  return !!(state.user?.tauxCible > 0);
}

// ════════════════════════════════════════════════════════
// DOM HELPER
// ════════════════════════════════════════════════════════

const $ = id => document.getElementById(id);

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
  return `
    <div class="empty-state" style="margin:32px 16px;min-height:200px;">
      <p style="font-size:.8rem;color:rgba(30,50,70,.3);">
        Module Studio — Phase 3
      </p>
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
  if (!u || !u.prenom) {
    return `
      <div class="empty-state" style="margin:32px 16px;min-height:200px;">
        <div>
          <p style="font-size:.85rem;font-weight:500;color:rgba(30,50,70,.5);">
            Profil non configuré
          </p>
          <p style="font-size:.78rem;margin-top:6px;color:rgba(30,50,70,.3);">
            Les comparaisons de taux s'activeront une fois ton taux cible défini.
          </p>
          <p style="font-size:.75rem;margin-top:10px;color:rgba(30,50,70,.25);">
            Module Profil — Phase 9
          </p>
        </div>
      </div>`;
  }
  return `
    <div class="empty-state" style="margin:32px 16px;min-height:200px;">
      <div>
        <p style="font-size:.9rem;font-weight:500;color:rgba(30,50,70,.6);">
          ${u.prenom} · ${u.specialite ?? '—'}
        </p>
        <p style="font-size:.8rem;margin-top:4px;color:rgba(30,50,70,.4);">
          ${hasTaux()
            ? `Plancher CHF ${u.tauxPlancher}/h · cible CHF ${u.tauxCible}/h`
            : 'Taux cible non défini'}
        </p>
        <p style="font-size:.75rem;margin-top:10px;color:rgba(30,50,70,.25);">
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
// INIT — ouverture directe sur Studio
// ════════════════════════════════════════════════════════

showShell('studio');
