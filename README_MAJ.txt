MISE À JOUR GUIDE 3D — AUTHENTIFICATION ET RÔLES

Fichiers nouveaux :
- auth-gate.js
- auth.css

Fichier à remplacer :
- firestore.rules

Modifications à faire dans index.html :
- ajouter auth.css dans le head
- ajouter auth-gate.js avant </body>
- retirer le script protection.js

Le guide d'installation complet est dans INSTALLATION_FIREBASE.md.

AUCUN terminal, Node, Cloud Functions ou CLI requis.
Le premier Admin se crée une fois depuis Firebase Authentication + Firestore Console.
Ensuite, les comptes Visit/Admin se créent depuis le site.
