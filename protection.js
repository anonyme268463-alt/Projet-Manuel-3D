/** Dissuasion visuelle uniquement : ne protège pas le code téléchargé par le navigateur. */
(() => {
  // Pour tester le site : ajouter ?debug=1 à l'URL (mode de développement, non secret).
  const disabled = new URLSearchParams(location.search).get('debug') === '1';
  if (disabled) return;
  let overlay;
  let timeout;
  function notice() {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'inspection-notice';
      overlay.setAttribute('role', 'alertdialog');
      overlay.setAttribute('aria-label', 'Accès refusé');
      overlay.innerHTML = '<div class="inspection-card"><div class="inspection-icon">🔒</div><h2>Accès refusé pour protéger le code &gt;.&lt;</h2><p>Retournez au guide pour poursuivre votre consultation.</p><button type="button" id="inspection-close">Retour au guide</button></div>';
      document.body.append(overlay);
      overlay.querySelector('button').addEventListener('click', closeNotice);
    }
    overlay.hidden = false;
    clearTimeout(timeout);
    timeout = setTimeout(closeNotice, 4500);
  }
  function closeNotice() { if (overlay) overlay.hidden = true; clearTimeout(timeout); }
  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    const command = event.ctrlKey || event.metaKey;
    const devtools = key === 'f12' || (command && event.shiftKey && ['i','j','c','k'].includes(key)) || (command && ['u'].includes(key));
    if (devtools) {
      event.preventDefault();
      event.stopPropagation();
      notice();
    }
  }, true);
  document.addEventListener('contextmenu', (event) => {
    // Ne bloque pas les menus nécessaires dans les champs de saisie.
    if (event.target.closest('input, textarea, [contenteditable="true"]')) return;
    event.preventDefault();
    notice();
  });
})();
