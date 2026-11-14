# Guide 3D — installation de la mise à jour Auth / Admin / Visit

## Contenu de la mise à jour
- Connexion par identifiant + mot de passe (aucune adresse e-mail réelle affichée).
- Deux rôles : `Visit` (consultation) et `Admin` (création/modification des contenus et comptes).
- Création des comptes depuis le panneau Admin, sans Cloud Functions, Node, terminal ou CLI.
- Authentification Firebase et profils `users/{uid}` dans Firestore.
- Règles Firestore : aucun accès anonyme, aucun auto-enregistrement de profil, aucune auto-promotion Admin.
- Le PIN 0342 n'est plus le mécanisme d'autorisation : les droits reposent sur Firebase Auth + Firestore Rules.

## 1. Activer la connexion Firebase
Dans Firebase Console > Authentication > Sign-in method :
1. Activer **Email/Password**.
2. Ne pas activer l'inscription publique dans l'interface du site (aucun bouton d'inscription n'existe).
3. Dans Authentication > Settings > Authorized domains, vérifier que le domaine GitHub Pages du site est autorisé.

Les identifiants sont transformés en identifiants techniques de la forme `identifiant@login.guide3d.invalid`. Cette adresse technique n'est pas montrée aux utilisateurs. Ne pas utiliser cette adresse pour recevoir des e-mails.

## 2. Créer le premier compte Admin (une seule fois)
Dans Firebase Console > Authentication > Users > Add user :
- E-mail : `admin@login.guide3d.invalid`
- Mot de passe : choisir un mot de passe fort et le conserver.
Puis copier l'UID attribué à ce compte.

Dans Firestore > Data, créer la collection `users`, puis un document dont l'ID est exactement cet UID, avec ces champs :
- `username` (string) : `admin`
- `name` (string) : nom affiché
- `role` (string) : `Admin`
- `active` (boolean) : `true`
- `createdAt` (timestamp) : date actuelle
- `updatedAt` (timestamp) : date actuelle

Important : le premier profil Admin doit être créé depuis la console Firestore, car aucun profil n'existe encore pour autoriser un administrateur à se créer lui-même.

## 3. Publier les règles Firestore
Dans Firestore Database > Rules, remplacer les règles existantes par le contenu complet de `firestore.rules` fourni dans cette archive, puis cliquer sur **Publier**.

Attention : ces règles remplacent l'accès public actuel. Toute ancienne page ou application utilisant ce même projet Firebase et ces collections sera soumise à ces règles.

## 4. Mettre les fichiers sur GitHub
À la racine du dépôt `Projet-Manuel-3D` :
1. Ajouter `auth-gate.js`.
2. Ajouter `auth.css`.
3. Remplacer `firestore.rules` par la version de cette archive.
4. Dans `index.html`, ajouter dans le `<head>` : `<link rel="stylesheet" href="./auth.css">`
5. Juste avant `</body>`, ajouter : `<script type="module" src="./auth-gate.js"></script>`
6. Supprimer l'ancien chargement de `protection.js` (il repose sur un PIN local et ne doit plus servir de contrôle d'accès).

Ne pas remplacer les autres fichiers du site avec cette archive : les fichiers fonctionnels existants restent en place.

## 5. Créer les comptes suivants
Se connecter avec le premier Admin, cliquer sur **⚙ Comptes**, puis créer chaque compte avec :
- un identifiant unique (3 à 30 caractères : lettres sans accent, chiffres, `.`, `_`, `-`)
- un nom affiché
- un mot de passe d'au moins 8 caractères
- le rôle `Visit` ou `Admin`

La création utilise une seconde instance Firebase Authentication : la session de l'administrateur reste active. Le compte créé reçoit automatiquement son profil Firestore.

## Fonctionnement des droits
| Fonction | Visit | Admin |
|---|---:|---:|
| Se connecter | Oui | Oui |
| Consulter le manuel | Oui | Oui |
| Ouvrir le Créateur 3D | Non | Oui |
| Créer / modifier / supprimer procédures et chapitres | Non | Oui |
| Gérer les comptes | Non | Oui |
| Modifier les modèles et médias | Non | Oui |

## Points importants / limites connues
- Les règles fournies autorisent la lecture de toutes les procédures et de tous les chapitres par un utilisateur connecté, car la version actuelle de `app.js` télécharge les collections puis filtre la procédure publiée côté navigateur. Les brouillons ne sont donc pas exposés aux visiteurs anonymes, mais un compte Visit connecté pourrait lire les documents brouillons via l'API Firestore. Une prochaine évolution doit filtrer les requêtes côté Firestore (`where("status","==","published")` et `where("procedureId","==", id)`) puis restreindre les règles aux seules procédures publiées.
- Les comptes Firebase créés mais sans document `users/{uid}` ne peuvent pas entrer dans le site ni créer leur propre profil.
- La désactivation via `active:false` bloque l'accès Firestore. Pour bloquer aussi immédiatement une session déjà ouverte, l'utilisateur devra recharger la page ou se reconnecter.
- Le mot de passe n'est jamais stocké dans Firestore.
- Les fichiers GLB/GLTF importés localement ne sont pas envoyés automatiquement dans Firestore : conserver le fichier dans le dépôt GitHub ou utiliser ultérieurement Firebase Storage.
- Les photos doivent être hébergées sur une URL accessible (ou ajoutées au dépôt) et référencées dans `photos`.
- Le projet reste un prototype non officiel. Les procédures réelles doivent être validées par l'entreprise avant utilisation en production.
