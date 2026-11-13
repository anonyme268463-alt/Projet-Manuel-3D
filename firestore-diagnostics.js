import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

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
const db = getFirestore(app);

const style = document.createElement("style");
style.textContent = `
#firestoreHealth{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0 12px;padding:12px 14px;border:1px solid #d9e5eb;border-radius:10px;background:#f8fbfc;color:#31516a;font:12px/1.5 'DM Sans',sans-serif}
#firestoreHealth .fh-dot{width:9px;height:9px;border-radius:50%;background:#aab7c0;box-shadow:0 0 0 3px #aab7c022;flex:none}
#firestoreHealth[data-state=ok] .fh-dot{background:#1b9a6d;box-shadow:0 0 0 3px #1b9a6d22}
#firestoreHealth[data-state=error] .fh-dot{background:#d35b50;box-shadow:0 0 0 3px #d35b5022}
#firestoreHealth .fh-copy{flex:1;min-width:180px}
#firestoreHealth strong{display:block;color:#183b55;font-size:12px}
#firestoreHealth small{display:block;color:#7b8f9d;font-size:10px}
#firestoreHealth button{border:1px solid #198462;border-radius:8px;padding:8px 11px;background:#198462;color:#fff;font-weight:800;cursor:pointer}
#firestoreHealth button:disabled{opacity:.55;cursor:wait}
#firestoreHealth button:hover{background:#116e51}
`;
document.head.append(style);

function attach() {
  const panel = document.getElementById("v3Panel");
  if (!panel || document.getElementById("firestoreHealth")) return false;
  const toolbar = panel.querySelector(".v3-toolbar");
  if (!toolbar) return false;

  const box = document.createElement("div");
  box.id = "firestoreHealth";
  box.dataset.state = "idle";
  box.innerHTML = `<span class="fh-dot"></span><span class="fh-copy"><strong>Firestore : vérification non effectuée</strong><small>Projet cible : guide-3d · Test réel de lecture et d'écriture</small></span><button type="button" id="firestoreTestButton">Tester la connexion</button>`;
  toolbar.after(box);

  const button = box.querySelector("button");
  const title = box.querySelector("strong");
  const detail = box.querySelector("small");

  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Test en cours…";
    box.dataset.state = "idle";
    title.textContent = "Test de lecture / écriture en cours…";
    detail.textContent = "Un document temporaire est créé, relu, puis supprimé.";
    const testId = `probe_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const ref = doc(db, "_connectionTests", testId);
    const started = performance.now();

    try {
      await setDoc(ref, {
        project: "guide-3d",
        test: true,
        createdAt: serverTimestamp()
      });
      const snapshot = await getDoc(ref);
      if (!snapshot.exists() || snapshot.data().test !== true) {
        throw new Error("Écriture effectuée mais document introuvable lors de la relecture.");
      }
      await deleteDoc(ref);
      const elapsed = Math.round(performance.now() - started);
      box.dataset.state = "ok";
      title.textContent = `Firestore connecté · Lecture et écriture confirmées (${elapsed} ms)`;
      detail.textContent = "Le document de test a été relu puis supprimé. Tu peux maintenant tester une vraie sauvegarde.";
    } catch (error) {
      console.error("[Guide 3D] Test Firestore échoué :", error);
      box.dataset.state = "error";
      title.textContent = "Échec du test Firestore";
      detail.textContent = `${error.code || "Erreur"} : ${error.message || error}`;
    } finally {
      button.disabled = false;
      button.textContent = "Relancer le test";
    }
  });

  // Make errors from the existing creator status area more visible and readable.
  const status = document.getElementById("v3Status");
  if (status) {
    const observer = new MutationObserver(() => {
      const value = status.textContent || "";
      if (/erreur|échec|permission|denied|failed/i.test(value)) {
        status.dataset.level = "error";
        status.title = value;
      } else if (/sauvegard|enregistr|ajouté|supprimé/i.test(value)) {
        status.dataset.level = "success";
      }
    });
    observer.observe(status, { childList: true, characterData: true, subtree: true });
  }
  return true;
}

const observer = new MutationObserver(() => {
  if (attach()) observer.disconnect();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
attach();
