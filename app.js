import { chapters as demoChapters, sequence as demoSequence, firstStepOfChapter as demoFirstStep } from './data.js';
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCG9nmgw8xm83xD6BlbXLyS8fCd41olX6s",
  authDomain: "guide-3d.firebaseapp.com",
  projectId: "guide-3d",
  storageBucket: "guide-3d.firebasestorage.app",
  messagingSenderId: "714446657255",
  appId: "1:714446657255:web:7ed8061d9baf056200b442",
  measurementId: "G-VJZ0W8ST2C"
};

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const $ = id => document.getElementById(id);

const state = {
  index: 0,
  checked: new Set(),
  viewer: null,
  chapters: Array.isArray(demoChapters) ? demoChapters : [],
  sequence: Array.isArray(demoSequence) ? demoSequence : [],
  firstStep: typeof demoFirstStep === 'function' ? demoFirstStep : (() => 0),
  source: 'demo'
};

const chapterNav = $('chapterList');

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}
function safeText(value, fallback = '') {
  return value === null || value === undefined ? fallback : String(value);
}
function normal(value) {
  return safeText(value).trim().toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function sortByOrder(a, b) {
  return (Number(a.order) || 0) - (Number(b.order) || 0);
}
function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = safeText(value);
}
function setDisabled(id, value) {
  const element = $(id);
  if (element) element.disabled = Boolean(value);
}
function reportStatus(message, level = 'info') {
  const count = $('chapterCount');
  if (count && level === 'loading') count.textContent = 'CHARGEMENT…';
  const description = $('stepDescription');
  if (description && level === 'error') {
    description.textContent = `${message} — Les données de démonstration restent disponibles.`;
  }
  console[level === 'error' ? 'error' : 'log'](`[Guide 3D] ${message}`);
}

function normalizeDemoChapter(chapter, index) {
  return {
    id: safeText(chapter?.id, `demo-${index}`),
    title: safeText(chapter?.title || chapter?.name, `Chapitre ${index + 1}`),
    subtitle: safeText(chapter?.subtitle || chapter?.description, 'Procédure de démonstration'),
    items: safeArray(chapter?.items).map(item => Array.isArray(item)
      ? [safeText(item[0]), safeText(item[1]), item[2] ?? 1]
      : [safeText(item?.code), safeText(item?.name || item?.designation), item?.quantity ?? 1]),
    steps: safeArray(chapter?.steps).map(step => ({
      title: safeText(step?.title, 'Étape sans titre'),
      description: safeText(step?.instruction || step?.description),
      focus: safeArray(step?.focus),
      check: safeText(step?.check || step?.checkpoint),
      parts: safeArray(step?.parts),
      tools: safeArray(step?.tools),
      photos: safeArray(step?.photos)
    }))
  };
}

function buildFirestoreChapters(rawChapters) {
  return rawChapters
    .filter(chapter => chapter && chapter.active !== false)
    .sort(sortByOrder)
    .map((chapter, index) => ({
      id: safeText(chapter.id, `chapter-${index}`),
      title: safeText(chapter.title || chapter.name, `Chapitre ${index + 1}`),
      subtitle: safeText(chapter.description || chapter.subtitle, 'Procédure de montage'),
      items: safeArray(chapter.bom || chapter.items).map(item => Array.isArray(item)
        ? [safeText(item[0]), safeText(item[1]), item[2] ?? 1]
        : [safeText(item?.code), safeText(item?.name || item?.designation), item?.quantity ?? item?.qty ?? 1]),
      steps: safeArray(chapter.steps).map(step => ({
        title: safeText(step?.title, 'Étape sans titre'),
        description: safeText(step?.instruction || step?.description),
        focus: safeArray(step?.focus),
        check: safeText(step?.check || step?.checkpoint),
        parts: safeArray(step?.parts),
        tools: safeArray(step?.tools),
        photos: safeArray(step?.photos)
      }))
    }))
    .filter(chapter => chapter.steps.length > 0);
}

function setProcedureData(chapters, source = 'demo') {
  state.chapters = chapters;
  state.sequence = chapters.flatMap((chapter, chapterIndex) =>
    chapter.steps.map((step, stepIndex) => ({ ...step, chapterIndex, stepIndex }))
  );
  state.firstStep = index => state.sequence.findIndex(step => step.chapterIndex === index);
  state.index = 0;
  state.checked.clear();
  state.source = source;

  const count = $('chapterCount');
  if (count) count.textContent = `${chapters.length} MODULES${source === 'demo' ? ' · DÉMO' : ' · FIRESTORE'}`;

  renderNavigation();
  if (state.sequence.length) {
    renderStep();
  } else {
    setText('stepTitle', 'Aucune étape disponible');
    setText('stepDescription', 'La procédure sélectionnée ne contient pas encore d’étapes.');
    setText('stepParts', 'Aucune pièce renseignée');
    setText('stepCheck', 'Aucun point de contrôle renseigné.');
    setDisabled('prev', true);
    setDisabled('next', true);
  }
}

function renderNavigation() {
  if (!chapterNav) return;
  chapterNav.replaceChildren();

  state.chapters.forEach((chapter, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chapter-button';
    button.innerHTML = '<span class="chapter-index"></span><span class="chapter-text"><strong></strong><small></small></span><span class="chapter-chevron">›</span>';
    button.querySelector('.chapter-index').textContent = String(index + 1).padStart(2, '0');
    button.querySelector('strong').textContent = chapter.title;
    button.querySelector('small').textContent = `${chapter.steps.length} étape(s) · ${chapter.subtitle}`;
    button.addEventListener('click', () => openSheet(index));
    chapterNav.append(button);
  });
}

function currentStep() {
  return state.sequence[state.index] || null;
}

function renderPhotos(photos) {
  const stepCheck = $('stepCheck');
  if (!stepCheck?.closest('.detail-card')) return;

  let panel = $('stepPhotos');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'stepPhotos';
    panel.className = 'detail-card';
    const label = document.createElement('div');
    label.className = 'detail-label';
    label.textContent = '▧ PHOTOS DE L’ÉTAPE';
    const content = document.createElement('div');
    content.id = 'stepPhotoContent';
    content.className = 'detail-content';
    panel.append(label, content);
    stepCheck.closest('.detail-card').after(panel);
  }

  const content = $('stepPhotoContent');
  if (!content) return;
  content.replaceChildren();

  const validPhotos = safeArray(photos).map(photo =>
    typeof photo === 'string' ? { url: photo } : photo
  ).filter(photo => photo && (photo.url || photo.src));

  panel.hidden = validPhotos.length === 0;
  validPhotos.forEach(photo => {
    const image = document.createElement('img');
    image.src = photo.url || photo.src;
    image.alt = safeText(photo.caption, 'Photo de l’étape');
    image.loading = 'lazy';
    image.style.cssText = 'width:100%;max-height:230px;object-fit:contain;border-radius:8px;margin:6px 0;background:#f1f4f6';
    content.append(image);

    if (photo.caption) {
      const caption = document.createElement('small');
      caption.textContent = photo.caption;
      content.append(caption);
    }
  });
}

function renderStep() {
  const step = currentStep();
  if (!step) return;

  const chapter = state.chapters[step.chapterIndex];
  const focus = safeArray(step.focus);
  const partsList = safeArray(step.parts);
  const photos = safeArray(step.photos);

  setText('stepBadge', `ÉTAPE ${String(state.index + 1).padStart(2, '0')} / ${String(state.sequence.length).padStart(2, '0')}`);
  const progress = $('progressBar');
  if (progress) progress.style.width = `${(state.index + 1) / state.sequence.length * 100}%`;

  setText('chapterKicker', `CHAPITRE ${String(step.chapterIndex + 1).padStart(2, '0')} · ${safeText(chapter?.title).toUpperCase()}`);
  setText('stepTitle', step.title);
  setText('viewerTitle', chapter?.title || 'Guide de montage');
  setText('stepDescription', step.description);

  const partNames = {
    sideL: 'Panneau gauche',
    sideR: 'Panneau droit',
    bottom: 'Panneau inférieur',
    back: 'Panneau arrière',
    top: 'Plateau supérieur',
    sink: 'Évier',
    hob: 'Plaques',
    drawer: 'Tiroir',
    shutter: 'Volet',
    network: 'Compartiment technique',
    hot: 'Eau chaude',
    cold: 'Eau froide',
    gas: 'Gaz'
  };

  // FIX: les données de démonstration ne définissent pas toujours step.parts.
  const parts = partsList.length
    ? partsList.map(part => typeof part === 'string' ? part : safeText(part?.name || part?.label)).filter(Boolean).join(' · ')
    : focus.map(id => partNames[id] || id).join(' · ');

  setText('stepParts', parts || 'Ensemble du meuble');
  setText('partHint', focus.length ? `${focus.length} élément(s) mis en évidence` : 'Vue générale du sous-ensemble');
  setText('stepCheck', step.check || 'Aucun point de contrôle renseigné.');

  setDisabled('prev', state.index === 0);
  setDisabled('next', state.index === state.sequence.length - 1);

  if (chapterNav) {
    [...chapterNav.children].forEach((button, index) => {
      button.classList.toggle('active', index === step.chapterIndex);
      if (index === step.chapterIndex) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
  }

  try {
    state.viewer?.setFocus(focus);
  } catch (error) {
    console.warn('[Guide 3D] Mise en évidence 3D indisponible :', error);
  }

  renderPhotos(photos);
}

function navigate(delta) {
  const nextIndex = state.index + delta;
  if (nextIndex < 0 || nextIndex >= state.sequence.length) return;

  const oldChapter = state.sequence[state.index].chapterIndex;
  const newChapter = state.sequence[nextIndex].chapterIndex;
  if (newChapter !== oldChapter) {
    openSheet(newChapter);
    return;
  }

  state.index = nextIndex;
  renderStep();
}

function openSheet(index) {
  const chapter = state.chapters[index];
  if (!chapter) return;

  setText('sheetChapter', `CHAPITRE ${String(index + 1).padStart(2, '0')} / ${state.chapters.length} · FICHE DE PRÉPARATION`);
  setText('sheetTitle', chapter.title);

  const body = $('bomRows');
  if (!body) return;
  body.replaceChildren();

  safeArray(chapter.items).forEach(item => {
    const [code, name, quantity] = Array.isArray(item)
      ? item
      : [item?.code, item?.name || item?.designation, item?.quantity ?? item?.qty ?? 1];

    const row = document.createElement('tr');
    const checkbox = document.createElement('input');
    const key = `${chapter.id}:${safeText(code)}`;
    checkbox.type = 'checkbox';
    checkbox.checked = state.checked.has(key);
    checkbox.setAttribute('aria-label', `Vérifier ${safeText(name)}`);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) state.checked.add(key);
      else state.checked.delete(key);
      updateSheet(index);
    });

    const checkCell = document.createElement('td');
    checkCell.append(checkbox);
    row.append(checkCell);

    [code, name, quantity].forEach(value => {
      const cell = document.createElement('td');
      cell.textContent = safeText(value);
      row.append(cell);
    });
    body.append(row);
  });

  const startButton = $('startChapter');
  if (startButton) {
    startButton.onclick = () => {
      const first = state.firstStep(index);
      if (first < 0) return;
      state.index = first;
      const sheet = $('sheet');
      if (sheet) sheet.hidden = true;
      renderStep();
    };
  }

  const sheet = $('sheet');
  if (sheet) sheet.hidden = false;
  updateSheet(index);
  $('closeSheet')?.focus();
}

function updateSheet(index) {
  const chapter = state.chapters[index];
  if (!chapter) return;

  const items = safeArray(chapter.items);
  const count = items.filter(item => {
    const code = Array.isArray(item) ? item[0] : item?.code;
    return state.checked.has(`${chapter.id}:${safeText(code)}`);
  }).length;

  setText('sheetStatus', `${count} / ${items.length} références vérifiées`);
  const progress = $('sheetProgress');
  if (progress) progress.style.width = `${items.length ? count / items.length * 100 : 100}%`;
  setDisabled('startChapter', count !== items.length || state.firstStep(index) < 0);
}

async function loadPublishedProcedure(config) {
  const [proceduresSnapshot, chaptersSnapshot] = await Promise.all([
    getDocs(collection(db, 'procedures')),
    getDocs(collection(db, 'chapters'))
  ]);

  const procedures = proceduresSnapshot.docs.map(document => ({
    id: document.id,
    ...document.data()
  }));

  const selected = procedures
    .filter(procedure =>
      procedure.status === 'published' &&
      normal(procedure.vehicleId) === normal(config.model) &&
      normal(procedure.finishId) === normal(config.finish) &&
      normal(procedure.workstationId) === normal(config.station)
    )
    .sort(sortByOrder)[0];

  if (!selected) return false;

  const rawChapters = chaptersSnapshot.docs
    .map(document => ({ id: document.id, ...document.data() }))
    .filter(chapter => chapter.procedureId === selected.id);

  const chapters = buildFirestoreChapters(rawChapters);
  if (!chapters.length) return false;

  setProcedureData(chapters, 'firestore');

  const summary = $('selectedConfiguration');
  if (summary) {
    summary.textContent = `${config.model} · ${String(config.finish).toUpperCase()} · ${config.station} · ${selected.title || 'Guide publié'}`;
  }
  return true;
}

async function applyConfiguration(config) {
  if (!config) return;
  reportStatus('Chargement de la procédure…', 'loading');

  try {
    const found = await loadPublishedProcedure(config);
    if (found) {
      reportStatus('Procédure publiée chargée depuis Firestore.');
      return;
    }

    setProcedureData(state.chapters === demoChapters ? state.chapters : demoChapters, 'demo');
    const summary = $('selectedConfiguration');
    if (summary) {
      summary.textContent = `${config.model} · ${String(config.finish).toUpperCase()} · ${config.station} · Démonstration`;
    }
    reportStatus('Aucune procédure publiée ne correspond à cette configuration. Démonstration affichée.');
  } catch (error) {
    console.error('[Guide 3D] Lecture Firestore impossible :', error);
    setProcedureData(demoChapters.map(normalizeDemoChapter), 'demo');
    reportStatus(`Lecture Firestore impossible (${error.code || 'erreur'}).`, 'error');
  }
}

$('prev')?.addEventListener('click', () => navigate(-1));
$('next')?.addEventListener('click', () => navigate(1));
$('openSheet')?.addEventListener('click', () => {
  const step = currentStep();
  if (step) openSheet(step.chapterIndex);
});
$('closeSheet')?.addEventListener('click', () => {
  const sheet = $('sheet');
  if (sheet) sheet.hidden = true;
});
$('sheet')?.addEventListener('click', event => {
  if (event.target === $('sheet')) $('sheet').hidden = true;
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && $('sheet')) $('sheet').hidden = true;
});

setProcedureData(demoChapters.map(normalizeDemoChapter), 'demo');
window.addEventListener('guide3d:configuration', event => applyConfiguration(event.detail));

try {
  const { AssemblyViewer } = await import('./viewer.js');
  state.viewer = new AssemblyViewer($('scene'));
  const initialStep = currentStep();
  if (initialStep) state.viewer.setFocus(safeArray(initialStep.focus));
  $('reset')?.addEventListener('click', () => state.viewer?.reset());
  $('explode')?.addEventListener('click', () => {
    const button = $('explode');
    if (button) button.setAttribute('aria-pressed', String(state.viewer?.toggleExplode()));
  });
  $('highlight')?.addEventListener('click', () => {
    const button = $('highlight');
    if (button) button.setAttribute('aria-pressed', String(state.viewer?.toggleHighlight()));
  });
  $('zoomIn')?.addEventListener('click', () => state.viewer?.zoom(.83));
  $('zoomOut')?.addEventListener('click', () => state.viewer?.zoom(1.2));
} catch (error) {
  console.error('[Guide 3D] Échec du chargement 3D :', error);
  const sceneError = $('sceneError');
  if (sceneError) sceneError.hidden = false;
  document.querySelectorAll('.viewer-tools button').forEach(button => button.disabled = true);
}
