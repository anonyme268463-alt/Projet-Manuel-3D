/*
 * ATELIER 3D — Dissuasion de l'inspection du code
 * Bloque le clic droit et les raccourcis des outils de développement sur le guide,
 * sauf dans l'espace créateur et la gestion des comptes.
 * Remarque : c'est une mesure dissuasive. Elle n'empêche pas un utilisateur averti
 * d'ouvrir les outils depuis le menu du navigateur ; la sécurité des données repose
 * sur les règles Firestore.
 */
const MESSAGE = "Accès refusé pour protéger le code >.< Vraiment navré";
const ALLOWED = "#v3Panel:not([hidden]), #guideAccountPanel:not([hidden])";

let notice = null;
let lastShown = 0;

function allowed() {
  return Boolean(document.querySelector(ALLOWED));
}

function buildNotice() {
  notice = document.createElement("div");
  notice.id = "protectNotice";
  notice.className = "modal protect-modal";
  notice.hidden = true;
  notice.dataset.window = "";
  notice.setAttribute("role", "alertdialog");
  notice.setAttribute("aria-modal", "true");
  notice.setAttribute("aria-labelledby", "protectTitle");
  notice.innerHTML = `
    <div class="modal-panel protect-card">
      <div class="protect-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.4 7.5 9.5 4.4-1.1 7.5-4.9 7.5-9.5V6L12 3Z"/><path d="M9.5 12.5h5M12 10v5" transform="rotate(45 12 12.5)"/></svg>
      </div>
      <h2 id="protectTitle">Accès refusé</h2>
      <p>${MESSAGE}</p>
      <button type="button" class="btn btn-primary" data-autofocus>D'accord</button>
    </div>`;
  notice.querySelector("button").addEventListener("click", () => { notice.hidden = true; });
  document.body.append(notice);
}

function deny(event) {
  event.preventDefault();
  event.stopPropagation();
  if (!notice) buildNotice();
  const now = Date.now();
  if (!notice.hidden || now - lastShown < 400) return;
  lastShown = now;
  notice.hidden = false;
}

function isDevtoolsShortcut(event) {
  const key = String(event.key || "").toLowerCase();
  const code = event.code || "";
  const ctrl = event.ctrlKey || event.metaKey;
  if (key === "f12" || code === "F12") return true;
  // Ctrl+Maj+I / J / C / K (Windows, Linux) — Cmd+Option+I / J / C (macOS)
  if (ctrl && (event.shiftKey || event.altKey) && ["KeyI", "KeyJ", "KeyC", "KeyK"].includes(code)) return true;
  // Code source (Ctrl+U, Cmd+Option+U) et enregistrement de la page (Ctrl+S)
  if (ctrl && !event.shiftKey && ["KeyU", "KeyS"].includes(code)) return true;
  return false;
}

window.addEventListener("contextmenu", event => {
  if (!allowed()) deny(event);
}, true);

window.addEventListener("keydown", event => {
  if (isDevtoolsShortcut(event) && !allowed()) deny(event);
}, true);
