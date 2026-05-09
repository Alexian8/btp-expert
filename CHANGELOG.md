# CHANGELOG

Tous les changements notables de BatiDesk sont documentés ici.

---

## 1.0.0 — 2026-04-26 🎉

**Première release officielle de BatiDesk** — application de gestion pour
les artisans du bâtiment, développée pour JACOB HABITAT.

### ✨ Fonctionnalités principales

- **Gestion clients** : carnet d'adresses, particuliers / pros, civilité, contacts
- **Sous-traitants** : suivi avec attestations URSSAF/AGEFIPH/RC pro
- **Fournisseurs** : avec auto-complétion SIRENE
- **Chantiers** : statut (prospect/en cours/terminé), priorité, photos, catégories
- **Devis** : éditeur avancé avec lignes Pose/Fourniture, postes, marges, remises
- **Factures** : suivi des paiements, retards, avoirs, attestation TVA 5,5%/10%
- **Notes de frais** : avec refacturation client + justificatifs scannés
- **Bons de commande** + **Situations de chantier**
- **Documents administratifs** : DC4, attestations TVA, PV de réception
- **Coffre-fort** chiffré AES-256-GCM (auto-stockage des docs chantier)
- **Agenda** avec sync Microsoft Outlook (OAuth2)
- **Statistiques** : pipeline devis, retards de paiement, comparaison année N/N-1
- **Comptabilité** : export FEC conforme administration fiscale
- **Catégories chantier** personnalisables (corps d'état avec icônes/couleurs)
- **Catégories docs** chantier personnalisables
- **Sauvegarde pro** (.btpbackup) avec manifest + SHA-256 + sync OneDrive
- **Personnalisation sidebar** (drag & drop, masquage, persistance)
- **Apparence** : 3 modes (clair/sombre/auto), 8 accents, 4 radius, 3 densités
- **Recherche globale** Ctrl+K (palette de commandes)
- **Auto-complétion adresse BAN** (Base Adresse Nationale)
- **Génération PDF** professionnels (devis, factures, attestations)

### 🛠 Tech stack

- Electron 33 + Node 20
- React 18 + TypeScript 5 + Vite 5
- SQLite (better-sqlite3) + WAL mode
- Tailwind CSS 3 + shadcn/ui
- Zustand (state management)
- Puppeteer-core (génération PDF)

### 📋 Sessions de développement (résumé chronologique)

- **S1-S10** : Foundation, architecture, composants UI, stores
- **S11** : Coffre-fort chiffré
- **S12** : Agenda + intégration Outlook
- **S13** : Comptabilité + export FEC
- **S14** : Notes de frais
- **S15** : Sous-traitants + attestations
- **S16** : Statistiques + KPIs
- **S17** : Documents administratifs (DC4, TVA, PV)
- **S18** : Génération PDF (templates HTML→PDF)
- **S19** : Polish UX
- **S20** : Quick wins UX + conversions
- **S21** : Sidebar perso + Catégories docs perso + a11y densité
- **S22** : Auto-complétion BAN partout + Catalogue catégories chantier
- **S23** : Sauvegarde pro (.btpbackup) avec manifest + SHA-256
- **1.0.0** : Release officielle, version 1.0.0, dashboard enrichi (CA mois/année + tendance)

### 🎨 Améliorations dashboard 1.0.0

- Badge `v1.0.0` discret dans le greeting
- KPI "CA encaissé cette année" ajouté
- Tendance % du CA mois courant vs mois précédent (vert/rouge)
- "Clients" déplacé hors KPI principaux (toujours accessible via sidebar)

### 🔧 Configuration

- Support Windows 10/11 x64
- Installeur NSIS avec choix du dossier d'installation
- Démarrage menu démarrer + raccourci bureau
- Support code signing Windows (voir `SIGNATURE_DE_CODE.md`)

### 📦 Distribution

- Format : `BatiDesk-Setup-1.0.0.exe` (NSIS installer)
- Taille estimée : ~150-200 Mo (Electron + Puppeteer Chromium bundlé)
- Architecture : x64 uniquement

---

## Notes de migration

### Depuis les versions précédentes (16.0.0)

La transition `16.0.0` → `1.0.0` est **transparente** pour l'utilisateur :
- Les données restent au même endroit (`%APPDATA%/BatiDesk/`)
- Les anciens backups `.db` restent restaurables (rétrocompatibilité S23)
- Aucune migration manuelle requise
- L'installateur 1.0.0 reconnaît l'installation 16.0.0 et la met à jour

### Recommandation avant la mise à jour

1. Ouvrir BatiDesk en version 16.x.x
2. Aller dans Paramètres > Sauvegarde
3. Cliquer "Sauvegarder maintenant" pour avoir une copie
4. Désinstaller l'ancienne version
5. Installer la 1.0.0
6. Vérifier que toutes les données sont là
