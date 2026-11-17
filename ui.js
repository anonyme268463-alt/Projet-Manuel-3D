/*
 * ATELIER 3D — Gestion des panneaux et des fenêtres
 *  - panneaux latéraux repliables et redimensionnables (préférences mémorisées) ;
 *  - mode tablette d'atelier (cibles tactiles agrandies) ;
 *  - fenêtres modales unifiées : focus piégé, Échap, retour du focus, verrouillage du défilement ;
 *  - raccourcis clavier : ← → étapes, [ ] panneaux.
 */
const root = document.documentElement;
const STORE_KEY = 'guide3d:layout';
const LIMITS = { side: [210, 440, 288], guide: [290, 560, 368] };

/* ---------- Préférences ---------- */
function readPrefs() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; }
  catch { return {}; }
}
function writePrefs(patch) {
  const next = { ...readPrefs(), ...patch };
  try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* stockage indisponible : préférence non conservée */ }
  return next;
}

/* ---------- Panneaux repliables ---------- */
const toggles = {
  side: { button: document.getElementById('toggleSide'), cls: 'side-collapsed', key: 'sideCollapsed' },
  guide: { button: document.getElementById('toggleGuide'), cls: 'guide-collapsed', key: 'guideCollapsed' }
};

function syncToggle(name) {
  const t = toggles[name];
  t.button?.setAttribute('aria-pressed', String(!root.classList.contains(t.cls)));
}
function togglePanel(name, force) {
  const t = toggles[name];
  const collapsed = force ?? !root.classList.contains(t.cls);
  root.classList.toggle(t.cls, collapsed);
  writePrefs({ [t.key]: collapsed });
  syncToggle(name);
}
Object.entries(toggles).forEach(([name, t]) => {
  t.button?.addEventListener('click', () => togglePanel(name));
  syncToggle(name);
});

/* ---------- Mode tablette ---------- */
const touchButton = document.getElementById('toggleTouch');
function syncTouch() { touchButton?.setAttribute('aria-pressed', String(root.classList.contains('touch-mode'))); }
touchButton?.addEventListener('click', () => {
  const on = !root.classList.contains('touch-mode');
  root.classList.toggle('touch-mode', on);
  writePrefs({ touch: on });
  syncTouch();
});
syncTouch();

/* ---------- Séparateurs redimensionnables ---------- */
function clamp(value, [min, max]) { return Math.round(Math.min(max, Math.max(min, value))); }
function setWidth(name, px) {
  const width = clamp(px, LIMITS[name]);
  root.style.setProperty(name === 'side' ? '--side-w' : '--guide-w', `${width}px`);
  return width;
}
function currentWidth(name) {
  const el = document.getElementById(name === 'side' ? 'sidebar' : 'guidePanel');
  return el?.getBoundingClientRect().width || LIMITS[name][2];
}

function bindSplitter(id, name) {
  const splitter = document.getElementById(id);
  if (!splitter) return;
  const key = name === 'side' ? 'sideW' : 'guideW';

  splitter.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startW = currentWidth(name);
    let last = startW;
    splitter.setPointerCapture(event.pointerId);
    splitter.classList.add('active');
    root.classList.add('resizing');

    const move = e => {
      const delta = e.clientX - startX;
      last = setWidth(name, name === 'side' ? startW + delta : startW - delta);
    };
    const up = () => {
      splitter.removeEventListener('pointermove', move);
      splitter.removeEventListener('pointerup', up);
      splitter.removeEventListener('pointercancel', up);
      splitter.classList.remove('active');
      root.classList.remove('resizing');
      writePrefs({ [key]: last });
    };
    splitter.addEventListener('pointermove', move);
    splitter.addEventListener('pointerup', up);
    splitter.addEventListener('pointercancel', up);
  });

  // Double-clic : largeur par défaut.
  splitter.addEventListener('dblclick', () => {
    root.style.removeProperty(name === 'side' ? '--side-w' : '--guide-w');
    writePrefs({ [key]: null });
  });

  // Clavier : flèches pour ajuster, Entrée pour replier.
  splitter.addEventListener('keydown', event => {
    const step = event.shiftKey ? 48 : 16;
    const dir = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (dir) {
      event.preventDefault();
      const signed = name === 'side' ? dir : -dir;
      writePrefs({ [key]: setWidth(name, currentWidth(name) + signed * step) });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      togglePanel(name);
    }
  });
}
bindSplitter('splitSide', 'side');
bindSplitter('splitGuide', 'guide');

/* ---------- Fenêtres ---------- */
const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const stack = [];
const returnFocus = new WeakMap();

const isOpen = win => !win.hidden && getComputedStyle(win).display !== 'none';

function onOpened(win) {
  if (stack.includes(win)) return;
  returnFocus.set(win, document.activeElement);
  stack.push(win);
  document.body.classList.add('window-open');
  requestAnimationFrame(() => {
    const preferred = win.querySelector('[data-autofocus]') || win.querySelector('.window-close') || win.querySelector(FOCUSABLE);
    preferred?.focus({ preventScroll: true });
  });
}
function onClosed(win) {
  const index = stack.indexOf(win);
  if (index === -1) return;
  stack.splice(index, 1);
  if (!stack.length) document.body.classList.remove('window-open');
  const previous = returnFocus.get(win);
  if (previous?.isConnected) previous.focus({ preventScroll: true });
}
function sync(win) { (isOpen(win) ? onOpened : onClosed)(win); }

export function closeWindow(win) {
  if (!win || !isOpen(win)) return;
  // Une fenêtre peut refuser la fermeture (modifications non enregistrées).
  const proceed = win.dispatchEvent(new CustomEvent('window:close', { bubbles: true, cancelable: true }));
  if (proceed) win.hidden = true;
}

const observer = new MutationObserver(records => {
  for (const record of records) {
    if (record.type === 'attributes' && record.target.matches?.('[data-window]')) sync(record.target);
    if (record.type === 'childList') {
      record.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.matches('[data-window]')) sync(node);
        node.querySelectorAll?.('[data-window]').forEach(sync);
      });
    }
  }
});
observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'class'] });
document.querySelectorAll('[data-window]').forEach(win => { if (isOpen(win)) onOpened(win); });

// Fermeture au clic sur le fond (fenêtres de type .modal ou .window-backdrop).
document.addEventListener('pointerdown', event => {
  const win = event.target;
  if (win.matches?.('[data-window].modal, [data-window].window-backdrop')) closeWindow(win);
});

/* ---------- Clavier ---------- */
const typing = el => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

document.addEventListener('keydown', event => {
  const top = stack[stack.length - 1];

  if (event.key === 'Escape' && top) {
    event.preventDefault();
    closeWindow(top);
    return;
  }

  // Focus piégé dans la fenêtre au premier plan.
  if (event.key === 'Tab' && top) {
    const items = [...top.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (!top.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    return;
  }

  if (top || typing(document.activeElement) || event.ctrlKey || event.metaKey || event.altKey) return;
  if (document.querySelector('.workspace')?.hidden) return;
  if (document.body.classList.contains('ga-locked')) return;

  if (event.key === 'ArrowRight' && !document.activeElement?.matches('.splitter')) document.getElementById('next')?.click();
  else if (event.key === 'ArrowLeft' && !document.activeElement?.matches('.splitter')) document.getElementById('prev')?.click();
  else if (event.key === '[') togglePanel('side');
  else if (event.key === ']') togglePanel('guide');
});

window.Guide3DUI = { closeWindow, togglePanel };
