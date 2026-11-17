/*
 * ATELIER 3D — Espace créateur (administrateurs)
 *  - accès protégé par un code (0342 par défaut, modifiable dans « Réglages ») ;
 *  - formulaires structurés par collection, validation et références entre données ;
 *  - éditeur d'étapes par chapitre (ordre, duplication, pièces 3D) ;
 *  - éditeur 3D (formes simples, import/export GLB).
 * La vraie protection reste les règles Firestore : seules les écritures Admin sont acceptées.
 */
import {
  collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { db, auth } from "./firebase-client.js";

const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const slug = value => String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/\+/g, "-plus").replace(/[^a-z0-9_-]+/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
const ICON = {
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>',
  cube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3ZM12 12l8-4.5M12 12v9M12 12 4 7.5"/></svg>'
};

/* ==========================================================================
   Schémas des collections
   ========================================================================== */
const F = (key, label, type = "text", options = {}) => ({ key, label, type, ...options });
const SCHEMAS = {
  vehicles: {
    label: "Véhicules", singular: "véhicule", titleKey: "name",
    help: "Les gammes proposées dans l'assistant de configuration.",
    fields: [
      F("name", "Nom du véhicule", "text", { required: true, placeholder: "ex. Flex 3" }),
      F("description", "Description", "textarea", { placeholder: "Gamme, empattement, particularités…" }),
      F("order", "Ordre d'affichage", "number", { def: 0, half: true }),
      F("active", "Proposé dans l'assistant", "checkbox", { def: true, half: true })
    ]
  },
  finishes: {
    label: "Coloris", singular: "coloris", titleKey: "name",
    help: "Les finitions intérieures (ex. Alba, Sera).",
    fields: [
      F("name", "Nom du coloris", "text", { required: true, placeholder: "ex. Alba" }),
      F("label", "Description courte", "text", { placeholder: "ex. Noir & Chêne" }),
      F("colors", "Pastilles de couleur", "colors", { def: ["#18191b", "#ba9163"] }),
      F("order", "Ordre d'affichage", "number", { def: 0, half: true }),
      F("active", "Proposé dans l'assistant", "checkbox", { def: true, half: true })
    ]
  },
  workstations: {
    label: "Postes", singular: "poste", titleKey: "name",
    help: "Les postes de travail de l'atelier.",
    fields: [
      F("name", "Nom du poste", "text", { required: true, placeholder: "ex. Cuisine" }),
      F("description", "Description", "text", { placeholder: "ex. Assemblage du bloc cuisine" }),
      F("order", "Ordre d'affichage", "number", { def: 0, half: true }),
      F("available", "Guide disponible", "checkbox", { def: true, half: true })
    ]
  },
  procedures: {
    label: "Procédures", singular: "procédure", titleKey: "title",
    help: "Un guide = un véhicule + un coloris + un poste. Seules les procédures publiées sont visibles des opérateurs.",
    fields: [
      F("title", "Titre de la procédure", "text", { required: true, placeholder: "ex. Bloc cuisine Flex 3 Alba" }),
      F("vehicleId", "Véhicule", "ref", { ref: "vehicles", required: true, third: true }),
      F("finishId", "Coloris", "ref", { ref: "finishes", required: true, third: true }),
      F("workstationId", "Poste", "ref", { ref: "workstations", required: true, third: true }),
      F("status", "Statut", "select", { options: [["draft", "Brouillon"], ["published", "Publiée"]], def: "draft", half: true }),
      F("order", "Ordre", "number", { def: 0, half: true }),
      F("description", "Description", "textarea")
    ]
  },
  chapters: {
    label: "Chapitres", singular: "chapitre", titleKey: "title",
    help: "Les chapitres d'une procédure, avec leur nomenclature. Les étapes se modifient dans l'onglet « Étapes ».",
    fields: [
      F("title", "Titre du chapitre", "text", { required: true, placeholder: "ex. Structure du caisson" }),
      F("procedureId", "Procédure", "ref", { ref: "procedures", required: true, half: true }),
      F("order", "Ordre", "number", { def: 0, half: true }),
      F("description", "Sous-titre", "text", { placeholder: "ex. Panneaux et fond" }),
      F("published", "Chapitre publié", "checkbox", { def: false }),
      F("bom", "Nomenclature", "bom", { def: [] })
    ]
  },
  models3d: {
    label: "Modèles 3D", singular: "modèle", titleKey: "name",
    help: "Fichiers GLB ajoutés au dépôt GitHub.",
    fields: [
      F("name", "Nom du modèle", "text", { required: true }),
      F("url", "Chemin du fichier GLB", "text", { placeholder: "ex. modeles/cuisine-flex3.glb" }),
      F("description", "Description", "textarea")
    ]
  },
  components3d: {
    label: "Composants", singular: "composant", titleKey: "name",
    fields: [
      F("name", "Nom du composant", "text", { required: true }),
      F("partId", "Identifiant de pièce 3D", "text", { placeholder: "ex. sideL", half: true }),
      F("modelId", "Modèle 3D", "ref", { ref: "models3d", half: true, optional: true }),
      F("reference", "Référence article", "text", { placeholder: "ex. CUI-101" }),
      F("description", "Description", "textarea")
    ]
  },
  materials: {
    label: "Matériaux", singular: "matériau", titleKey: "name",
    fields: [
      F("name", "Nom du matériau", "text", { required: true }),
      F("reference", "Référence", "text", { half: true }),
      F("color", "Couleur", "color", { def: "#b58a60", half: true }),
      F("description", "Description", "textarea")
    ]
  },
  assets: {
    label: "Médias", singular: "média", titleKey: "name",
    fields: [
      F("name", "Nom du média", "text", { required: true }),
      F("type", "Type", "select", { options: [["image", "Image"], ["video", "Vidéo"], ["pdf", "PDF"]], def: "image", half: true }),
      F("url", "URL ou chemin", "text", { placeholder: "https://… ou medias/photo.jpg", half: true }),
      F("description", "Description", "textarea")
    ]
  }
};
const COLLECTIONS = Object.keys(SCHEMAS);
const SYSTEM_KEYS = ["createdAt", "updatedAt", "createdBy", "updatedBy"];

const PARTS = {
  sideL: "Panneau gauche", sideR: "Panneau droit", bottom: "Panneau inférieur", back: "Panneau arrière",
  top: "Plateau supérieur", sink: "Évier", hob: "Plaques", drawer: "Tiroir", shutter: "Volet",
  network: "Compartiment technique", hot: "Eau chaude", cold: "Eau froide", gas: "Gaz"
};

/* ==========================================================================
   État
   ========================================================================== */
const state = {
  page: "data",
  col: "vehicles",
  items: [],
  chosen: null,
  dirty: false,
  idTouched: false,
  cache: {},
  unlocked: false,
  steps: { chapterId: "", chapter: null, list: [], index: -1, dirty: false }
};

/* ==========================================================================
   Notifications
   ========================================================================== */
function toast(message, kind = "success") {
  let host = $("v3Toasts");
  if (!host) {
    host = document.createElement("div");
    host.id = "v3Toasts";
    host.setAttribute("role", "status");
    host.setAttribute("aria-live", "polite");
    document.body.append(host);
  }
  const item = document.createElement("div");
  item.className = `v3-toast ${kind}`;
  item.textContent = message;
  host.append(item);
  setTimeout(() => item.classList.add("out"), kind === "error" ? 5200 : 2800);
  setTimeout(() => item.remove(), kind === "error" ? 5600 : 3200);
}
function explain(error) {
  if (error?.code === "permission-denied") return "Refusé par Firebase : vérifie que ton compte est Admin et que les règles Firestore sont publiées.";
  if (error?.code === "unavailable") return "Base de données injoignable. Vérifie la connexion et réessaie.";
  return error?.message || "Erreur inattendue.";
}
function setBusy(button, busy, label) {
  if (!button) return;
  if (busy) { button.dataset.label = button.innerHTML; button.disabled = true; if (label) button.textContent = label; }
  else { button.disabled = false; if (button.dataset.label) button.innerHTML = button.dataset.label; }
}

/* ==========================================================================
   Lecture des données
   ========================================================================== */
async function fetchCollection(name, force = false) {
  if (!force && state.cache[name]) return state.cache[name];
  const snapshot = await getDocs(collection(db, name));
  const rows = snapshot.docs.map(d => ({ id: d.id, data: d.data() }))
    .sort((a, b) => (Number(a.data.order) || 0) - (Number(b.data.order) || 0) || titleOf(name, a).localeCompare(titleOf(name, b), "fr"));
  state.cache[name] = rows;
  return rows;
}
function titleOf(name, item) {
  const key = SCHEMAS[name]?.titleKey || "name";
  return String(item?.data?.[key] || item?.data?.name || item?.data?.title || item?.id || "");
}

/* ==========================================================================
   Montage de l'interface
   ========================================================================== */
function mount() {
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "creator-open icon-btn";
  trigger.title = "Créateur 3D : données, étapes et modèles";
  trigger.innerHTML = `${ICON.cube}<span class="label">Créateur 3D</span>`;
  document.querySelector(".top-actions").prepend(trigger);
  trigger.addEventListener("click", openCreator);

  // Fenêtre de code d'accès
  const lock = document.createElement("div");
  lock.id = "creatorLock";
  lock.className = "modal";
  lock.hidden = true;
  lock.dataset.window = "";
  lock.setAttribute("role", "dialog");
  lock.setAttribute("aria-modal", "true");
  lock.setAttribute("aria-labelledby", "lockTitle");
  lock.innerHTML = `
    <form class="modal-panel lock-panel" id="lockForm" autocomplete="off">
      <button type="button" class="window-close lock-close" id="lockCancel" aria-label="Fermer">${ICON.close}</button>
      <div class="lock-icon">${ICON.lock}</div>
      <h2 id="lockTitle">Espace créateur</h2>
      <p>Saisis le code d'accès pour modifier les données du guide.</p>
      <input id="lockCode" class="lock-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="• • • •" aria-label="Code d'accès" data-autofocus required>
      <p id="lockError" class="lock-error" role="alert"></p>
      <button class="btn btn-primary lock-submit" type="submit">Déverrouiller</button>
    </form>`;
  document.body.append(lock);
  $("lockForm").addEventListener("submit", submitCode);
  $("lockCancel").addEventListener("click", () => { lock.hidden = true; });

  // Fenêtre du créateur
  const panel = document.createElement("section");
  panel.id = "v3Panel";
  panel.className = "v3-panel app-window";
  panel.hidden = true;
  panel.dataset.window = "";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "v3Title");
  panel.innerHTML = `
    <header class="v3-head">
      <div><small>Atelier de conception</small><h2 id="v3Title">Espace créateur</h2><p>Véhicules, procédures, chapitres, étapes et modèles 3D du guide.</p></div>
      <div class="v3-head-actions">
        <button type="button" class="btn btn-outline v3-lock-now" id="v3LockNow" title="Verrouiller l'espace créateur">${ICON.lock}<span>Verrouiller</span></button>
        <button id="v3Close" class="window-close" type="button" aria-label="Fermer le créateur">${ICON.close}</button>
      </div>
    </header>
    <nav class="v3-tabs" role="tablist">
      <button type="button" data-page="data" class="active">Données</button>
      <button type="button" data-page="steps">Étapes</button>
      <button type="button" data-page="model">Éditeur 3D</button>
      <button type="button" data-page="settings">Réglages</button>
    </nav>

    <section id="v3data" class="v3-page">
      <div class="v3-cols" id="v3cols" role="tablist" aria-label="Collections"></div>
      <div class="v3grid">
        <div class="v3-listcard">
          <div class="v3-listhead">
            <input id="v3search" type="search" placeholder="Rechercher…" aria-label="Rechercher">
            <button type="button" class="btn btn-primary" id="v3new">${ICON.plus}<span>Nouveau</span></button>
          </div>
          <p class="v3-help" id="v3help"></p>
          <div id="v3list" class="v3-list"></div>
          <div class="v3-listfoot"><span id="v3count"></span><button type="button" class="v3-link" id="v3refresh">Actualiser</button></div>
        </div>
        <form id="v3form" class="v3-formcard" novalidate>
          <div class="v3-formhead">
            <div><small id="v3formkicker">Nouvel élément</small><h3 id="v3formtitle">Nouveau véhicule</h3></div>
            <span class="v3-dirty" id="v3dirty" hidden>Modifications non enregistrées</span>
          </div>
          <div class="v3-fields" id="v3fields"></div>
          <label class="v3-field v3-idfield">Identifiant
            <input id="v3id" autocomplete="off" spellcheck="false" placeholder="généré à partir du nom">
            <small>Lettres minuscules, chiffres et tirets. Non modifiable après création.</small>
          </label>
          <details class="v3-advanced"><summary>Champs avancés (JSON)</summary>
            <textarea id="v3json" rows="6" spellcheck="false">{}</textarea>
            <small>Propriétés supplémentaires conservées telles quelles.</small>
          </details>
          <div class="v3actions">
            <button type="button" class="btn v3-danger" id="v3delete">${ICON.trash}<span>Supprimer</span></button>
            <div class="v3actions-right">
              <button type="button" class="btn btn-outline" id="v3goSteps" hidden>Modifier les étapes →</button>
              <button type="submit" class="btn btn-primary" id="v3save">Enregistrer</button>
            </div>
          </div>
        </form>
      </div>
    </section>

    <section id="v3steps" class="v3-page" hidden>
      <div class="v3-stepbar">
        <label class="v3-field">Chapitre
          <select id="v3stepChapter"><option value="">Choisir un chapitre…</option></select>
        </label>
        <p class="v3-help" id="v3stepInfo">Choisis un chapitre pour afficher ses étapes.</p>
      </div>
      <div class="v3grid v3grid-steps">
        <div class="v3-listcard">
          <div class="v3-listhead"><strong>Étapes</strong><button type="button" class="btn btn-primary" id="v3stepNew" disabled>${ICON.plus}<span>Nouvelle étape</span></button></div>
          <ol id="v3stepList" class="v3-steplist"></ol>
        </div>
        <form id="v3stepForm" class="v3-formcard" novalidate>
          <div class="v3-formhead"><div><small id="v3stepKicker">Étape</small><h3 id="v3stepTitleHead">Aucune étape sélectionnée</h3></div></div>
          <fieldset id="v3stepFields" disabled>
            <label class="v3-field">Titre de l'étape<input id="v3stepTitle" required placeholder="ex. Repérer les panneaux"></label>
            <label class="v3-field">Instruction<textarea id="v3stepInstruction" rows="4" required placeholder="Ce que l'opérateur doit faire, simplement."></textarea></label>
            <div class="v3-field">Pièces mises en évidence dans la 3D
              <div class="v3-chips" id="v3stepParts"></div>
              <input id="v3stepFocusExtra" placeholder="Autres identifiants de pièces, séparés par des virgules">
            </div>
            <label class="v3-field">Pièces affichées (texte libre, séparées par des virgules)<input id="v3stepPartsText" placeholder="Laisser vide pour utiliser les pièces 3D sélectionnées"></label>
            <label class="v3-field">Outils (séparés par des virgules)<input id="v3stepTools" placeholder="ex. Visseuse, Équerre"></label>
            <label class="v3-field">Point de contrôle<textarea id="v3stepCheck" rows="2" placeholder="Ce qu'il faut vérifier avant de passer à la suite."></textarea></label>
            <label class="v3-field">Photos (une URL par ligne)<textarea id="v3stepPhotos" rows="2" placeholder="medias/etape-1.jpg"></textarea></label>
            <div class="v3actions"><span class="v3-dirty" id="v3stepDirty" hidden>Non enregistrée</span><div class="v3actions-right"><button type="submit" class="btn btn-primary" id="v3stepSave">Enregistrer l'étape</button></div></div>
          </fieldset>
        </form>
      </div>
    </section>

    <section id="v3model" class="v3-page" hidden>
      <div class="v3toolbar">
        <label class="v3-field">Nom du modèle<input id="v3modelname" value="Nouveau modèle"></label>
        <div class="v3-btngroup">
          <button type="button" data-shape="box">${ICON.plus} Panneau</button>
          <button type="button" data-shape="cylinder">${ICON.plus} Cylindre</button>
          <button type="button" data-shape="sphere">${ICON.plus} Sphère</button>
        </div>
        <label class="btn btn-outline v3-file">Importer GLB / GLTF<input id="v3file" type="file" accept=".glb,.gltf" hidden></label>
        <button type="button" class="btn btn-outline" id="v3export">Exporter GLB</button>
        <button type="button" class="btn btn-primary" id="v3savemodel">Enregistrer dans la base</button>
      </div>
      <div class="v3editor">
        <aside>
          <h3>Pièce sélectionnée</h3>
          <label class="v3-field">Nom<input id="objname"></label>
          <div class="v3-xyz"><span>Position</span><input id="px" type="number" step=".01" aria-label="Position X"><input id="py" type="number" step=".01" aria-label="Position Y"><input id="pz" type="number" step=".01" aria-label="Position Z"></div>
          <div class="v3-xyz"><span>Échelle</span><input id="sx" type="number" step=".01" aria-label="Échelle X"><input id="sy" type="number" step=".01" aria-label="Échelle Y"><input id="sz" type="number" step=".01" aria-label="Échelle Z"></div>
          <label class="v3-field">Couleur<input id="objcolor" type="color" value="#b58a60"></label>
          <div class="v3-row"><button type="button" class="btn btn-primary" id="applyobj">Appliquer</button><button type="button" class="btn v3-danger" id="removeobj">Supprimer</button></div>
          <h3 class="v3-sub">Pièces du modèle</h3>
          <div id="objlist" class="v3-objlist"><p class="v3-empty">Ajoute une forme ou importe un fichier GLB.</p></div>
        </aside>
        <div id="v3canvas"><span>Glisser pour tourner · Molette pour zoomer · Clic pour sélectionner</span></div>
      </div>
      <p class="v3-help">L'import GLB sert à la prévisualisation. Pour publier un modèle, ajoute le fichier GLB au dépôt GitHub et renseigne son chemin dans « Données › Modèles 3D ». Depuis SolidWorks, exporter en GLB/GLTF ou convertir depuis STEP.</p>
    </section>

    <section id="v3settings" class="v3-page" hidden>
      <form id="v3codeForm" class="v3-formcard v3-narrow" autocomplete="off">
        <div class="v3-formhead"><div><small>Sécurité</small><h3>Code d'accès de l'espace créateur</h3></div></div>
        <p class="v3-help">Le code est demandé à chaque ouverture de l'espace créateur après un rechargement de la page. Il est enregistré sous forme chiffrée (empreinte SHA-256) dans la base.</p>
        <label class="v3-field">Code actuel<input id="codeCurrent" type="password" inputmode="numeric" maxlength="8" required></label>
        <div class="v3-split">
          <label class="v3-field">Nouveau code<input id="codeNew" type="password" inputmode="numeric" maxlength="8" required placeholder="4 à 8 chiffres"></label>
          <label class="v3-field">Confirmer le nouveau code<input id="codeConfirm" type="password" inputmode="numeric" maxlength="8" required></label>
        </div>
        <div class="v3actions"><span></span><button type="submit" class="btn btn-primary" id="codeSave">Changer le code</button></div>
      </form>
    </section>`;
  document.body.append(panel);

  $("v3Close").addEventListener("click", closeCreator);
  $("v3LockNow").addEventListener("click", () => { state.unlocked = false; panel.hidden = true; toast("Espace créateur verrouillé."); });
  panel.addEventListener("window:close", event => { if (event.target === panel && !confirmLeave()) event.preventDefault(); });
  panel.querySelectorAll("[data-page]").forEach(button => button.addEventListener("click", () => showPage(button.dataset.page)));

  // Données
  $("v3search").addEventListener("input", renderList);
  $("v3new").addEventListener("click", () => { if (confirmLeave()) newItem(); });
  $("v3refresh").addEventListener("click", () => loadCollection(true));
  $("v3form").addEventListener("submit", saveItem);
  $("v3form").addEventListener("input", event => { if (event.target.id === "v3id") state.idTouched = true; markDirty(true); autoId(); });
  $("v3form").addEventListener("change", () => markDirty(true));
  $("v3delete").addEventListener("click", deleteItem);
  $("v3goSteps").addEventListener("click", () => { const id = state.chosen?.id; showPage("steps"); if (id) selectStepChapter(id); });

  // Étapes
  $("v3stepChapter").addEventListener("change", event => selectStepChapter(event.target.value));
  $("v3stepNew").addEventListener("click", () => editStep(-1));
  $("v3stepForm").addEventListener("submit", saveStep);
  $("v3stepForm").addEventListener("input", () => { state.steps.dirty = true; $("v3stepDirty").hidden = false; });

  // 3D
  panel.querySelectorAll("[data-shape]").forEach(button => button.addEventListener("click", () => addShape(button.dataset.shape)));
  $("applyobj").addEventListener("click", applyObject);
  $("removeobj").addEventListener("click", removeObject);
  $("v3export").addEventListener("click", exportGLB);
  $("v3file").addEventListener("change", importGLB);
  $("v3savemodel").addEventListener("click", saveModel);

  // Réglages
  $("v3codeForm").addEventListener("submit", changeCode);

  renderCols();
  newItem();
}

/* ==========================================================================
   Code d'accès
   ========================================================================== */
const DEFAULT_CODE = "0342";
const MAX_ATTEMPTS = 5;
let failedAttempts = 0;
let lockedUntil = 0;

async function hashCode(code) {
  const bytes = new TextEncoder().encode(`guide3d-creator:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function expectedHash() {
  try {
    const snapshot = await getDoc(doc(db, "settings", "creator"));
    if (snapshot.exists() && snapshot.data().codeHash) return snapshot.data().codeHash;
  } catch (error) {
    // Règles pas encore publiées pour « settings » : le code par défaut reste utilisable.
    if (error?.code !== "permission-denied") throw error;
  }
  return hashCode(DEFAULT_CODE);
}

function openCreator() {
  if (window.__CREATOR_ADMIN__ !== true) { toast("L'espace créateur est réservé aux administrateurs.", "error"); return; }
  if (state.unlocked) { showCreator(); return; }
  $("lockError").textContent = "";
  $("lockCode").value = "";
  $("creatorLock").hidden = false;
}

async function submitCode(event) {
  event.preventDefault();
  const input = $("lockCode");
  const error = $("lockError");
  const submit = event.target.querySelector(".lock-submit");
  if (Date.now() < lockedUntil) {
    error.textContent = `Trop d'essais. Réessaie dans ${Math.ceil((lockedUntil - Date.now()) / 1000)} s.`;
    return;
  }
  const code = input.value.trim();
  if (!/^\d{4,8}$/.test(code)) { error.textContent = "Le code contient 4 à 8 chiffres."; return; }
  setBusy(submit, true, "Vérification…");
  try {
    const [expected, given] = await Promise.all([expectedHash(), hashCode(code)]);
    if (expected !== given) {
      failedAttempts++;
      input.value = "";
      event.target.classList.remove("shake"); void event.target.offsetWidth; event.target.classList.add("shake");
      if (failedAttempts >= MAX_ATTEMPTS) {
        lockedUntil = Date.now() + 30000;
        failedAttempts = 0;
        error.textContent = "Trop d'essais. Réessaie dans 30 s.";
      } else {
        error.textContent = `Code incorrect. ${MAX_ATTEMPTS - failedAttempts} essai(s) restant(s).`;
      }
      return;
    }
    failedAttempts = 0;
    state.unlocked = true;
    $("creatorLock").hidden = true;
    showCreator();
  } catch (err) {
    error.textContent = explain(err);
  } finally {
    setBusy(submit, false);
  }
}

async function changeCode(event) {
  event.preventDefault();
  const current = $("codeCurrent").value.trim();
  const next = $("codeNew").value.trim();
  const confirmNext = $("codeConfirm").value.trim();
  if (!/^\d{4,8}$/.test(next)) return toast("Le nouveau code doit contenir 4 à 8 chiffres.", "error");
  if (next !== confirmNext) return toast("Les deux nouveaux codes ne correspondent pas.", "error");
  const button = $("codeSave");
  setBusy(button, true, "Enregistrement…");
  try {
    if (await hashCode(current) !== await expectedHash()) { toast("Le code actuel est incorrect.", "error"); return; }
    await setDoc(doc(db, "settings", "creator"), {
      codeHash: await hashCode(next),
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.uid || null
    });
    event.target.reset();
    toast("Nouveau code enregistré.");
  } catch (error) {
    toast(error?.code === "permission-denied"
      ? "Firebase refuse l'enregistrement : publie les nouvelles règles Firestore (collection settings)."
      : explain(error), "error");
  } finally {
    setBusy(button, false);
  }
}

/* ==========================================================================
   Navigation dans le créateur
   ========================================================================== */
function showCreator() {
  $("v3Panel").hidden = false;
  showPage(state.page);
}
function closeCreator() {
  if (!confirmLeave()) return;
  $("v3Panel").hidden = true;
}
function confirmLeave() {
  if (!state.dirty && !state.steps.dirty) return true;
  const ok = confirm("Des modifications ne sont pas enregistrées. Les abandonner ?");
  if (ok) { markDirty(false); state.steps.dirty = false; $("v3stepDirty").hidden = true; }
  return ok;
}
function showPage(page) {
  state.page = page;
  ["data", "steps", "model", "settings"].forEach(name => { $(`v3${name}`).hidden = name !== page; });
  document.querySelectorAll("#v3Panel [data-page]").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
    button.setAttribute("aria-selected", String(button.dataset.page === page));
  });
  if (page === "data") loadCollection();
  if (page === "steps") loadStepChapters();
  if (page === "model") { init3d(); resize3d(); }
}

/* ==========================================================================
   Onglet Données
   ========================================================================== */
function renderCols() {
  const host = $("v3cols");
  host.replaceChildren();
  COLLECTIONS.forEach(name => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = SCHEMAS[name].label;
    button.className = name === state.col ? "active" : "";
    button.setAttribute("aria-selected", String(name === state.col));
    button.addEventListener("click", () => {
      if (name === state.col || !confirmLeave()) return;
      state.col = name;
      renderCols();
      newItem();
      loadCollection();
    });
    host.append(button);
  });
}

async function loadCollection(force = false) {
  const name = state.col;
  $("v3help").textContent = SCHEMAS[name].help || "";
  $("v3list").innerHTML = '<p class="v3-empty">Chargement…</p>';
  try {
    state.items = await fetchCollection(name, force);
    if (name !== state.col) return;
    renderList();
    if (force) toast("Liste actualisée.");
  } catch (error) {
    console.error("[Créateur]", error);
    $("v3list").innerHTML = `<p class="v3-empty v3-error">${esc(explain(error))}</p>`;
  }
}

function badgesFor(name, item) {
  const d = item.data;
  const out = [];
  if (name === "procedures") out.push(d.status === "published" ? ["Publiée", "ok"] : ["Brouillon", "muted"]);
  if (name === "chapters") {
    out.push(d.published ? ["Publié", "ok"] : ["Non publié", "muted"]);
    out.push([`${Array.isArray(d.steps) ? d.steps.length : 0} étape(s)`, "info"]);
  }
  if ((name === "vehicles" || name === "finishes") && d.active === false) out.push(["Masqué", "muted"]);
  if (name === "workstations" && d.available === false) out.push(["À venir", "muted"]);
  return out;
}

function renderList() {
  const host = $("v3list");
  const query = slug($("v3search").value);
  const rows = state.items.filter(item => !query || slug(`${titleOf(state.col, item)} ${item.id}`).includes(query));
  $("v3count").textContent = `${state.items.length} ${SCHEMAS[state.col].label.toLowerCase()}`;
  host.replaceChildren();
  if (!rows.length) {
    host.innerHTML = `<p class="v3-empty">${state.items.length ? "Aucun résultat." : `Aucun ${esc(SCHEMAS[state.col].singular)} pour le moment. Clique sur « Nouveau » pour commencer.`}</p>`;
    return;
  }
  rows.forEach(item => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `v3item${state.chosen?.id === item.id ? " selected" : ""}`;
    button.innerHTML = `<b>${esc(titleOf(state.col, item))}</b><small>${esc(item.id)}</small><span class="v3-badges">${badgesFor(state.col, item).map(([t, k]) => `<i class="${k}">${esc(t)}</i>`).join("")}</span>`;
    button.addEventListener("click", () => { if (state.chosen?.id !== item.id && confirmLeave()) editItem(item); });
    host.append(button);
  });
}

async function renderFields(values) {
  const schema = SCHEMAS[state.col];
  const host = $("v3fields");
  host.replaceChildren();
  for (const field of schema.fields) {
    const value = values[field.key] ?? (Array.isArray(field.def) ? [...field.def] : field.def ?? "");
    const wrap = document.createElement(field.type === "checkbox" || field.type === "bom" || field.type === "colors" ? "div" : "label");
    wrap.className = `v3-field${field.half ? " half" : ""}${field.third ? " third" : ""}${field.type === "checkbox" ? " v3-check" : ""}`;
    wrap.dataset.key = field.key;

    if (field.type === "checkbox") {
      wrap.innerHTML = `<label class="v3-switch"><input type="checkbox" data-field="${field.key}"${value ? " checked" : ""}><span></span>${esc(field.label)}</label>`;
    } else if (field.type === "textarea") {
      wrap.append(field.label + (field.required ? " *" : ""));
      const ta = document.createElement("textarea");
      ta.rows = 3; ta.dataset.field = field.key; ta.value = value; ta.placeholder = field.placeholder || "";
      wrap.append(ta);
    } else if (field.type === "select" || field.type === "ref") {
      wrap.append(field.label + (field.required ? " *" : ""));
      const select = document.createElement("select");
      select.dataset.field = field.key;
      let options = field.options || [];
      if (field.type === "ref") {
        select.disabled = true;
        try {
          const rows = await fetchCollection(field.ref);
          options = [["", field.optional ? "— Aucun —" : `Choisir…`], ...rows.map(r => [r.id, titleOf(field.ref, r)])];
          if (value && !rows.some(r => r.id === value)) options.push([value, `${value} (introuvable)`]);
          if (!rows.length) options = [["", `Crée d'abord un élément dans « ${SCHEMAS[field.ref].label} »`]];
        } catch { options = [[value || "", value || "Lecture impossible"]]; }
        select.disabled = false;
      }
      options.forEach(([v, t]) => select.append(new Option(t, v)));
      select.value = value;
      wrap.append(select);
    } else if (field.type === "colors") {
      wrap.innerHTML = `<span>${esc(field.label)}</span><div class="v3-colors" data-field="${field.key}"></div>`;
      const box = wrap.querySelector(".v3-colors");
      const addSwatch = color => {
        const item = document.createElement("span");
        item.className = "v3-swatch";
        item.innerHTML = `<input type="color" value="${esc(color)}" aria-label="Couleur"><button type="button" aria-label="Retirer la couleur">${ICON.close}</button>`;
        item.querySelector("button").addEventListener("click", () => { item.remove(); markDirty(true); });
        box.insertBefore(item, box.querySelector(".v3-addcolor"));
      };
      const add = document.createElement("button");
      add.type = "button"; add.className = "v3-addcolor"; add.innerHTML = `${ICON.plus}<span class="sr-only">Ajouter une couleur</span>`;
      add.addEventListener("click", () => { if (box.querySelectorAll(".v3-swatch").length < 4) { addSwatch("#cccccc"); markDirty(true); } });
      box.append(add);
      (Array.isArray(value) ? value : []).forEach(addSwatch);
    } else if (field.type === "bom") {
      wrap.innerHTML = `<span>${esc(field.label)}</span>
        <div class="v3-bom" data-field="${field.key}">
          <div class="v3-bomhead"><span>Code article</span><span>Désignation</span><span>Qté</span><span></span></div>
          <div class="v3-bomrows"></div>
          <button type="button" class="v3-link v3-bomadd">${ICON.plus} Ajouter une pièce</button>
        </div>`;
      const rowsHost = wrap.querySelector(".v3-bomrows");
      const addRow = (item = {}) => {
        const [code, name, qty] = Array.isArray(item) ? item : [item.code, item.name || item.designation, item.quantity ?? item.qty];
        const row = document.createElement("div");
        row.className = "v3-bomrow";
        row.innerHTML = `<input aria-label="Code article" value="${esc(code || "")}" placeholder="CUI-101"><input aria-label="Désignation" value="${esc(name || "")}" placeholder="Panneau latéral gauche"><input aria-label="Quantité" type="number" min="0" step="1" value="${esc(qty ?? 1)}"><button type="button" class="v3-iconbtn" aria-label="Retirer la ligne">${ICON.trash}</button>`;
        row.querySelector("button").addEventListener("click", () => { row.remove(); markDirty(true); });
        rowsHost.append(row);
      };
      wrap.querySelector(".v3-bomadd").addEventListener("click", () => { addRow(); markDirty(true); rowsHost.lastElementChild?.querySelector("input")?.focus(); });
      (Array.isArray(value) ? value : []).forEach(addRow);
    } else {
      wrap.append(field.label + (field.required ? " *" : ""));
      const input = document.createElement("input");
      input.type = field.type === "number" ? "number" : field.type === "color" ? "color" : "text";
      input.dataset.field = field.key;
      input.value = value;
      input.placeholder = field.placeholder || "";
      if (field.type === "number") input.step = "1";
      wrap.append(input);
    }
    host.append(wrap);
  }
}

function readFields() {
  const values = {};
  for (const field of SCHEMAS[state.col].fields) {
    if (field.type === "colors") {
      values[field.key] = [...$("v3fields").querySelectorAll(`[data-field="${field.key}"] input[type=color]`)].map(i => i.value);
    } else if (field.type === "bom") {
      values[field.key] = [...$("v3fields").querySelectorAll(`[data-field="${field.key}"] .v3-bomrow`)].map(row => {
        const [code, name, qty] = row.querySelectorAll("input");
        return { code: code.value.trim(), name: name.value.trim(), quantity: Number(qty.value) || 0 };
      }).filter(item => item.code || item.name);
    } else {
      const el = $("v3fields").querySelector(`[data-field="${field.key}"]`);
      if (!el) continue;
      if (field.type === "checkbox") values[field.key] = el.checked;
      else if (field.type === "number") values[field.key] = Number(el.value) || 0;
      else values[field.key] = el.value.trim();
    }
  }
  return values;
}

function markDirty(on) {
  state.dirty = on;
  $("v3dirty").hidden = !on;
}
function autoId() {
  if (state.chosen || state.idTouched) return;
  const key = SCHEMAS[state.col].titleKey;
  const title = $("v3fields").querySelector(`[data-field="${key}"]`)?.value || "";
  $("v3id").value = slug(title);
}

async function newItem() {
  state.chosen = null;
  state.idTouched = false;
  const schema = SCHEMAS[state.col];
  $("v3formkicker").textContent = "Nouvel élément";
  $("v3formtitle").textContent = `Nouveau ${schema.singular}`;
  $("v3id").value = "";
  $("v3id").disabled = false;
  $("v3json").value = "{}";
  $("v3delete").hidden = true;
  $("v3goSteps").hidden = true;
  await renderFields({});
  markDirty(false);
  renderList();
}

async function editItem(item) {
  state.chosen = item;
  const schema = SCHEMAS[state.col];
  $("v3formkicker").textContent = `${schema.singular[0].toUpperCase()}${schema.singular.slice(1)}`;
  $("v3formtitle").textContent = titleOf(state.col, item);
  $("v3id").value = item.id;
  $("v3id").disabled = true;
  const known = new Set([...schema.fields.map(f => f.key), ...SYSTEM_KEYS, "steps"]);
  const extra = Object.fromEntries(Object.entries(item.data).filter(([k]) => !known.has(k)));
  $("v3json").value = JSON.stringify(extra, null, 2);
  $("v3delete").hidden = false;
  $("v3goSteps").hidden = state.col !== "chapters";
  renderList();
  await renderFields(item.data);
  markDirty(false);
}

async function saveItem(event) {
  event.preventDefault();
  const schema = SCHEMAS[state.col];
  const name = state.col;
  const values = readFields();

  // Validation
  $("v3fields").querySelectorAll(".invalid").forEach(el => el.classList.remove("invalid"));
  const missing = schema.fields.filter(f => f.required && (values[f.key] === "" || values[f.key] == null));
  if (missing.length) {
    missing.forEach(f => $("v3fields").querySelector(`[data-key="${f.key}"]`)?.classList.add("invalid"));
    toast(`Champ obligatoire : ${missing.map(f => f.label).join(", ")}.`, "error");
    return;
  }
  let extra;
  try {
    extra = JSON.parse($("v3json").value.trim() || "{}");
    if (typeof extra !== "object" || Array.isArray(extra) || extra === null) throw new Error("un objet { … } est attendu");
  } catch (error) {
    toast(`Champs avancés : JSON invalide (${error.message}).`, "error");
    $("v3form").querySelector(".v3-advanced").open = true;
    return;
  }
  const editing = Boolean(state.chosen);
  const id = editing ? state.chosen.id : slug($("v3id").value || values[schema.titleKey]);
  if (!id) { toast("Identifiant manquant.", "error"); return; }
  if (!editing && state.items.some(item => item.id === id)) {
    toast(`L'identifiant « ${id} » existe déjà. Choisis-en un autre.`, "error");
    $("v3id").focus();
    return;
  }

  const original = editing ? state.chosen.data : {};
  const uid = auth.currentUser?.uid || null;
  const data = { ...extra, ...values };
  if (name === "chapters") data.steps = Array.isArray(original.steps) ? original.steps : [];
  data.createdAt = original.createdAt || serverTimestamp();
  data.createdBy = original.createdBy || uid;
  data.updatedAt = serverTimestamp();
  data.updatedBy = uid;

  const button = $("v3save");
  setBusy(button, true, "Enregistrement…");
  try {
    await setDoc(doc(db, name, id), data);
    markDirty(false);
    toast(editing ? "Modifications enregistrées." : `${schema.singular[0].toUpperCase()}${schema.singular.slice(1)} créé(e).`);
    state.items = await fetchCollection(name, true);
    const saved = state.items.find(item => item.id === id);
    if (saved) await editItem(saved);
  } catch (error) {
    console.error("[Créateur]", error);
    toast(explain(error), "error");
  } finally {
    setBusy(button, false);
  }
}

async function deleteItem() {
  const item = state.chosen;
  if (!item) return;
  const label = titleOf(state.col, item);
  if (!confirm(`Supprimer définitivement « ${label} » ?\nCette action est irréversible.`)) return;
  try {
    await deleteDoc(doc(db, state.col, item.id));
    toast(`« ${label} » supprimé.`);
    state.items = await fetchCollection(state.col, true);
    await newItem();
  } catch (error) {
    toast(explain(error), "error");
  }
}

/* ==========================================================================
   Onglet Étapes
   ========================================================================== */
async function loadStepChapters() {
  const select = $("v3stepChapter");
  try {
    const [chapters, procedures] = await Promise.all([fetchCollection("chapters", true), fetchCollection("procedures")]);
    const current = state.steps.chapterId;
    select.replaceChildren(new Option(chapters.length ? "Choisir un chapitre…" : "Aucun chapitre : crée-en un dans « Données ›  Chapitres »", ""));
    const byProcedure = new Map();
    chapters.forEach(chapter => {
      const key = chapter.data.procedureId || "";
      if (!byProcedure.has(key)) byProcedure.set(key, []);
      byProcedure.get(key).push(chapter);
    });
    byProcedure.forEach((list, procedureId) => {
      const procedure = procedures.find(p => p.id === procedureId);
      const group = document.createElement("optgroup");
      group.label = procedure ? titleOf("procedures", procedure) : "Sans procédure";
      list.forEach(chapter => group.append(new Option(titleOf("chapters", chapter), chapter.id)));
      select.append(group);
    });
    if (current) { select.value = current; selectStepChapter(current, true); }
  } catch (error) {
    toast(explain(error), "error");
  }
}

function selectStepChapter(chapterId, keepIndex = false) {
  if (!keepIndex && state.steps.dirty && !confirmLeave()) { $("v3stepChapter").value = state.steps.chapterId; return; }
  const chapter = (state.cache.chapters || []).find(c => c.id === chapterId) || null;
  state.steps.chapterId = chapter ? chapterId : "";
  state.steps.chapter = chapter;
  state.steps.list = chapter && Array.isArray(chapter.data.steps) ? chapter.data.steps.map(s => ({ ...s })) : [];
  $("v3stepChapter").value = state.steps.chapterId;
  $("v3stepNew").disabled = !chapter;
  $("v3stepInfo").textContent = chapter
    ? `${state.steps.list.length} étape(s) · ${chapter.data.published ? "chapitre publié" : "chapitre non publié"}. Chaque modification est enregistrée directement.`
    : "Choisis un chapitre pour afficher ses étapes.";
  renderStepList();
  editStep(keepIndex && state.steps.index < state.steps.list.length ? state.steps.index : (state.steps.list.length ? 0 : null));
}

function renderStepList() {
  const host = $("v3stepList");
  host.replaceChildren();
  if (!state.steps.chapter) { host.innerHTML = '<p class="v3-empty">Aucun chapitre sélectionné.</p>'; return; }
  if (!state.steps.list.length) { host.innerHTML = '<p class="v3-empty">Ce chapitre n\'a pas encore d\'étape.</p>'; return; }
  state.steps.list.forEach((step, index) => {
    const li = document.createElement("li");
    li.className = `v3-step${index === state.steps.index ? " selected" : ""}`;
    li.innerHTML = `<button type="button" class="v3-steppick"><span class="v3-stepnum">${String(index + 1).padStart(2, "0")}</span><span><b>${esc(step.title || "Sans titre")}</b><small>${esc((step.instruction || step.description || "").slice(0, 70))}</small></span></button>
      <span class="v3-stepactions">
        <button type="button" class="v3-iconbtn" data-act="up" aria-label="Monter" ${index === 0 ? "disabled" : ""}>${ICON.up}</button>
        <button type="button" class="v3-iconbtn" data-act="down" aria-label="Descendre" ${index === state.steps.list.length - 1 ? "disabled" : ""}>${ICON.down}</button>
        <button type="button" class="v3-iconbtn" data-act="copy" aria-label="Dupliquer">${ICON.copy}</button>
        <button type="button" class="v3-iconbtn danger" data-act="delete" aria-label="Supprimer">${ICON.trash}</button>
      </span>`;
    li.querySelector(".v3-steppick").addEventListener("click", () => { if (index !== state.steps.index && confirmLeave()) editStep(index); });
    li.querySelectorAll("[data-act]").forEach(button => button.addEventListener("click", () => stepAction(button.dataset.act, index)));
    host.append(li);
  });
}

function renderPartChips(selected) {
  const host = $("v3stepParts");
  host.replaceChildren();
  Object.entries(PARTS).forEach(([id, label]) => {
    const chip = document.createElement("label");
    chip.className = "v3-chip";
    chip.innerHTML = `<input type="checkbox" value="${id}"${selected.includes(id) ? " checked" : ""}><span>${esc(label)}</span>`;
    host.append(chip);
  });
}

function editStep(index) {
  const fields = $("v3stepFields");
  state.steps.dirty = false;
  $("v3stepDirty").hidden = true;
  if (index === null || !state.steps.chapter) {
    state.steps.index = -1;
    fields.disabled = true;
    $("v3stepForm").reset();
    renderPartChips([]);
    $("v3stepKicker").textContent = "Étape";
    $("v3stepTitleHead").textContent = state.steps.chapter ? "Ajoute une première étape" : "Aucune étape sélectionnée";
    renderStepList();
    return;
  }
  fields.disabled = false;
  state.steps.index = index;
  const step = index >= 0 ? state.steps.list[index] : {};
  const focus = Array.isArray(step.focus) ? step.focus : [];
  $("v3stepKicker").textContent = index >= 0 ? `Étape ${String(index + 1).padStart(2, "0")}` : "Nouvelle étape";
  $("v3stepTitleHead").textContent = index >= 0 ? (step.title || "Sans titre") : `Étape ${String(state.steps.list.length + 1).padStart(2, "0")}`;
  $("v3stepTitle").value = step.title || "";
  $("v3stepInstruction").value = step.instruction || step.description || "";
  renderPartChips(focus);
  $("v3stepFocusExtra").value = focus.filter(id => !PARTS[id]).join(", ");
  $("v3stepPartsText").value = (Array.isArray(step.parts) ? step.parts : []).map(p => typeof p === "string" ? p : p?.name || "").filter(Boolean).join(", ");
  $("v3stepTools").value = (Array.isArray(step.tools) ? step.tools : []).join(", ");
  $("v3stepCheck").value = step.check || step.checkpoint || "";
  $("v3stepPhotos").value = (Array.isArray(step.photos) ? step.photos : []).map(p => typeof p === "string" ? p : p?.url || "").filter(Boolean).join("\n");
  renderStepList();
  if (index < 0) $("v3stepTitle").focus();
}

const splitList = value => value.split(",").map(s => s.trim()).filter(Boolean);

async function persistSteps(message) {
  const chapterId = state.steps.chapterId;
  if (!chapterId) return false;
  try {
    await updateDoc(doc(db, "chapters", chapterId), {
      steps: state.steps.list,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.uid || null
    });
    const cached = (state.cache.chapters || []).find(c => c.id === chapterId);
    if (cached) cached.data.steps = state.steps.list.map(s => ({ ...s }));
    $("v3stepInfo").textContent = `${state.steps.list.length} étape(s) · ${state.steps.chapter?.data.published ? "chapitre publié" : "chapitre non publié"}. Chaque modification est enregistrée directement.`;
    toast(message);
    return true;
  } catch (error) {
    toast(explain(error), "error");
    return false;
  }
}

async function saveStep(event) {
  event.preventDefault();
  const title = $("v3stepTitle").value.trim();
  const instruction = $("v3stepInstruction").value.trim();
  if (!title || !instruction) { toast("Le titre et l'instruction sont obligatoires.", "error"); return; }
  const focus = [
    ...[...$("v3stepParts").querySelectorAll("input:checked")].map(i => i.value),
    ...splitList($("v3stepFocusExtra").value)
  ];
  const step = {
    title,
    instruction,
    focus: [...new Set(focus)],
    parts: splitList($("v3stepPartsText").value),
    tools: splitList($("v3stepTools").value),
    check: $("v3stepCheck").value.trim(),
    photos: $("v3stepPhotos").value.split("\n").map(s => s.trim()).filter(Boolean)
  };
  const previous = state.steps.list.map(s => ({ ...s }));
  const isNew = state.steps.index < 0;
  if (isNew) state.steps.list.push(step);
  else state.steps.list[state.steps.index] = { ...state.steps.list[state.steps.index], ...step };
  const button = $("v3stepSave");
  setBusy(button, true, "Enregistrement…");
  const ok = await persistSteps(isNew ? "Étape ajoutée." : "Étape enregistrée.");
  setBusy(button, false);
  if (!ok) { state.steps.list = previous; return; }
  editStep(isNew ? state.steps.list.length - 1 : state.steps.index);
}

async function stepAction(action, index) {
  const list = state.steps.list;
  const previous = list.map(s => ({ ...s }));
  let target = index;
  let message = "";
  if (action === "up" && index > 0) { [list[index - 1], list[index]] = [list[index], list[index - 1]]; target = index - 1; message = "Ordre mis à jour."; }
  else if (action === "down" && index < list.length - 1) { [list[index + 1], list[index]] = [list[index], list[index + 1]]; target = index + 1; message = "Ordre mis à jour."; }
  else if (action === "copy") { list.splice(index + 1, 0, { ...list[index], title: `${list[index].title || "Étape"} (copie)` }); target = index + 1; message = "Étape dupliquée."; }
  else if (action === "delete") {
    if (!confirm(`Supprimer l'étape « ${list[index].title || "sans titre"} » ?`)) return;
    list.splice(index, 1);
    target = Math.min(index, list.length - 1);
    message = "Étape supprimée.";
  } else return;
  if (await persistSteps(message)) editStep(list.length ? target : null);
  else { state.steps.list = previous; renderStepList(); }
}

/* ==========================================================================
   Onglet Éditeur 3D (chargé à la première ouverture)
   ========================================================================== */
const three = { ready: false };

async function init3d() {
  if (three.ready || three.loading) return three.loading;
  three.loading = (async () => {
    const [THREE, { OrbitControls }, { GLTFLoader }, { GLTFExporter }] = await Promise.all([
      import("three"),
      import("three/addons/controls/OrbitControls.js"),
      import("three/addons/loaders/GLTFLoader.js"),
      import("three/addons/exporters/GLTFExporter.js")
    ]);
    Object.assign(three, { THREE, GLTFLoader, GLTFExporter });
    const host = $("v3canvas");
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#eef1f7");
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    camera.position.set(4, 3, 5);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.append(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8090a0, 2));
    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(4, 8, 5);
    scene.add(light);
    scene.add(new THREE.GridHelper(10, 20, 0xc3cbdc, 0xdde2ec));
    const group = new THREE.Group();
    scene.add(group);
    Object.assign(three, { scene, camera, renderer, controls, group, ray: new THREE.Raycaster(), selected: null });
    renderer.domElement.addEventListener("click", pick);
    new ResizeObserver(resize3d).observe(host);
    const loop = () => { requestAnimationFrame(loop); if (!$("v3model").hidden && !$("v3Panel").hidden) { controls.update(); renderer.render(scene, camera); } };
    loop();
    three.ready = true;
    resize3d();
  })().catch(error => { console.error(error); toast("L'éditeur 3D n'a pas pu se charger.", "error"); three.loading = null; });
  return three.loading;
}
function resize3d() {
  if (!three.ready) return;
  const host = $("v3canvas");
  const w = host.clientWidth, h = host.clientHeight;
  if (!w || !h) return;
  three.renderer.setSize(w, h);
  three.camera.aspect = w / h;
  three.camera.updateProjectionMatrix();
}
function pick(event) {
  const rect = three.renderer.domElement.getBoundingClientRect();
  const pointer = new three.THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  three.ray.setFromCamera(pointer, three.camera);
  const hit = three.ray.intersectObjects(three.group.children, true)[0];
  if (hit) { let o = hit.object; while (o.parent !== three.group && o.parent) o = o.parent; selectObject(o); }
}
async function addShape(type) {
  await init3d();
  const { THREE, group } = three;
  const geometry = type === "box" ? new THREE.BoxGeometry(1, 1, 0.12) : type === "cylinder" ? new THREE.CylinderGeometry(0.5, 0.5, 1, 32) : new THREE.SphereGeometry(0.5, 24, 16);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: "#b58a60", roughness: 0.7 }));
  mesh.name = `${{ box: "panneau", cylinder: "cylindre", sphere: "sphere" }[type]}-${group.children.length + 1}`;
  mesh.position.y = 0.5;
  group.add(mesh);
  selectObject(mesh);
  listObjects();
}
const firstMesh = root => { let found = null; root.traverse(o => { if (!found && o.isMesh) found = o; }); return found; };
function selectObject(object) {
  three.selected = object;
  $("objname").value = object.name || "Objet importé";
  ["x", "y", "z"].forEach(axis => { $(`p${axis}`).value = +object.position[axis].toFixed(3); $(`s${axis}`).value = +object.scale[axis].toFixed(3); });
  const mesh = firstMesh(object);
  $("objcolor").value = mesh?.material?.color ? `#${mesh.material.color.getHexString()}` : "#b58a60";
  listObjects();
}
function applyObject() {
  const o = three.selected;
  if (!o) return toast("Sélectionne d'abord une pièce.", "error");
  o.name = $("objname").value.trim() || o.name;
  o.position.set(+$("px").value, +$("py").value, +$("pz").value);
  o.scale.set(Math.max(0.01, +$("sx").value), Math.max(0.01, +$("sy").value), Math.max(0.01, +$("sz").value));
  o.traverse(m => { if (m.isMesh && m.material?.color) m.material.color.set($("objcolor").value); });
  listObjects();
  toast("Pièce mise à jour.");
}
function removeObject() {
  const o = three.selected;
  if (!o) return;
  three.group.remove(o);
  o.traverse?.(m => { m.geometry?.dispose(); (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => x?.dispose?.()); });
  three.selected = null;
  listObjects();
}
function listObjects() {
  const host = $("objlist");
  host.replaceChildren();
  if (!three.group?.children.length) { host.innerHTML = '<p class="v3-empty">Ajoute une forme ou importe un fichier GLB.</p>'; return; }
  three.group.children.forEach(o => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `v3item${o === three.selected ? " selected" : ""}`;
    button.textContent = o.name || "Objet importé";
    button.addEventListener("click", () => selectObject(o));
    host.append(button);
  });
}
async function saveModel() {
  await init3d();
  const name = $("v3modelname").value.trim() || "Nouveau modèle";
  const id = slug(name) || `modele-${Date.now()}`;
  if (!three.group.children.length) return toast("Le modèle est vide.", "error");
  try {
    await setDoc(doc(db, "models3d", id), {
      name, unit: "m",
      objects: three.group.children.map(o => ({ name: o.name, position: o.position.toArray(), rotation: o.rotation.toArray().slice(0, 3), scale: o.scale.toArray(), geometry: o.geometry?.type || "GLTF" })),
      updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid || null
    }, { merge: true });
    delete state.cache.models3d;
    toast(`Modèle « ${name} » enregistré (${id}).`);
  } catch (error) { toast(explain(error), "error"); }
}
async function exportGLB() {
  await init3d();
  new three.GLTFExporter().parse(three.group, result => {
    const url = URL.createObjectURL(new Blob([result], { type: "model/gltf-binary" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${slug($("v3modelname").value) || "modele"}.glb`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Fichier GLB exporté.");
  }, error => toast(`Export impossible : ${error.message}`, "error"), { binary: true });
}
async function importGLB(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  await init3d();
  const url = URL.createObjectURL(file);
  new three.GLTFLoader().load(url, gltf => {
    gltf.scene.name = file.name.replace(/\.(glb|gltf)$/i, "");
    three.group.add(gltf.scene);
    selectObject(gltf.scene);
    toast("Modèle importé pour prévisualisation.");
    URL.revokeObjectURL(url);
  }, undefined, error => { toast(`Import impossible : ${error.message}`, "error"); URL.revokeObjectURL(url); });
  event.target.value = "";
}

/* ==========================================================================
   Session : verrouiller à la déconnexion ou au changement d'utilisateur
   ========================================================================== */
let lastUid = null;
onAuthStateChanged(auth, user => {
  const uid = user?.uid || null;
  if (uid !== lastUid) {
    state.unlocked = false;
    state.cache = {};
    state.dirty = false;
    state.steps = { chapterId: "", chapter: null, list: [], index: -1, dirty: false };
    if ($("v3Panel")) $("v3Panel").hidden = true;
    if ($("creatorLock")) $("creatorLock").hidden = true;
  }
  lastUid = uid;
});

mount();
