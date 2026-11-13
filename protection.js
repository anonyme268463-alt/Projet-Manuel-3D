/*
 * GUIDE 3D — PROTECTION DISSUASIVE
 * Le PIN est une barrière d'interface, pas une sécurité serveur.
 */
(() => {
  const PIN = "0342";
  const isAdmin = () => {
    const panel = document.getElementById("v3Panel") || document.getElementById("creatorPanel");
    return window.__CREATOR_ADMIN__ === true
      || document.documentElement.dataset.creatorAdmin === "true"
      || Boolean(panel && panel.hidden === false);
  };

  let noticeTimer;
  function showNotice(message, title = "Accès refusé") {
    let notice = document.getElementById("siteProtectionNotice");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "siteProtectionNotice";
      notice.className = "protection-toast";
      notice.setAttribute("role", "status");
      notice.innerHTML = `<span class="protection-toast-icon">✦</span><span class="protection-toast-copy"><strong></strong><small></small></span><span class="protection-toast-face">&gt;.&lt;</span>`;
      document.body.appendChild(notice);
    }
    notice.querySelector("strong").textContent = title;
    notice.querySelector("small").textContent = message;
    notice.classList.remove("is-visible");
    requestAnimationFrame(() => notice.classList.add("is-visible"));
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => notice.classList.remove("is-visible"), 3200);
  }

  function closePinModal(success = false) {
    const modal = document.getElementById("creatorPinModal");
    if (modal) modal.remove();
    if (success) {
      window.__CREATOR_ADMIN__ = true;
      document.documentElement.dataset.creatorAdmin = "true";
      const trigger = document.querySelector(".creator-open");
      if (trigger) trigger.click();
    }
  }

  function openPinModal() {
    if (document.getElementById("creatorPinModal")) return;
    const modal = document.createElement("div");
    modal.id = "creatorPinModal";
    modal.className = "pin-overlay";
    modal.innerHTML = `
      <section class="pin-card" role="dialog" aria-modal="true" aria-labelledby="pinTitle">
        <button class="pin-close" type="button" aria-label="Fermer">×</button>
        <div class="pin-emblem">✦</div>
        <p class="pin-eyebrow">ATELIER DE CONCEPTION</p>
        <h2 id="pinTitle">Espace administrateur</h2>
        <p class="pin-description">Entre ton code secret pour accéder au Créateur Guide 3D.</p>
        <form class="pin-form">
          <label for="creatorPinInput">CODE PIN</label>
          <input id="creatorPinInput" type="password" inputmode="numeric" maxlength="8" autocomplete="off" placeholder="••••" aria-label="Code PIN administrateur">
          <p class="pin-error" aria-live="polite"></p>
          <button class="pin-submit" type="submit">Déverrouiller <span>→</span></button>
        </form>
        <p class="pin-foot">Accès réservé à l’administration <span>·</span> Atelier 3D</p>
      </section>`;
    document.body.appendChild(modal);
    const input = modal.querySelector("#creatorPinInput");
    const form = modal.querySelector(".pin-form");
    const error = modal.querySelector(".pin-error");
    const close = () => modal.remove();
    modal.querySelector(".pin-close").addEventListener("click", close);
    modal.addEventListener("click", event => { if (event.target === modal) close(); });
    form.addEventListener("submit", event => {
      event.preventDefault();
      if (input.value.trim() === PIN) closePinModal(true);
      else {
        error.textContent = "Code incorrect. Réessaie !";
        input.value = "";
        input.classList.add("pin-invalid");
        input.focus();
        showNotice("Accès refusé pour protéger le code >.<", "Oups !");
      }
    });
    input.addEventListener("input", () => { input.classList.remove("pin-invalid"); error.textContent = ""; });
    input.addEventListener("keydown", event => { if (event.key === "Escape") close(); });
    input.focus();
  }

  document.addEventListener("click", event => {
    const button = event.target.closest?.(".creator-open");
    if (!button || window.__CREATOR_ADMIN__ === true) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    openPinModal();
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
    showNotice("Accès refusé pour protéger le code >.<", "Hé, petit curieux !");
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
    showNotice("Accès refusé pour protéger le code >.<", "Hé, petit curieux !");
  }, true);
})();
