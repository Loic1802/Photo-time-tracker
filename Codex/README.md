# Project time tracker

Application mobile-first pour suivre les temps d'un projet photo par catégorie.

## Ce qui est prêt

- Projets multiples.
- Liste de projets en cours avec sélection rapide et carrousel tactile.
- Onglet dédié aux projets terminés.
- Onglets projet: projet, temps, frais, bilan.
- Chronomètre démarrer / terminer.
- Catégories en carrousel tactile: admin, préparation, shooting, déplacement, édition.
- Quotas estimés par catégorie en minutes, heures ou jours.
- Cumul par catégorie, temps effectif et quota total.
- Statut rapide: gagnant, à l'heure, perdant.
- Ajout manuel de temps en minutes, heures ou jours.
- Suivi des frais par projet avec catégories et total CHF.
- Prix facturé CHF, net après frais et taux horaire réel.
- Taux cible CHF/h configurable par projet avec comparaison au taux réel.
- Analyse des projets terminés: rentabilité, écarts estimé/réel, catégories sous-estimées, projets les plus rentables et conseils.
- Score manuel plaisir, stress, créativité et difficulté client.
- Clôture de projet avec le bouton "Projet terminé".
- Suppression d'un projet en cours ou terminé avec confirmation.
- Export PDF via la fenêtre d'impression du navigateur.
- Données sauvegardées localement dans le navigateur.
- Sauvegarde automatique avec copies de secours locales pour préserver les projets après mise à jour.
- Manifeste PWA et icônes pour installation sur iPhone.

## Lancer en local

Depuis ce dossier:

```bash
python3 -m http.server 5173 --bind 127.0.0.1
```

Puis ouvrir:

```text
http://127.0.0.1:5173/
```

## Installation iPhone

Pour tester depuis l'iPhone, l'app peut être publiée sur un hébergement HTTPS statique comme Netlify, Vercel ou GitHub Pages. Ensuite, ouvrir l'adresse dans Safari, puis utiliser Partager > Ajouter à l'écran d'accueil.
