/*
 * GUIDE 3D — Authentification et profils utilisateurs
 * Identifiant public converti en adresse technique Firebase Auth.
 * Le mot de passe n'est jamais stocké dans Firestore.
 */
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword
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
        <div class="ga-brand">ATELIER <span>3D</span></div>
        <p class="ga-eyebrow">MANUEL NUMÉRIQUE · ANTILOPE VAN</p>
        <h1 id="gaTitle">Connexion à l'atelier</h1>
        <p class="ga-subtitle">Identifie-toi pour accéder aux procédures et aux outils autorisés.</p>
        <form id="gaLoginForm">
          <label for="gaUsername">IDENTIFIANT</label>
          <input id="gaUsername" autocomplete="username" required maxlength="30" placeholder="Ton identifiant">
          <label for="gaPassword">MOT DE PASSE</label>
          <input id="gaPassword" type="password" autocomplete="current-password" required placeholder="Mot de passe">
          <p id="gaError" class="ga-error" role="alert"></p>
          <button class="ga-primary" type="submit">Se connecter <span>→</span></button>
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
    panel.innerHTML = `
      <div class="ga-admin-head">
        <div><small>ADMINISTRATION</small><h2>Gestion des accès</h2><p>Créer les comptes opérateurs et administrateurs.</p></div>
        <button id="gaCloseAdmin" type="button" aria-label="Fermer">✕</button>
      </div>
      <form id="gaCreateForm" class="ga-create-form">
        <label>IDENTIFIANT<input id="gaNewUsername" required minlength="3" maxlength="30" pattern="[A-Za-z0-9._-]+" placeholder="ex. atelier01"></label>
        <label>NOM AFFICHÉ<input id="gaNewName" required maxlength="60" placeholder="Prénom ou nom"></label>
        <label>MOT DE PASSE TEMPORAIRE<input id="gaNewPassword" type="password" required minlength="8" autocomplete="new-password"></label>
        <label>RÔLE<select id="gaNewRole"><option value="Visit">Visit — Consultation</option><option value="Admin">Admin — Administration complète</option></select></label>
        <button class="ga-primary" type="submit">Créer le compte</button>
        <p id="gaCreateMessage" role="status"></p>
      </form>
      <div class="ga-users-head"><strong>Comptes enregistrés</strong><button id="gaRefreshUsers" type="button">Actualiser</button></div>
      <div id="gaUsersList" class="ga-users-list">Chargement…</div>
      <p class="ga-foot">Les mots de passe sont gérés exclusivement par Firebase Authentication.</p>`;
    document.body.append(panel);
    $("gaCloseAdmin").onclick = () => panel.classList.remove("open");
    $("gaCreateForm").addEventListener("submit", createAccount);
    $("gaRefreshUsers").onclick = loadUsers;
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
  badge.innerHTML = `<span>${escapeHtml(profile.name || profile.username || "Utilisateur")}</span><b>${admin ? "ADMIN" : "VISITEUR"}</b><button id="gaLogout" type="button">Déconnexion</button>`;
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
      adminButton.className = "ga-admin-button";
      adminButton.textContent = "⚙ Comptes";
      document.querySelector(".top-actions")?.append(adminButton);
      adminButton.onclick = () => {
        $("guideAccountPanel").classList.add("open");
        loadUsers();
      };
    }
  } else {
    $("gaOpenAdmin")?.remove();
    $("guideAccountPanel")?.classList.remove("open");
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

async function loadUsers() {
  const host = $("gaUsersList");
  if (!host || currentProfile?.role !== "Admin") return;
  host.textContent = "Chargement…";
  try {
    const snapshot = await getDocs(collection(db, "users"));
    const rows = snapshot.docs.map(item => ({ uid: item.id, ...item.data() }));
    rows.sort((a, b) => String(a.name || a.username || "").localeCompare(String(b.name || b.username || ""), "fr"));
    host.innerHTML = rows.map(user => `
      <div class="ga-user-row">
        <div><strong>${escapeHtml(user.name || user.username || "Compte")}</strong><small>${escapeHtml(user.username || "identifiant non renseigné")} · ${escapeHtml(user.uid)}</small></div>
        <span class="ga-role ${user.role === "Admin" ? "admin" : ""}">${escapeHtml(user.role || "Visit")}</span>
      </div>`).join("") || "Aucun compte.";
  } catch (error) {
    console.error("[Guide 3D] Liste des comptes :", error);
    host.textContent = `Impossible de charger les comptes : ${error.message}`;
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
