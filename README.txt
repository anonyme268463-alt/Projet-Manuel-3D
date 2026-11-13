GUIDE 3D — V3 Créateur visuel (prototype)

Installation:
1. Remplacer creator.js et creator.css à la racine du dépôt.
2. L'index.html actuel charge déjà ces deux fichiers. Ne modifie pas app.js/data.js/viewer.js.
3. GitHub Pages : attendre le déploiement, puis Ctrl+F5.
4. Ouvrir « Créateur 3D » dans la barre supérieure.

Inclus:
- CRUD visuel des collections vehicles, finishes, workstations, procedures, chapters, models3d, components3d, materials, assets.
- Éditeur 3D paramétrique avec panneaux/cubes, cylindres, sphères, sélection, position, échelle, couleur et suppression.
- Import GLB/GLTF pour aperçu local, export GLB.
- Sauvegarde de la description paramétrique dans Firestore.
- Ajout d'étapes dans le tableau steps d'un document chapters.

Limites:
- Les fichiers importés GLB/GLTF sont affichés localement; le binaire n'est pas stocké dans Firestore. Pour publication, placer le GLB dans le dépôt et référencer son chemin.
- SolidWorks: exporter depuis SolidWorks en GLB/GLTF (ou convertir un STEP en GLB); SLDPRT/SLDASM ne sont pas lus directement par le navigateur.
- Ce prototype n'est pas encore le constructeur final complet: pas de drag gizmo, de réordonnancement d'étapes, de workflow de publication ni de liaison automatique à l'ancien lecteur opérateur.
- Firestore direct depuis navigateur; aucune sécurité admin serveur. Les règles Firestore restent déterminantes. N'y place pas de données internes/confidentielles si les règles sont publiques.
