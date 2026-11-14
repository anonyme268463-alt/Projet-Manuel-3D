/*
 * GUIDE 3D — Authentification et gestion des comptes
 * Firebase Auth Email/Password + profils Firestore users/{uid}.
 * Identifiant public : aucun e-mail réel n'est demandé ni affiché.
 */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, collection, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCG9nmgw8xm83xD6BlbXLyS8fCd41olX6s",
  authDomain: "guide-3d.firebaseapp.com",
  projectId: "guide-3d",
  storageBucket: "guide-3d.firebasestorage.app",
  messagingSenderId: "714446657255",
  appId: "1:714446657255:web:7ed8061d9baf056200b442",
  measurementId: "G-VJZ0W8ST2C"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (id) => document.getElementById(id);
let currentProfile = null;
let secondaryApp = null;
let secondaryAuth = null;

const loginEmail = (username) => {
  const clean = String(username || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(clean)) {
    throw new Error("L'identifiant doit contenir 3 à 30 caractères : lettres, chiffres, point, tiret ou underscore.");
  }
  return `${clean}@login.guide3d.invalid`;
};
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, c =>
  ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

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
        </form>
        <p class="ga-foot">Les comptes sont créés uniquement par un administrateur.</p>
      </section>`;
    document.body.append(overlay);
    $("gaLoginForm").addEventListener("submit", login);
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
      <p class="ga-foot">Pour désactiver un compte, désactive-le dans Firebase Authentication. Le rôle est géré dans Firestore.</p>`;
    document.body.append(panel);
    $("gaCloseAdmin").onclick = () => panel.classList.remove("open");
    $("gaCreateForm").addEventListener("submit", createAccount);
    $("gaRefreshUsers").onclick = loadUsers;
  }
}

function setError(message = "") { $("gaError").textContent = message; }

async function login(event) {
  event.preventDefault();
  setError("");
  const button = $("gaLoginForm").querySelector("button");
  button.disabled = true;
  try {
    const email = loginEmail($("gaUsername").value);
    await signInWithEmailAndPassword(auth, email, $("gaPassword").value);
  } catch (error) {
    console.error("[Guide 3D] Connexion :", error);
    setError(error.code === "auth/invalid-credential" || error.code === "auth/user-not-found"
      ? "Identifiant ou mot de passe incorrect."
      : error.code === "auth/too-many-requests"
        ? "Trop de tentatives. Réessaie plus tard."
        : error.message || "Connexion impossible.");
  } finally {
    button.disabled = false;
  }
}

function showApp(user, profile) {
  $("guideAuthOverlay").classList.add("ga-hidden");
  document.body.classList.remove("ga-locked");
  currentProfile = profile;
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
  $("gaLogout").onclick = async () => { await signOut(auth); };

  const observer = new MutationObserver(() => {
    const creator = document.querySelector(".creator-open");
    if (creator) creator.hidden = !admin;
  });
  observer.observe(document.body, { childList: true, subtree: true });
  const creator = document.querySelector(".creator-open");
  if (creator) creator.hidden = !admin;
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

async function loadUsers() {
  const host = $("gaUsersList");
  if (!host || currentProfile?.role !== "Admin") return;
  host.textContent = "Chargement…";
  try {
    const snapshot = await getDocs(collection(db, "users"));
    const rows = snapshot.docs.map(d => ({ uid: d.id, ...d.data() }));
    rows.sort((a,b) => String(a.name || a.username).localeCompare(String(b.name || b.username), "fr"));
    host.innerHTML = rows.map(u => `
      <div class="ga-user-row">
        <div><strong>${escapeHtml(u.name || u.username || "Compte")}</strong><small>${escapeHtml(u.username || "identifiant non renseigné")} · ${escapeHtml(u.uid)}</small></div>
        <span class="ga-role ${u.role === "Admin" ? "admin" : ""}">${escapeHtml(u.role || "Visit")}</span>
      </div>`).join("") || "Aucun compte.";
  } catch (error) {
    host.textContent = "Impossible de charger les comptes : " + error.message;
  }
}

async function createAccount(event) {
  event.preventDefault();
  const message = $("gaCreateMessage");
  message.textContent = "";
  if (currentProfile?.role !== "Admin") return;
  const username = $("gaNewUsername").value.trim().toLowerCase();
  const name = $("gaNewName").value.trim();
  const password = $("gaNewPassword").value;
  const role = $("gaNewRole").value;
  let email;
  try { email = loginEmail(username); }
  catch (error) { message.textContent = error.message; return; }

  const submit = $("gaCreateForm").querySelector("button[type=submit]");
  submit.disabled = true;
  try {
    // Auth secondaire : la session de l'administrateur reste connectée.
    if (!secondaryApp) {
      secondaryApp = initializeApp(firebaseConfig, "guide3d-account-creator");
      secondaryAuth = getAuth(secondaryApp);
    }
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = credential.user.uid;
    await setDoc(doc(db, "users", uid), {
      username, name, role, active: true,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      createdBy: auth.currentUser.uid
    });
    await signOut(secondaryAuth);
    $("gaCreateForm").reset();
    message.textContent = `Compte ${username} créé avec le rôle ${role}. Communique l'identifiant et le mot de passe de manière sécurisée.`;
    await loadUsers();
  } catch (error) {
    console.error("[Guide 3D] Création compte :", error);
    message.textContent = error.code === "auth/email-already-in-use"
      ? "Cet identifiant existe déjà."
      : error.message || "Création impossible.";
  } finally {
    submit.disabled = false;
  }
}

ensureShell();
document.body.classList.add("ga-locked");
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentProfile = null;
    window.__GUIDE3D_USER__ = null;
    window.__CREATOR_ADMIN__ = false;
    document.documentElement.dataset.creatorAdmin = "false";
    $("guideAuthOverlay").classList.remove("ga-hidden");
    document.body.classList.add("ga-locked");
    $("guideUserBadge")?.remove();
    $("gaOpenAdmin")?.remove();
    return;
  }
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists() || snap.data().active === false || !["Visit", "Admin"].includes(snap.data().role)) {
      await signOut(auth);
      setError("Ce compte n'est pas autorisé. Demande à un administrateur de vérifier ton accès.");
      return;
    }
    showApp(user, snap.data());
  } catch (error) {
    console.error("[Guide 3D] Profil utilisateur :", error);
    await signOut(auth);
    setError("Impossible de vérifier les droits du compte. Réessaie ou contacte l'administrateur.");
  }
});
