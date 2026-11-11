# Guide 3D — Espace Créateur

## Fichiers
- `creator.js` : interface et opérations Firestore.
- `creator.css` : styles responsive de l'espace Créateur.
- `firestore.rules` : règles de test avec lecture/écriture publiques (dangereuses).
- `INTEGRATION.txt` : instructions d'intégration.

## Attention sécurité
Le code PIN 0342 est présent dans le JavaScript livré au navigateur. Il masque l'écran mais ne protège pas la base. Les règles `allow read, write: if true` ouvrent toute la base à Internet. N'utilise ces règles que si tu acceptes réellement ce risque, et remplace-les par une authentification administrateur avant toute utilisation avec des données internes ou sensibles.
