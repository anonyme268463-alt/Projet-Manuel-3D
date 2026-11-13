/*
 * GUIDE 3D — PROTECTION DISSUASIVE
 * Visiteurs : bloque menu contextuel et raccourcis d'inspection.
 * Créateur : demande le PIN avant d'autoriser l'ouverture du panneau.
 * Ce mécanisme est dissuasif côté navigateur, pas une sécurité serveur.
 */
(() => {
  const isAdmin = () => {
    const panel = document.getElementById("v3Panel") || document.getElementById("creatorPanel");
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
    noticeTimer = setTimeout(() => { notice.style.opacity = "0"; }, 2400);
  }

  // Le contrôle est placé en phase capture pour s'exécuter avant le clic du bouton Créateur.
  document.addEventListener("click", event => {
    const button = event.target.closest?.(".creator-open");
    if (!button || window.__CREATOR_ADMIN__ === true) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    const entered = window.prompt("ACCÈS RÉSERVÉ\nEntrez le code PIN administrateur :");
    if (entered === null) return;

    if (entered.trim() !== "0342") {
      showNotice("Accès refusé : code PIN incorrect.");
      return;
    }

    window.__CREATOR_ADMIN__ = true;
    document.documentElement.dataset.creatorAdmin = "true";
    // Rejoue le clic : le bouton peut alors ouvrir normalement le panneau.
    button.click();
  }, true);

  const watchCreator = new MutationObserver(() => {
    const panel = document.getElementById("v3Panel");
    if (panel && panel.hidden) {
      window.__CREATOR_ADMIN__ = false;
      delete document.documentElement.dataset.creatorAdmin;
    }
  });
  watchCreator.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });

  document.addEventListener("contextmenu", event => {
    if (isAdmin()) return;
    event.preventDefault();
    showNotice("Accès refusé : clic droit désactivé pour protéger le manuel.");
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
    showNotice("Accès refusé : outils de développement réservés à l'administrateur.");
  }, true);
})();
