# Atelier 3D · Antilope Van

Manuel d'assemblage interactif en 3D pour l'atelier de montage des vans aménagés Antilope Van.
Les opérateurs choisissent leur véhicule, leur finition et leur poste. Ils suivent ensuite la procédure étape par étape, et la pièce concernée est mise en évidence dans la vue 3D.

Site en ligne : https://anonyme268463-alt.github.io/Projet-Manuel-3D/

## Fonctionnalités

- **Connexion** par identifiant et mot de passe (Firebase Authentication), avec deux rôles : `Visit` (consultation) et `Admin`.
- **Assistant de configuration** : gamme (Flex 3, Flex 5, Flex +), coloris (Alba, Sera) et poste de travail.
- **Visionneuse 3D** (Three.js) : rotation, zoom, vue éclatée, surbrillance des pièces de l'étape.
- **Guide opérateur** : étapes, pièces concernées, points de contrôle, photos et nomenclature à cocher avant chaque chapitre.
- **Espace de travail modulable** : panneaux repliables et redimensionnables (préférences mémorisées), mode tablette d'atelier avec de plus grandes cibles tactiles.
- **Administration** (rôle `Admin`) : création et modification des comptes (nom, rôle, activation) ; chacun peut changer son propre mot de passe.
- **Espace créateur** (rôle `Admin` + code d'accès, `0342` par défaut, modifiable dans « Réglages ») : véhicules, coloris, postes, procédures, chapitres avec nomenclature, éditeur d'étapes et éditeur 3D. Les données saisies alimentent directement l'assistant et le guide.
- **Protection** : clic droit et raccourcis des outils de développement bloqués sur le guide (sauf dans l'espace créateur et la gestion des comptes). C'est une mesure dissuasive : la sécurité des données repose sur les règles Firestore.

### Raccourcis clavier

| Touche | Action |
| --- | --- |
| ← / → | Étape précédente / suivante |
| `[` / `]` | Replier ou déplier les chapitres / le guide |
| Échap | Fermer la fenêtre au premier plan |
| Double-clic sur un séparateur | Largeur par défaut |

## Structure

| Fichier | Rôle |
| --- | --- |
| `index.html` | Structure de la page |
| `styles.css` | Système de design, mise en page, accueil et assistant |
| `auth.css` / `creator.css` | Connexion, fenêtres d'administration et créateur |
| `ui.js` | Panneaux, fenêtres modales et raccourcis clavier |
| `protect.js` | Blocage du clic droit et des outils de développement |
| `app.js` | Navigation dans les procédures et lecture Firestore |
| `onboarding.js` | Écran d'accueil et assistant de configuration |
| `viewer.js` | Visionneuse 3D |
| `creator.js` | Créateur (administrateurs) |
| `auth-gate.js` | Connexion, profils et gestion des comptes |
| `firebase-client.js` | Instance Firebase partagée par tous les modules |
| `data.js` | Données de démonstration |
| `firestore.rules` | Règles de sécurité à publier dans la console Firebase |

## Configuration Firebase

- Projet : `guide-3d`.
- **Base Firestore : `default` (sans parenthèses).** Ce n'est pas la base par défaut `(default)` du SDK. Le nom est indiqué dans `firebase-client.js` (`FIRESTORE_DATABASE_ID`).
- Les règles de `firestore.rules` doivent être publiées sur la base `default` (Firestore → Sécurité). Elles incluent la collection `settings`, qui stocke l'empreinte du code d'accès du créateur.

### Publier un guide depuis l'espace créateur

1. **Données › Véhicules, Coloris, Postes** : créer les options de l'assistant.
2. **Données › Procédures** : associer un véhicule, un coloris et un poste, puis passer le statut à « Publiée ».
3. **Données › Chapitres** : créer les chapitres de la procédure (ordre, nomenclature), puis les marquer « publiés ».
4. **Étapes** : choisir un chapitre et ajouter ses étapes (instruction, pièces 3D, outils, point de contrôle, photos).

### Créer un compte

1. Utiliser le bouton **Comptes** (administrateurs connectés). C'est la méthode recommandée.
2. Ou à la main : créer un utilisateur dans **Authentication** avec l'e-mail `<identifiant>@login.guide3d.invalid`, puis un document `users/<UID>` contenant `username`, `name`, `role` (`Admin` ou `Visit`) et `active: true`.

> Ne jamais enregistrer de mot de passe dans Firestore : Firebase Authentication s'en charge.

## Développement

Site statique sans étape de compilation. Pour le tester en local :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

Toute modification de la branche `main` est publiée automatiquement par GitHub Pages.
