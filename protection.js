/*
 * GUIDE 3D — PROTECTION DISSUASIVE
 * Visiteurs : bloque menu contextuel et raccourcis d'inspection.
 * Admin : dès que le PIN a été validé et le panneau Créateur ouvert,
 * tous ces blocages sont levés pour cette page.
 *
 * Ce mécanisme n'est pas une sécurité serveur : les ressources restent publiques.
 */
(() => {
  const isAdmin = () => {
    const panel = document.getElementById("creatorPanel");
    return window.__CREATOR_ADMIN__ === true
      || document.documentElement.dataset.creatorAdmin === "true"
      || Boolean(panel && panel.hidden === false);
  };

  let noticeTimer;
  function showNotice(message) {
    let notice = document.getElementById("siteProtectionNotice");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "siteProtectionNotice";
      notice.setAttribute("role", "status");
      notice.style.cssText = [
        "position:fixed","z-index:2147483647","left:50%","bottom:28px",
        "transform:translateX(-50%)","max-width:calc(100vw - 32px)",
        "padding:12px 18px","border:1px solid rgba(255,255,255,.16)",
        "border-radius:10px","background:#10263b","color:#fff",
        "font:600 13px/1.4 Arial,sans-serif",
        "box-shadow:0 8px 28px rgba(0,0,0,.28)","text-align:center",
        "pointer-events:none","opacity:0","transition:opacity .18s ease"
      ].join(";");
      document.body.appendChild(notice);
    }
    notice.textContent = message;
    notice.style.opacity = "1";
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice.style.opacity = "0"; }, 2200);
  }

  document.addEventListener("contextmenu", event => {
    if (isAdmin()) return;
    event.preventDefault();
    showNotice("Clic droit désactivé. Accès réservé à l'espace Créateur.");
  }, true);

  document.addEventListener("keydown", event => {
    if (isAdmin()) return;
    const key = String(event.key || "").toLowerCase();
    const blocked = key === "f12"
      || (event.ctrlKey && event.shiftKey && ["i","j","c","k"].includes(key))
      || (event.ctrlKey && ["u","s"].includes(key))
      || (event.metaKey && event.altKey && ["i","j","c"].includes(key));
    if (!blocked) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    showNotice("Outils de développement désactivés. Entrez le PIN administrateur dans l'espace Créateur.");
  }, true);
})();
