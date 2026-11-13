import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const config = {
  apiKey: "AIzaSyCG9nmgw8xm83xD6BlbXLyS8fCd41olX6s",
  authDomain: "guide-3d.firebaseapp.com",
  projectId: "guide-3d",
  storageBucket: "guide-3d.firebasestorage.app",
  messagingSenderId: "714446657255",
  appId: "1:714446657255:web:7ed8061d9baf056200b442"
};
const app = getApps().length ? getApp() : initializeApp(config);
const db = getFirestore(app);

const css = document.createElement('style');
css.textContent = `
#firestoreHealth{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0 12px;padding:12px 14px;border:1px solid #d9e5eb;border-radius:10px;background:#f8fbfc;color:#31516a;font:12px/1.5 'DM Sans',sans-serif}
#firestoreHealth .fh-dot{width:9px;height:9px;border-radius:50%;background:#aab7c0;flex:none}
#firestoreHealth[data-state=ok] .fh-dot{background:#1b9a6d;box-shadow:0 0 0 3px #1b9a6d22}
#firestoreHealth[data-state=error] .fh-dot{background:#d35b50;box-shadow:0 0 0 3px #d35b5022}
#firestoreHealth .fh-copy{flex:1;min-width:180px}
#firestoreHealth strong{display:block;color:#183b55;font-size:12px}
#firestoreHealth small{display:block;color:#7b8f9d;font-size:10px}
#firestoreHealth button{border:1px solid #198462;border-radius:8px;padding:8px 11px;background:#198462;color:#fff;font-weight:800;cursor:pointer}
#firestoreHealth button:disabled{opacity:.55;cursor:wait}
`;
document.head.append(css);

function install() {
  const panel = document.getElementById('v3Panel');
  const toolbar = panel?.querySelector('.v3-toolbar');
  if (!panel || !toolbar || document.getElementById('firestoreHealth')) return false;

  const box = document.createElement('div');
  box.id = 'firestoreHealth';
  box.dataset.state = 'idle';
  box.innerHTML = `<span class="fh-dot"></span><span class="fh-copy"><strong>Firestore : test non effectué</strong><small>Projet Firebase ciblé : guide-3d</small></span><button type="button">Tester la connexion</button>`;
  toolbar.after(box);

  const button = box.querySelector('button');
  const title = box.querySelector('strong');
  const detail = box.querySelector('small');

  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Test en cours…';
    box.dataset.state = 'idle';
    title.textContent = 'Test de lecture et écriture…';
    detail.textContent = 'Création, relecture puis suppression d’un document temporaire.';
    const ref = doc(db, '_connectionTests', `probe_${Date.now()}`);
    const started = performance.now();
    let writeAttempted = false;

    try {
      await setDoc(ref, { project: 'guide-3d', probe: true, createdAt: serverTimestamp() });
      writeAttempted = true;
      const snapshot = await getDoc(ref);
      if (!snapshot.exists() || snapshot.data().probe !== true) {
        throw new Error('Le document écrit n’a pas été retrouvé lors de la relecture.');
      }
      const duration = Math.round(performance.now() - started);
      box.dataset.state = 'ok';
      title.textContent = `Connexion confirmée · ${duration} ms`;
      detail.textContent = 'Écriture et relecture confirmées. Le document temporaire va être supprimé.';
    } catch (error) {
      console.error('[Guide 3D] Diagnostic Firestore :', error);
      box.dataset.state = 'error';
      title.textContent = `Échec Firestore · ${error.code || 'erreur'}`;
      detail.textContent = error.message || String(error);
    } finally {
      if (writeAttempted) {
        try { await deleteDoc(ref); }
        catch (cleanupError) { console.warn('[Guide 3D] Nettoyage du document test impossible :', cleanupError); }
      }
      button.disabled = false;
      button.textContent = 'Relancer le test';
    }
  });
  return true;
}

const observer = new MutationObserver(() => {
  if (install()) observer.disconnect();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
install();
