# 📘 Guide de la comptabilité — BatiDesk

> Ce guide s'adresse autant au **grand débutant** (jamais fait de compta) qu'à
> celui qui **connaît la compta et découvre l'app**. Les sections « 💡 Comprendre »
> expliquent la théorie ; les sections « 🛠 Dans BatiDesk » montrent les étapes
> concrètes. Si vous connaissez déjà la compta, sautez directement aux « 🛠 ».

---

## 1. C'est quoi la comptabilité, en 2 minutes ?

**💡 Comprendre**

La comptabilité, c'est simplement **noter tout ce qui entre et sort d'argent** dans
votre entreprise, de façon organisée, pour :
- savoir si vous gagnez de l'argent (bénéfice) ou non (perte) ;
- savoir combien on vous doit et combien vous devez ;
- déclarer la TVA et payer les bons impôts ;
- pouvoir donner vos comptes à un expert-comptable ou au fisc.

En France, on utilise la **comptabilité en partie double**. Le principe :
**chaque opération est notée deux fois** — une fois pour dire *d'où vient l'argent*,
une fois pour dire *où il va*. Les deux montants sont toujours **égaux**.

On parle de **débit** (colonne de gauche) et de **crédit** (colonne de droite).
Pour chaque écriture : **total débit = total crédit**. Toujours.

> **Analogie simple** : quand un client vous paie 720 € sur votre compte bancaire :
> - votre **banque augmente** de 720 € (débit du compte banque) ;
> - votre **client ne vous doit plus** ces 720 € (crédit du compte client).
> Les deux font 720 €. C'est équilibré.

**🛠 Dans BatiDesk**

Bonne nouvelle : **vous n'avez (presque) rien à saisir en compta.** L'application
crée automatiquement les écritures quand vous faites vos opérations habituelles :
créer une facture, encaisser un paiement, saisir une dépense, une note de frais…
Vous travaillez normalement, la compta se remplit toute seule.

---

## 2. Première utilisation — choisir son mode

**💡 Comprendre**

Il existe deux façons de tenir sa compta :

| Mode | Pour qui ? | Quand l'écriture est créée |
|---|---|---|
| **Trésorerie** | Micro-entreprise, auto-entrepreneur, EI | Quand l'argent entre/sort réellement (encaissement / paiement) |
| **Engagement** | SARL, SAS, EURL | Dès la facture émise / la dépense reçue (même non encore payée) |

- **Trésorerie** = plus simple, vous suivez votre argent réel.
- **Engagement** = obligatoire en société, permet de suivre ce qu'on vous doit
  (créances) et ce que vous devez (dettes).

**🛠 Dans BatiDesk**

À la première ouverture de **Finances** ou **Comptabilité**, une fenêtre vous demande
de choisir votre mode. En cas de doute : micro/auto-entrepreneur → **Trésorerie** ;
société → **Engagement**.

➡️ Vous pourrez le changer plus tard dans **Comptabilité → Paramètres**, mais
**évitez de changer de mode une fois que vous avez des factures**, sinon relancez
« Régénérer toutes les écritures » juste après (voir §8).

---

## 3. Le vocabulaire de l'onglet Comptabilité

| Onglet | À quoi ça sert | Vous y allez quand… |
|---|---|---|
| **Livre Journal** | La liste de TOUTES les écritures, dans l'ordre | vous voulez voir le détail au jour le jour |
| **Grand Livre** | Les mouvements compte par compte | vous voulez tout ce qui concerne UN client, UN poste de charge… |
| **Balance** | Le solde de chaque compte | vous voulez une vue d'ensemble chiffrée |
| **Compte de Résultat** | Produits − Charges = bénéfice/perte | vous voulez savoir si vous gagnez de l'argent |
| **Bilan** | Ce que vous possédez / ce que vous devez | vous voulez la photo du patrimoine de l'entreprise |
| **TVA** | TVA à reverser ou crédit de TVA | vous préparez votre déclaration de TVA |
| **Plan Comptable** | La liste des « cases » où ranger l'argent | rarement — pour créer un compte sur-mesure |
| **Paramètres** | Mode, régénération | au début, ou après un import |

**💡 Comprendre — les comptes (le « plan comptable »)**

Chaque type d'opération a un **numéro de compte** normalisé (le même pour toutes les
entreprises françaises). Vous n'avez pas à les connaître, mais voici les principaux
en BTP :

| Numéro | Nom | Exemple |
|---|---|---|
| **411** | Clients | ce que vos clients vous doivent |
| **401** | Fournisseurs | ce que vous devez à vos fournisseurs |
| **512** | Banque | votre compte bancaire |
| **530** | Caisse | vos espèces |
| **706 / 704** | Prestations / Travaux | votre chiffre d'affaires |
| **601 / 604 / 611** | Achats matériaux / études / sous-traitance | vos achats |
| **445710** | TVA collectée | la TVA que vous facturez aux clients |
| **445660** | TVA déductible | la TVA que vous payez sur vos achats |

> Les comptes commençant par **6** = vos **dépenses** (charges).
> Les comptes commençant par **7** = vos **recettes** (produits).
> Chaque client a son sous-compte (411001, 411002…), chaque fournisseur aussi (401001…).

---

## 4. Le workflow quotidien (le plus important !)

**🛠 Dans BatiDesk — vous ne touchez JAMAIS directement à la compta**

```
1. Vous créez un DEVIS              → (pas d'écriture, c'est juste une proposition)
2. Le client accepte → FACTURE      → écriture automatique au journal VENTES (VE)
3. Le client paie → PAIEMENT        → écriture automatique au journal BANQUE (BQ)
4. Vous achetez du matériel → DÉPENSE → écriture automatique au journal ACHATS (AC)
5. Vous payez le fournisseur        → écriture automatique au journal BANQUE (BQ)
6. Un employé avance des frais → NOTE DE FRAIS → écriture automatique (AC puis BQ)
```

**Tout est automatique.** Vous gérez vos devis, factures, dépenses et notes de frais
comme d'habitude, et la comptabilité se construit en arrière-plan. Vous n'allez dans
l'onglet Comptabilité que pour **consulter** (et déclarer la TVA).

---

## 5. Exemple concret de bout en bout

**Situation** : vous facturez 600 € HT de travaux (TVA 20 %), soit 720 € TTC, au
client Mathieu. Il vous paie.

**🛠 Étapes dans BatiDesk**
1. **Devis & Factures → Nouvelle facture** → client Mathieu, 1 ligne « Travaux »
   600 € HT, TVA 20 %. Enregistrer.
2. Le client paie → ouvrez la facture → **Enregistrer un paiement** → 720 €.

**💡 Ce que la compta a créé automatiquement** (visible dans Livre Journal) :

*À la facture (journal VE — Ventes) :*
| Compte | Libellé | Débit | Crédit |
|---|---|---|---|
| 411-Mathieu | Facture FACT-2026-0001 | 720,00 | |
| 706000 | Prestations de services | | 600,00 |
| 445710 | TVA collectée | | 120,00 |

*Au paiement (journal BQ — Banque) :*
| Compte | Libellé | Débit | Crédit |
|---|---|---|---|
| 512000 | Encaissement FACT-2026-0001 | 720,00 | |
| 411-Mathieu | Encaissement FACT-2026-0001 | | 720,00 |

> **« Pourquoi je vois deux fois 720 € ? »** C'est normal ! La 1ʳᵉ écriture dit
> « Mathieu me doit 720 € » (411 au débit). La 2ᵉ dit « Mathieu a payé, il ne me
> doit plus rien » (411 au crédit). Le compte de Mathieu revient à zéro : la facture
> est soldée. C'est exactement le but de la partie double.

---

## 6. La TVA — comprendre et déclarer

**💡 Comprendre**

- Quand vous **facturez** un client, vous encaissez de la TVA pour l'État :
  c'est la **TVA collectée**.
- Quand vous **achetez** (matériaux, outillage…), vous payez de la TVA que vous
  pouvez récupérer : c'est la **TVA déductible**.
- À la fin de la période, vous reversez à l'État la différence :

```
TVA à reverser = TVA collectée − TVA déductible
```

Si la déductible est plus grande (gros achats), vous avez un **crédit de TVA** que
vous reportez sur la période suivante.

**🛠 Dans BatiDesk**

**Comptabilité → TVA** → choisissez la période (mois / trimestre / année).
L'app calcule automatiquement :
- TVA collectée, TVA déductible, et le montant à reverser (ou le crédit) ;
- le détail par taux (20 %, 10 %, 5,5 %).

Reportez ces montants sur votre déclaration **CA3** (sur impots.gouv.fr).

---

## 7. Lire son Compte de Résultat et son Bilan

**💡 Comprendre**

- **Compte de résultat** = est-ce que je gagne de l'argent ?
  `Produits (ventes) − Charges (achats, frais) = Bénéfice ou Perte`
- **Bilan** = quelle est la « photo » de mon entreprise à un instant T ?
  - **Actif** (à gauche) : ce que je possède (banque, ce qu'on me doit, matériel).
  - **Passif** (à droite) : d'où vient l'argent (capital, emprunts, ce que je dois).
  - **Actif = Passif**, toujours.

**🛠 Dans BatiDesk**

- **Comptabilité → Compte de Résultat** : produits à gauche, charges à droite,
  résultat net en haut.
- **Comptabilité → Bilan** : actif / passif, avec le résultat reporté
  automatiquement.

> ⚠️ **Bilan déséquilibré au début ?** C'est normal si vous n'avez pas saisi votre
> situation de départ (capital, solde de banque initial…). Le bilan devient juste
> au fil de l'activité. Pour un démarrage propre, demandez à votre expert-comptable
> vos « à-nouveaux » (soldes de début) et saisissez-les via une écriture manuelle (OD).

---

## 8. Reprendre une compta déjà commencée / régénérer

**🛠 Dans BatiDesk**

Si vous aviez déjà des factures/dépenses AVANT d'activer la compta, ou après un
changement de mode :

**Comptabilité → Paramètres → Régénérer toutes les écritures.**

L'app reconstruit toutes les écritures à partir de vos factures, paiements, dépenses
et notes de frais existants. **C'est sans risque** et vous pouvez le relancer autant
de fois que vous voulez (ça ne crée pas de doublon).

---

## 9. Saisir une écriture à la main (cas rare)

**💡 Comprendre**

Parfois il faut saisir une opération qui ne vient pas d'une facture ou d'une dépense :
salaires, amortissements, régularisations, à-nouveaux de début… On utilise alors le
journal **OD** (Opérations Diverses).

**🛠 Dans BatiDesk**

**Comptabilité → Livre Journal → Saisir OD.** Choisissez les comptes, mettez les
montants au débit et au crédit. L'app **refuse d'enregistrer** si débit ≠ crédit
(c'est une sécurité). Si vous débutez, demandez conseil à votre expert-comptable
pour ces écritures.

---

## 10. Exporter pour l'expert-comptable (FEC)

**🛠 Dans BatiDesk**

**Finances → Exporter FEC** (ou Comptabilité). Le FEC (Fichier des Écritures
Comptables) est le format **officiel** que réclament l'administration fiscale et
votre expert-comptable. Choisissez l'année, le fichier se télécharge. Transmettez-le
tel quel.

---

## 11. Les erreurs à éviter (FAQ novice)

**« J'ai changé de mode et j'ai des montants en double. »**
→ Allez dans **Paramètres → Régénérer toutes les écritures**. Ça nettoie et
reconstruit proprement.

**« Mon bilan n'est pas équilibré. »**
→ Normal au démarrage sans à-nouveaux (voir §7). Saisissez vos soldes de début
ou demandez-les à votre expert-comptable.

**« Le N° de devis/facture est vide. »**
→ Les documents créés avant la mise à jour peuvent ne pas avoir de numéro.
Recréez-en un, les nouveaux sont numérotés automatiquement.

**« Dois-je toucher au Plan Comptable ? »**
→ Non, sauf besoin précis. Tous les comptes utiles au BTP sont déjà créés. Les
plages 411001-411998 (clients) et 401001-401998 (fournisseurs) sont réservées :
l'app y range automatiquement vos tiers.

**« La compta remplace-t-elle mon expert-comptable ? »**
→ Non. BatiDesk tient votre compta au quotidien et produit le FEC. Votre
expert-comptable valide, fait le bilan officiel et les déclarations annuelles.
L'app lui fait gagner (beaucoup) de temps.

---

## 12. Récapitulatif express

1. Choisissez votre **mode** au démarrage (trésorerie ou engagement).
2. **Travaillez normalement** : devis → facture → paiement, dépenses, notes de frais.
   La compta se remplit toute seule.
3. Consultez **TVA** avant chaque déclaration.
4. Consultez **Compte de Résultat** pour voir si vous gagnez de l'argent.
5. Exportez le **FEC** pour votre expert-comptable.
6. En cas de doute : **Paramètres → Régénérer** ne casse jamais rien.

Bonne gestion ! 🏗
