# Frames — Mini ERP pour photographe freelance

Application mobile-first (PWA) pour photographes freelance suisses.
Pricer les offres, post-calculer un projet, capitaliser sur le passé, suivre la prospection.

## Stack

- Vanilla JS (ES6 modules, pas de framework, pas de bundler)
- localStorage pour toutes les données (préfixe `fr_`)
- PWA — installable sur iPhone via Safari
- Déploiement Vercel

## Design system

- Fond : dégradé bleu-gris fixé `#C9D6E3 → #A8BDD0`
- Glass cards : `rgba(255,255,255,0.55)` + `backdrop-filter: blur(10px)`
- Accent orange : `linear-gradient(135deg, #F59332, #D4700A)`
- Fonts : DM Serif Display italic (titres) + DM Sans (corps)

## Structure localStorage

| Clé | Contenu |
|-----|---------|
| `fr_onboarding_done` | `'true'` si onboarding terminé |
| `fr_user` | `{ prenom, specialite, revenuCible, joursFact, charges, tauxPlancher, tauxCible }` |
| `fr_contacts` | `[{ id, nom, entreprise, canal, dateContact, statut, note, projetId }]` |
| `fr_projets` | `[{ id, nom, clientId, type, datePrevue, prixFacture, statut, quotas, checklist, sessions, frais, ... }]` |

## Onglets (tab bar fixe en bas)

Studio · Prospection · Projet · Insights · Profil

## Phases de développement

| Phase | Module | État |
|-------|--------|------|
| 1 | CSS — Design system complet | ✅ |
| 2 | Onboarding (3 écrans) | ✅ |
| 3 | Studio (liste projets + création) | ⬜ |
| 4 | Prospection (contacts + pipeline) | ⬜ |
| 5 | Projet — Offre (quotas + checklist) | ⬜ |
| 6 | Projet — Temps (chrono + sessions) | ⬜ |
| 7 | Projet — Frais + Bilan | ⬜ |
| 8 | Insights (métriques globales) | ⬜ |
| 9 | Profil (édition user + reset) | ⬜ |
| 10 | Tests PWA iPhone + Mac | ⬜ |

## Lancer en local

```bash
cd Codex
python3 -m http.server 5173 --bind 127.0.0.1
```

Puis ouvrir : `http://127.0.0.1:5173/`

## Installation iPhone

Publier sur Vercel, ouvrir l'URL dans Safari → Partager → Ajouter à l'écran d'accueil.
