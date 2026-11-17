/*
 * GUIDE 3D — Authentification et profils utilisateurs
 * Identifiant public converti en adresse technique Firebase Auth.
 * Le mot de passe n'est jamais stocké dans Firestore.
 */
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  collection, doc, getDocFromServer, getDocs, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { auth, db, getAccountCreationAuth } from "./firebase-client.js";

const $ = id => document.getElementById(id);
let currentProfile = null;
let activeUser = null;
let authObserverStarted = false;
let profileCheckSequence = 0;

const loginEmail = username => {
  const clean = String(username || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(clean)) {
    throw new Error("L'identifiant doit contenir 3 à 30 caractères : lettres, chiffres, point, tiret ou underscore.");
  }
  return `${clean}@login.guide3d.invalid`;
};

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])
);

function ensureShell() {
  if (!$("guideAuthOverlay")) {
    const overlay = document.createElement("div");
    overlay.id = "guideAuthOverlay";
    overlay.innerHTML = `
      <section class="ga-card" role="dialog" aria-modal="true" aria-labelledby="gaTitle">
        <div class="ga-brand"><img src="./atelier-3d-mark.svg" alt="" width="34" height="34"><div><strong>Atelier <span>3D</span></strong><small>Antilope Van</small></div></div>
        <h1 id="gaTitle">Connexion à l'atelier</h1>
        <p class="ga-subtitle">Identifie-toi pour accéder aux procédures et aux outils autorisés.</p>
        <form id="gaLoginForm">
          <label for="gaUsername">Identifiant</label>
          <input id="gaUsername" autocomplete="username" required maxlength="30" placeholder="Ton identifiant">
          <label for="gaPassword">Mot de passe</label>
          <input id="gaPassword" type="password" autocomplete="current-password" required placeholder="Mot de passe">
          <p id="gaError" class="ga-error" role="alert"></p>
          <button class="ga-primary" type="submit"><span class="ga-label">Se connecter</span><span aria-hidden="true">→</span></button>
          <button id="gaRetryProfile" class="ga-retry" type="button" hidden>Réessayer la vérification</button>
        </form>
        <p class="ga-foot">Les comptes sont créés uniquement par un administrateur.</p>
      </section>`;
    document.body.append(overlay);
    $("gaLoginForm").addEventListener("submit", login);
    $("gaRetryProfile").addEventListener("click", () => {
      if (activeUser) verifyProfile(activeUser);
    });
  }

  if (!$("guideAccountPanel")) {
    const panel = document.createElement("section");
    panel.id = "guideAccountPanel";
    panel.className = "app-window";
    panel.hidden = true;
    panel.dataset.window = "";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "gaAdminTitle");
    panel.innerHTML = `
      <div class="ga-admin-head">
        <div><small>Administration</small><h2 id="gaAdminTitle">Gestion des accès</h2><p>Créer, modifier et désactiver les comptes opérateurs et administrateurs.</p></div>
        <button id="gaCloseAdmin" class="window-close" type="button" aria-label="Fermer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>
      <h3 class="ga-section-title">Créer un compte</h3>
      <form id="gaCreateForm" class="ga-create-form">
        <label>Identifiant<input id="gaNewUsername" required minlength="3" maxlength="30" pattern="[A-Za-z0-9._-]+" placeholder="ex. atelier01"></label>
        <label>Nom affiché<input id="gaNewName" required maxlength="60" placeholder="Prénom ou nom"></label>
        <label>Mot de passe temporaire<input id="gaNewPassword" type="password" required minlength="8" autocomplete="new-password"></label>
        <label>Rôle<select id="gaNewRole"><option value="Visit">Visit — Consultation</option><option value="Admin">Admin — Administration complète</option></select></label>
        <button class="ga-primary" type="submit">Créer le compte</button>
        <p id="gaCreateMessage" role="status"></p>
      </form>
      <div class="ga-users-head"><h3 class="ga-section-title">Comptes enregistrés</h3><div class="ga-users-tools"><input id="gaUserSearch" type="search" placeholder="Rechercher un compte…" aria-label="Rechercher un compte"><button id="gaRefreshUsers" class="btn btn-outline" type="button">Actualiser</button></div></div>
      <div id="gaUsersList" class="ga-users-list">Chargement…</div>
      <h3 class="ga-section-title">Mon mot de passe</h3>
      <form id="gaPasswordForm" class="ga-create-form" autocomplete="off">
        <label>Mot de passe actuel<input id="gaPwdCurrent" type="password" required autocomplete="current-password"></label>
        <span></span>
        <label>Nouveau mot de passe<input id="gaPwdNew" type="password" required minlength="8" autocomplete="new-password" placeholder="8 caractères minimum"></label>
        <label>Confirmer le nouveau mot de passe<input id="gaPwdConfirm" type="password" required minlength="8" autocomplete="new-password"></label>
        <button class="ga-primary" type="submit"><span class="ga-label">Changer mon mot de passe</span><span aria-hidden="true">→</span></button>
        <p id="gaPwdMessage" class="ga-form-message" role="status"></p>
      </form>
      <p class="ga-foot">Les mots de passe sont gérés par Firebase Authentication et ne sont jamais enregistrés dans la base. Pour réinitialiser le mot de passe d'un autre compte, supprime son utilisateur dans la console Firebase (Authentication) puis recrée-le ici avec le même identifiant.</p>`;
    document.body.append(panel);
    $("gaCloseAdmin").onclick = () => { panel.hidden = true; };
    $("gaCreateForm").addEventListener("submit", createAccount);
    $("gaRefreshUsers").onclick = loadUsers;
    $("gaUserSearch").addEventListener("input", renderUsers);
    $("gaPasswordForm").addEventListener("submit", changeOwnPassword);
  }
}

function setError(message = "", retry = false) {
  $("gaError").textContent = message;
  $("gaRetryProfile").hidden = !retry;
}

function showLogin(message = "") {
  $("guideAuthOverlay")?.classList.remove("ga-hidden");
  document.body.classList.add("ga-locked");
  $("guideUserBadge")?.remove();
  $("gaOpenAdmin")?.remove();
  currentProfile = null;
  window.__GUIDE3D_USER__ = null;
  window.__CREATOR_ADMIN__ = false;
  document.documentElement.dataset.creatorAdmin = "false";
  if (message) setError(message);
}

function showApp(user, profile) {
  $("guideAuthOverlay").classList.add("ga-hidden");
  document.body.classList.remove("ga-locked");
  currentProfile = profile;
  activeUser = user;

  const admin = profile.role === "Admin" && profile.active !== false;
  window.__GUIDE3D_USER__ = { uid: user.uid, ...profile };
  window.__CREATOR_ADMIN__ = admin;
  document.documentElement.dataset.creatorAdmin = String(admin);

  let badge = $("guideUserBadge");
  if (!badge) {
    badge = document.createElement("div");
    badge.id = "guideUserBadge";
    document.querySelector(".top-actions")?.append(badge);
  }
  const displayName = profile.name || profile.username || "Utilisateur";
  const initials = displayName.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
  badge.innerHTML = `<span class="ga-avatar" aria-hidden="true">${escapeHtml(initials)}</span><span class="ga-who"><strong>${escapeHtml(displayName)}</strong><small>${admin ? "Administrateur" : "Opérateur"}</small></span><button id="gaLogout" class="icon-btn" type="button" title="Se déconnecter"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/></svg><span class="sr-only">Déconnexion</span></button>`;
  $("gaLogout").onclick = async () => {
    try { await signOut(auth); }
    catch (error) { console.error("[Guide 3D] Déconnexion :", error); }
  };

  const updateCreatorVisibility = () => {
    const creator = document.querySelector(".creator-open");
    if (creator) creator.hidden = !admin;
  };
  updateCreatorVisibility();

  if (!window.__GUIDE3D_CREATOR_OBSERVER__) {
    const observer = new MutationObserver(updateCreatorVisibility);
    observer.observe(document.body, { childList: true, subtree: true });
    window.__GUIDE3D_CREATOR_OBSERVER__ = observer;
  }

  if (admin) {
    let adminButton = $("gaOpenAdmin");
    if (!adminButton) {
      adminButton = document.createElement("button");
      adminButton.id = "gaOpenAdmin";
      adminButton.className = "ga-admin-button icon-btn";
      adminButton.title = "Gestion des comptes";
      adminButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 11h5M19.5 8.5v5"/></svg><span class="label">Comptes</span>`;
      const badgeElement = $("guideUserBadge");
      if (badgeElement) badgeElement.before(adminButton);
      else document.querySelector(".top-actions")?.append(adminButton);
      adminButton.onclick = () => {
        $("guideAccountPanel").hidden = false;
        loadUsers();
      };
    }
  } else {
    $("gaOpenAdmin")?.remove();
    if ($("guideAccountPanel")) $("guideAccountPanel").hidden = true;
  }
}

function explainProfileError(error) {
  if (error?.code === "permission-denied") {
    return "Firebase refuse la lecture du profil. Vérifie que les règles Firestore publiées autorisent chaque utilisateur à lire son propre document users/{uid}.";
  }
  if (error?.code === "unavailable" || /offline|network/i.test(error?.message || "")) {
    return "Firestore ne parvient pas à joindre le service de lecture. Réessaie ; le transport réseau est configuré en long-polling dans cette version.";
  }
  return `Impossible de vérifier le profil (${error?.code || "erreur"}). ${error?.message || "Réessaie."}`;
}

async function verifyProfile(user) {
  const sequence = ++profileCheckSequence;
  activeUser = user;
  setError("Vérification des autorisations…");
  $("gaRetryProfile").hidden = true;

  try {
    // Lecture serveur explicite : évite de confondre une ancienne valeur du cache
    // avec un profil réellement accessible dans Firestore.
    const snapshot = await getDocFromServer(doc(db, "users", user.uid));
    if (sequence !== profileCheckSequence) return;

    if (!snapshot.exists()) {
      showLogin("Le compte est authentifié, mais son profil Firestore est introuvable. Le document users doit porter exactement l'UID Firebase.");
      return;
    }

    const profile = snapshot.data();
    if (profile.active === false || !["Visit", "Admin"].includes(profile.role)) {
      await signOut(auth);
      showLogin("Ce compte n'est pas autorisé. Vérifie les champs active et role dans Firestore.");
      return;
    }

    showApp(user, profile);
    setError("");
  } catch (error) {
    if (sequence !== profileCheckSequence) return;
    console.error("[Guide 3D] Vérification du profil :", error);
    // Ne pas déconnecter l'utilisateur sur une panne réseau temporaire.
    showLogin(explainProfileError(error));
    $("gaRetryProfile").hidden = false;
  }
}

async function login(event) {
  event.preventDefault();
  setError("");
  const button = $("gaLoginForm").querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const email = loginEmail($("gaUsername").value);
    await signInWithEmailAndPassword(auth, email, $("gaPassword").value);
    // Le contrôle du profil est déclenché par onAuthStateChanged.
  } catch (error) {
    console.error("[Guide 3D] Connexion :", error);
    const message = error.code === "auth/invalid-credential" || error.code === "auth/user-not-found"
      ? "Identifiant ou mot de passe incorrect."
      : error.code === "auth/too-many-requests"
        ? "Trop de tentatives. Réessaie plus tard."
        : error.message || "Connexion impossible.";
    setError(message);
  } finally {
    button.disabled = false;
  }
}

let userRows = [];
let editingUid = null;

async function loadUsers() {
  const host = $("gaUsersList");
  if (!host || currentProfile?.role !== "Admin") return;
  host.innerHTML = '<p class="ga-empty">Chargement…</p>';
  try {
    const snapshot = await getDocs(collection(db, "users"));
    userRows = snapshot.docs
      .map(item => ({ uid: item.id, ...item.data() }))
      .filter(user => user.username || user.name || user.role);
    userRows.sort((a, b) => String(a.name || a.username || "").localeCompare(String(b.name || b.username || ""), "fr"));
    renderUsers();
  } catch (error) {
    console.error("[Guide 3D] Liste des comptes :", error);
    host.innerHTML = `<p class="ga-empty ga-bad">Impossible de charger les comptes : ${escapeHtml(error.message)}</p>`;
  }
}

function renderUsers() {
  const host = $("gaUsersList");
  if (!host) return;
  const query = String($("gaUserSearch")?.value || "").trim().toLowerCase();
  const rows = userRows.filter(user => !query || `${user.name || ""} ${user.username || ""}`.toLowerCase().includes(query));
  if (!rows.length) { host.innerHTML = `<p class="ga-empty">${userRows.length ? "Aucun résultat." : "Aucun compte."}</p>`; return; }
  const me = auth.currentUser?.uid;
  host.innerHTML = rows.map(user => {
    const self = user.uid === me;
    const inactive = user.active === false;
    const initials = String(user.name || user.username || "?").split(/\s+/).map(p => p[0]).join("").slice(0, 2).toUpperCase();
    if (editingUid === user.uid) {
      return `
      <form class="ga-user-row editing" data-uid="${escapeHtml(user.uid)}">
        <span class="ga-avatar${inactive ? " off" : ""}" aria-hidden="true">${escapeHtml(initials)}</span>
        <div class="ga-edit-grid">
          <label>Nom affiché<input name="name" required maxlength="60" value="${escapeHtml(user.name || "")}"></label>
          <label>Rôle<select name="role"${self ? " disabled" : ""}>
            <option value="Visit"${user.role !== "Admin" ? " selected" : ""}>Opérateur (consultation)</option>
            <option value="Admin"${user.role === "Admin" ? " selected" : ""}>Administrateur</option>
          </select></label>
          <label class="ga-toggle"><input type="checkbox" name="active"${inactive ? "" : " checked"}${self ? " disabled" : ""}><span></span>Compte actif</label>
          ${self ? '<p class="ga-note">Tu ne peux pas modifier ton propre rôle ni désactiver ton compte.</p>' : ""}
          <p class="ga-note">Identifiant : <code>${escapeHtml(user.username || "—")}</code> (non modifiable)</p>
        </div>
        <div class="ga-row-actions">
          <button type="button" class="btn btn-outline" data-act="cancel">Annuler</button>
          <button type="submit" class="btn btn-primary">Enregistrer</button>
        </div>
      </form>`;
    }
    return `
      <div class="ga-user-row${inactive ? " inactive" : ""}" data-uid="${escapeHtml(user.uid)}">
        <span class="ga-avatar${inactive ? " off" : ""}" aria-hidden="true">${escapeHtml(initials)}</span>
        <div class="ga-user-main"><strong>${escapeHtml(user.name || user.username || "Compte")}${self ? ' <em>(toi)</em>' : ""}</strong><small>${escapeHtml(user.username || "identifiant non renseigné")}</small></div>
        <span class="ga-role ${user.role === "Admin" ? "admin" : ""}">${user.role === "Admin" ? "Admin" : "Opérateur"}</span>
        ${inactive ? '<span class="ga-role off">Désactivé</span>' : ""}
        <button type="button" class="btn btn-outline ga-edit" data-act="edit">Modifier</button>
      </div>`;
  }).join("");

  host.querySelectorAll("[data-act=edit]").forEach(button => button.addEventListener("click", () => {
    editingUid = button.closest("[data-uid]").dataset.uid;
    renderUsers();
    host.querySelector("form.editing input[name=name]")?.focus();
  }));
  host.querySelectorAll("[data-act=cancel]").forEach(button => button.addEventListener("click", () => { editingUid = null; renderUsers(); }));
  host.querySelectorAll("form.editing").forEach(form => form.addEventListener("submit", saveUser));
}

async function saveUser(event) {
  event.preventDefault();
  const form = event.target;
  const uid = form.dataset.uid;
  const user = userRows.find(row => row.uid === uid);
  if (!user) return;
  const self = uid === auth.currentUser?.uid;
  const name = form.elements.name.value.trim();
  const role = self ? user.role : form.elements.role.value;
  const active = self ? true : form.elements.active.checked;
  if (!name) return;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    await setDoc(doc(db, "users", uid), {
      name, role, active,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid
    }, { merge: true });
    Object.assign(user, { name, role, active });
    editingUid = null;
    renderUsers();
    flash(`Compte « ${user.username || name} » mis à jour.`);
  } catch (error) {
    console.error("[Guide 3D] Modification du compte :", error);
    flash(error.code === "permission-denied" ? "Firebase refuse la modification : vérifie les règles Firestore." : error.message, true);
    submit.disabled = false;
  }
}

function flash(message, bad = false) {
  const host = $("gaUsersList");
  const note = document.createElement("p");
  note.className = `ga-flash${bad ? " ga-bad" : ""}`;
  note.setAttribute("role", "status");
  note.textContent = message;
  host?.before(note);
  setTimeout(() => note.remove(), 4000);
}

async function changeOwnPassword(event) {
  event.preventDefault();
  const message = $("gaPwdMessage");
  message.className = "ga-form-message";
  const current = $("gaPwdCurrent").value;
  const next = $("gaPwdNew").value;
  if (next !== $("gaPwdConfirm").value) { message.textContent = "Les deux nouveaux mots de passe ne correspondent pas."; message.classList.add("ga-bad"); return; }
  if (next.length < 8) { message.textContent = "8 caractères minimum."; message.classList.add("ga-bad"); return; }
  const user = auth.currentUser;
  const submit = event.target.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
    await updatePassword(user, next);
    event.target.reset();
    message.textContent = "Mot de passe modifié.";
  } catch (error) {
    console.error("[Guide 3D] Mot de passe :", error);
    message.textContent = error.code === "auth/invalid-credential" || error.code === "auth/wrong-password"
      ? "Le mot de passe actuel est incorrect."
      : error.code === "auth/weak-password" ? "Mot de passe trop faible." : error.message;
    message.classList.add("ga-bad");
  } finally {
    submit.disabled = false;
  }
}

async function createAccount(event) {
  event.preventDefault();
  const message = $("gaCreateMessage");
  message.textContent = "";
  if (currentProfile?.role !== "Admin" || !auth.currentUser) return;

  const username = $("gaNewUsername").value.trim().toLowerCase();
  const name = $("gaNewName").value.trim();
  const password = $("gaNewPassword").value;
  const role = $("gaNewRole").value;
  let email;

  try { email = loginEmail(username); }
  catch (error) { message.textContent = error.message; return; }

  const submit = $("gaCreateForm").querySelector('button[type="submit"]');
  submit.disabled = true;
  let secondaryAuth;
  let createdUid = null;

  try {
    secondaryAuth = await getAccountCreationAuth();
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    createdUid = credential.user.uid;

    await setDoc(doc(db, "users", createdUid), {
      username,
      name,
      role,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: auth.currentUser.uid
    });

    await signOut(secondaryAuth);
    $("gaCreateForm").reset();
    message.textContent = `Compte ${username} créé avec le rôle ${role}. Transmets le mot de passe temporaire de manière sécurisée.`;
    await loadUsers();
  } catch (error) {
    console.error("[Guide 3D] Création de compte :", error);
    message.textContent = error.code === "auth/email-already-in-use"
      ? "Cet identifiant existe déjà."
      : error.message || "Création impossible.";
    if (createdUid) {
      message.textContent += " Le compte Auth a été créé, mais son profil Firestore n'a pas pu être enregistré. Vérifie les règles.";
    }
  } finally {
    submit.disabled = false;
  }
}

ensureShell();
document.body.classList.add("ga-locked");
showLogin();

if (!authObserverStarted) {
  authObserverStarted = true;
  onAuthStateChanged(auth, user => {
    if (!user) {
      profileCheckSequence++;
      activeUser = null;
      currentProfile = null;
      showLogin();
      return;
    }
    verifyProfile(user);
  }, error => {
    console.error("[Guide 3D] État Auth :", error);
    showLogin(`Erreur de session Firebase : ${error.message}`);
  });
}
