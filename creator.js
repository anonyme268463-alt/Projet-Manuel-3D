import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getFirestore, collection, getDocs, doc, setDoc, deleteDoc,
  serverTimestamp, writeBatch, Timestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

/*
 * GUIDE 3D — ESPACE CRÉATEUR
 * Le PIN côté navigateur est une simple barrière visuelle.
 * Il ne sécurise PAS les règles Firestore ni les appels directs à l'API.
 */
const firebaseConfig = {
  apiKey: "AIzaSyCG9nmgw8xm83xD6BlbXLyS8fCd41olX6s",
  authDomain: "guide-3d.firebaseapp.com",
  projectId: "guide-3d",
  storageBucket: "guide-3d.firebasestorage.app",
  messagingSenderId: "714446657255",
  appId: "1:714446657255:web:7ed8061d9baf056200b442",
  measurementId: "G-VJZ0W8ST2C"
};

const CREATOR_PIN = "0342";
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const schemas = {
  vehicles: {
    label: "Véhicules",
    description: "Gammes et modèles de vans.",
    example: { name: "Flex 5", slug: "flex-5", description: "", active: true, order: 1 }
  },
  finishes: {
    label: "Finitions",
    description: "Coloris et finitions compatibles avec les gammes.",
    example: {
      name: "Alba", slug: "alba", label: "Noir & Chêne",
      colors: ["#18191b", "#ba9163"], compatibleVehicleIds: [],
      imageUrl: "", active: true, order: 1
    }
  },
  workstations: {
    label: "Postes de travail",
    description: "Postes accessibles dans le parcours opérateur.",
    example: {
      name: "Cuisine", slug: "cuisine", description: "Assemblage du bloc cuisine",
      icon: "🛠️", active: true, order: 1
    }
  },
  procedures: {
    label: "Procédures",
    description: "Une procédure relie un véhicule, une finition et un poste.",
    example: {
      title: "Cuisine Flex 5 · Alba", description: "",
      vehicleId: "", finishId: "", workstationId: "",
      status: "draft", version: 1, coverImage: "", order: 1
    }
  },
  chapters: {
    label: "Chapitres",
    description: "Nomenclature et étapes intégrées dans chaque chapitre.",
    example: {
      procedureId: "", title: "Préparation", description: "", order: 1, active: true,
      bom: [{ code: "REF-001", name: "Exemple de pièce", quantity: 1 }],
      steps: [{
        title: "Étape 1",
        instruction: "Décrire précisément l’opération validée.",
        photos: [],
        tools: [],
        parts: ["REF-001"],
        check: "Point de contrôle",
        focus: []
      }]
    }
  },
  users: {
    label: "Utilisateurs",
    description: "Collection réservée à une future authentification.",
    locked: true
  }
};

let currentCollection = "vehicles";
let records = [];
let editingId = null;

const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

function setStatus(message, isError = false) {
  $("creatorStatus").textContent = message;
  $("creatorStatus").classList.toggle("error", isError);
}

function createInterface() {
  const panel = document.createElement("section");
  panel.id = "creatorPanel";
  panel.className = "creator-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <header class="creator-header">
      <div>
        <p class="eyebrow">ADMINISTRATION DU GUIDE</p>
        <h2>Espace Créateur</h2>
        <p>Gérez les données du guide sans passer par la console Firebase.</p>
      </div>
      <button id="creatorClose" class="creator-close" aria-label="Fermer">✕</button>
    </header>

    <div class="creator-toolbar">
      <nav id="creatorTabs" class="creator-tabs" aria-label="Collections"></nav>
      <div class="creator-actions">
        <button id="creatorExport" class="creator-secondary">Exporter JSON</button>
        <button id="creatorImport" class="creator-secondary">Importer JSON</button>
        <input id="creatorImportFile" type="file" accept="application/json,.json" hidden>
        <button id="creatorAdd" class="creator-primary">＋ Ajouter</button>
      </div>
    </div>

    <p id="creatorDescription" class="creator-description"></p>

    <div class="creator-layout">
      <section class="creator-list">
        <div class="creator-list-head">
          <strong>Enregistrements</strong>
          <button id="creatorRefresh" class="creator-text-button">Actualiser ↻</button>
        </div>
        <div id="creatorRecords"></div>
      </section>

      <form id="creatorForm" class="creator-form">
        <div class="creator-form-head">
          <div><span class="eyebrow">FICHE DE DONNÉES</span><h3 id="creatorFormTitle">Nouvel élément</h3></div>
          <span id="creatorIdLabel" class="creator-id">Nouvel ID</span>
        </div>
        <label for="creatorId">Identifiant (sans espace)</label>
        <input id="creatorId" required pattern="[A-Za-z0-9_-]+" placeholder="ex. flex-5">
        <label for="creatorJson">Données de l’enregistrement (JSON)</label>
        <textarea id="creatorJson" spellcheck="false" rows="18"></textarea>
        <p class="creator-help">
          Les champs createdAt et updatedAt sont gérés automatiquement.
          Les étapes et la nomenclature d’un chapitre sont stockées dans son document.
        </p>
        <div class="creator-form-actions">
          <button type="button" id="creatorDelete" class="creator-danger" hidden>Supprimer</button>
          <span></span>
          <button type="submit" class="creator-primary">Enregistrer</button>
        </div>
      </form>
    </div>

    <div id="creatorStatus" class="creator-status" role="status">Initialisation…</div>
    <p class="creator-warning">
      Le PIN protège uniquement cet écran. Les règles Firestore déterminent les droits réels d’accès à la base.
    </p>
  `;
  document.querySelector(".topbar").after(panel);

  const trigger = document.createElement("button");
  trigger.id = "creatorOpen";
  trigger.className = "creator-open";
  trigger.type = "button";
  trigger.textContent = "⚙ Espace Créateur";
  document.querySelector(".top-actions").prepend(trigger);

  document.body.insertAdjacentHTML("beforeend", `
    <div id="pinOverlay" class="pin-overlay" hidden>
      <form id="pinForm" class="pin-card">
        <div class="pin-lock">🔒</div>
        <p class="eyebrow">ZONE ADMINISTRATEUR</p>
        <h2>Espace Créateur</h2>
        <p>Entrez le code à 4 chiffres pour continuer.</p>
        <input id="pinInput" type="password" inputmode="numeric" pattern="[0-9]{4}"
          maxlength="4" autocomplete="off" placeholder="••••" required>
        <div id="pinError" class="pin-error"></div>
        <div class="pin-actions">
          <button type="button" id="pinCancel" class="creator-secondary">Annuler</button>
          <button class="creator-primary" type="submit">Déverrouiller</button>
        </div>
      </form>
    </div>
  `);

  $("creatorOpen").addEventListener("click", () => {
    $("pinOverlay").hidden = false;
    $("pinInput").value = "";
    $("pinError").textContent = "";
    $("pinInput").focus();
  });
  $("pinCancel").addEventListener("click", () => $("pinOverlay").hidden = true);
  $("pinForm").addEventListener("submit", event => {
    event.preventDefault();
    if ($("pinInput").value !== CREATOR_PIN) {
      $("pinError").textContent = "Code incorrect.";
      $("pinInput").select();
      return;
    }
    $("pinOverlay").hidden = true;
    // Session administrateur : l'anti-debugging du site est désactivé.
    window.__CREATOR_ADMIN__ = true;
    panel.hidden = false;
    loadRecords();
  });
  $("creatorClose").addEventListener("click", () => panel.hidden = true);
  $("creatorRefresh").addEventListener("click", loadRecords);
  $("creatorAdd").addEventListener("click", () => createRecord());
  $("creatorExport").addEventListener("click", exportBackup);
  $("creatorImport").addEventListener("click", () => $("creatorImportFile").click());
  $("creatorImportFile").addEventListener("change", importBackup);
  $("creatorForm").addEventListener("submit", saveRecord);
  $("creatorDelete").addEventListener("click", deleteRecord);
}

function renderTabs() {
  const tabs = $("creatorTabs");
  tabs.replaceChildren();

  Object.entries(schemas).forEach(([key, config]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = config.label;
    button.className = key === currentCollection ? "active" : "";
    button.disabled = Boolean(config.locked);
    button.addEventListener("click", () => {
      currentCollection = key;
      editingId = null;
      renderTabs();
      loadRecords();
    });
    tabs.append(button);
  });

  $("creatorDescription").textContent = schemas[currentCollection].description;
  $("creatorAdd").disabled = Boolean(schemas[currentCollection].locked);
}

async function loadRecords() {
  renderTabs();
  if (schemas[currentCollection].locked) {
    records = [];
    renderRecords();
    setStatus("Collection réservée à une future authentification.");
    return;
  }

  setStatus("Chargement des données…");
  try {
    const snapshot = await getDocs(collection(db, currentCollection));
    records = snapshot.docs
      .map(item => ({ id: item.id, data: item.data() }))
      .sort((a, b) => Number(a.data.order ?? 9999) - Number(b.data.order ?? 9999));
    renderRecords();
    setStatus(`${records.length} enregistrement(s) chargé(s).`);
    if (!editingId || !records.some(item => item.id === editingId)) createRecord(false);
  } catch (error) {
    console.error(error);
    setStatus("Lecture Firestore impossible. Vérifiez les règles et la configuration : " + error.message, true);
  }
}

function renderRecords() {
  const host = $("creatorRecords");
  host.replaceChildren();

  if (!records.length) {
    const empty = document.createElement("p");
    empty.className = "creator-empty";
    empty.textContent = "Aucun enregistrement pour le moment.";
    host.append(empty);
    return;
  }

  records.forEach(record => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "creator-record" + (record.id === editingId ? " active" : "");
    const title = record.data.name || record.data.title || record.data.label || record.id;
    button.innerHTML = `<strong>${escapeHtml(title)}</strong><small>${escapeHtml(record.id)}</small>`;
    button.addEventListener("click", () => editRecord(record));
    host.append(button);
  });
}

function createRecord(showMessage = true) {
  editingId = null;
  $("creatorFormTitle").textContent = "Nouvel élément";
  $("creatorIdLabel").textContent = "Nouvel ID";
  $("creatorId").disabled = false;
  $("creatorId").value = "";
  $("creatorJson").value = JSON.stringify(schemas[currentCollection].example ?? {}, null, 2);
  $("creatorDelete").hidden = true;
  renderRecords();
  if (showMessage) setStatus("Nouvel enregistrement prêt.");
}

function editRecord(record) {
  editingId = record.id;
  $("creatorFormTitle").textContent = "Modifier l’élément";
  $("creatorIdLabel").textContent = record.id;
  $("creatorId").value = record.id;
  $("creatorId").disabled = true;
  $("creatorJson").value = JSON.stringify(record.data, null, 2);
  $("creatorDelete").hidden = false;
  renderRecords();
  setStatus("Modification de " + record.id);
}

async function saveRecord(event) {
  event.preventDefault();
  if (schemas[currentCollection].locked) return;

  const id = $("creatorId").value.trim();
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    setStatus("Identifiant invalide : lettres, chiffres, tirets et underscores uniquement.", true);
    return;
  }

  let data;
  try {
    data = JSON.parse($("creatorJson").value);
  } catch (error) {
    setStatus("JSON invalide : " + error.message, true);
    return;
  }
  if (!data || Array.isArray(data) || typeof data !== "object") {
    setStatus("Le contenu doit être un objet JSON.", true);
    return;
  }

  const existing = records.find(item => item.id === id);
  const payload = {
    ...data,
    updatedAt: serverTimestamp(),
    ...(existing?.data.createdAt ? {} : { createdAt: serverTimestamp() }),
    schemaVersion: 1
  };

  try {
    await setDoc(doc(db, currentCollection, id), payload);
    editingId = id;
    setStatus("Enregistrement sauvegardé dans Firestore.");
    await loadRecords();
    const saved = records.find(item => item.id === id);
    if (saved) editRecord(saved);
  } catch (error) {
    console.error(error);
    setStatus("Échec de la sauvegarde : " + error.message, true);
  }
}

async function deleteRecord() {
  if (!editingId || !confirm(`Supprimer définitivement « ${editingId} » ?`)) return;
  try {
    await deleteDoc(doc(db, currentCollection, editingId));
    editingId = null;
    await loadRecords();
    createRecord(false);
    setStatus("Enregistrement supprimé.");
  } catch (error) {
    console.error(error);
    setStatus("Échec de la suppression : " + error.message, true);
  }
}

// Convertit les Timestamp Firestore en marqueurs JSON restaurables.
function encodeForJson(value) {
  if (value instanceof Timestamp) return { __firestoreTimestamp: value.toDate().toISOString() };
  if (Array.isArray(value)) return value.map(encodeForJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeForJson(item)]));
  }
  return value;
}
function decodeFromJson(value) {
  if (Array.isArray(value)) return value.map(decodeFromJson);
  if (value && typeof value === "object") {
    if (typeof value.__firestoreTimestamp === "string") {
      return Timestamp.fromDate(new Date(value.__firestoreTimestamp));
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeFromJson(item)]));
  }
  return value;
}

async function exportBackup() {
  try {
    const backup = {
      format: "guide-3d-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      collections: {}
    };
    for (const key of Object.keys(schemas)) {
      if (schemas[key].locked) continue;
      const snapshot = await getDocs(collection(db, key));
      backup.collections[key] = snapshot.docs.map(item => ({
        id: item.id,
        data: encodeForJson(item.data())
      }));
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `guide-3d-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Sauvegarde JSON exportée.");
  } catch (error) {
    console.error(error);
    setStatus("Export impossible : " + error.message, true);
  }
}

async function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!confirm("Importer cette sauvegarde ? Les documents portant les mêmes identifiants seront remplacés. Les documents absents du fichier seront conservés.")) {
    event.target.value = "";
    return;
  }

  try {
    const backup = JSON.parse(await file.text());
    if (backup.format !== "guide-3d-backup" || !backup.collections) {
      throw new Error("Fichier de sauvegarde Guide-3D non reconnu.");
    }

    const entries = [];
    for (const [key, items] of Object.entries(backup.collections)) {
      if (!schemas[key] || schemas[key].locked || !Array.isArray(items)) continue;
      for (const item of items) {
        if (!/^[A-Za-z0-9_-]+$/.test(item.id) || !item.data || typeof item.data !== "object") {
          throw new Error("Document invalide dans la collection " + key);
        }
        entries.push({ key, id: item.id, data: decodeFromJson(item.data) });
      }
    }
    if (entries.length > 450) throw new Error("Sauvegarde trop volumineuse pour une importation unique (maximum pratique : 450 documents).");

    const batch = writeBatch(db);
    for (const item of entries) {
      batch.set(doc(db, item.key, item.id), { ...item.data, restoredAt: serverTimestamp() });
    }
    if (entries.length) await batch.commit();
    setStatus(`${entries.length} document(s) importé(s). Les documents absents du fichier ne sont pas supprimés.`);
    await loadRecords();
  } catch (error) {
    console.error(error);
    setStatus("Import impossible : " + error.message, true);
  } finally {
    event.target.value = "";
  }
}

createInterface();
