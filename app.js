import { chapters as demoChapters, sequence as demoSequence, firstStepOfChapter as demoFirstStep } from './data.js';
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCG9nmgw8xm83xD6BlbXLyS8fCd41olX6s",
  authDomain: "guide-3d.firebaseapp.com",
  projectId: "guide-3d",
  storageBucket: "guide-3d.firebasestorage.app",
  messagingSenderId: "714446657255",
  appId: "1:714446657255:web:7ed8061d9baf056200b442"
};
const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const $ = id => document.getElementById(id);
const state = { index: 0, checked: new Set(), viewer: null, chapters: demoChapters, sequence: demoSequence, firstStep: demoFirstStep };
const chapterNav = $('chapterList');

function normal(value) {
  return String(value ?? '').trim().toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function sortByOrder(a, b) { return (Number(a.order) || 0) - (Number(b.order) || 0); }
function list(value) { return Array.isArray(value) ? value : []; }

function buildChapters(raw) {
  return raw.filter(c => c.active !== false).sort(sortByOrder).map((c, i) => ({
    id: c.id,
    title: c.title || c.name || `Chapitre ${i + 1}`,
    subtitle: c.description || 'Procédure de montage',
    items: list(c.bom || c.items).map(x =>
      Array.isArray(x) ? x : [x.code || '', x.name || x.designation || '', x.quantity ?? x.qty ?? 1]
    ),
    steps: list(c.steps).map(s => ({
      title: s.title || 'Étape sans titre',
      description: s.instruction || s.description || '',
      focus: list(s.focus),
      check: s.check || s.checkpoint || '',
      parts: list(s.parts),
      tools: list(s.tools),
      photos: list(s.photos)
    }))
  })).filter(c => c.steps.length);
}

function setProcedureData(chapters) {
  state.chapters = chapters;
  state.sequence = chapters.flatMap((chapter, chapterIndex) =>
    chapter.steps.map((step, stepIndex) => ({ ...step, chapterIndex, stepIndex }))
  );
  state.firstStep = index => state.sequence.findIndex(step => step.chapterIndex === index);
  state.index = 0;
  state.checked.clear();
  renderNavigation();
  renderStep();
}

function renderNavigation() {
  chapterNav.replaceChildren();
  state.chapters.forEach((chapter, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chapter-button';
    button.innerHTML = '<span class="chapter-index"></span><span class="chapter-text"><strong></strong><small></small></span><span class="chapter-chevron">›</span>';
    button.querySelector('.chapter-index').textContent = String(i + 1).padStart(2, '0');
    button.querySelector('strong').textContent = chapter.title;
    button.querySelector('small').textContent = `${chapter.steps.length} étape(s) · ${chapter.subtitle}`;
    button.addEventListener('click', () => openSheet(i));
    chapterNav.append(button);
  });
  $('chapterCount').textContent = `${state.chapters.length} MODULES`;
}

function currentStep() { return state.sequence[state.index]; }

function renderPhotos(photos) {
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
    $('stepCheck').closest('.detail-card').after(panel);
  }
  const content = $('stepPhotoContent');
  content.replaceChildren();
  const valid = photos.map(item => typeof item === 'string' ? { url: item } : item).filter(item => item && (item.url || item.src));
  panel.hidden = valid.length === 0;
  valid.forEach(item => {
    const img = document.createElement('img');
    img.src = item.url || item.src;
    img.alt = item.caption || 'Photo de l’étape';
    img.loading = 'lazy';
    img.style.cssText = 'width:100%;max-height:230px;object-fit:contain;border-radius:8px;margin:6px 0;background:#f1f4f6';
    content.append(img);
    if (item.caption) {
      const caption = document.createElement('small');
      caption.textContent = item.caption;
      content.append(caption);
    }
  });
}

function renderStep() {
  if (!state.sequence.length) return;
  const step = currentStep();
  const chapter = state.chapters[step.chapterIndex];
  $('stepBadge').textContent = `ÉTAPE ${String(state.index + 1).padStart(2, '0')} / ${String(state.sequence.length).padStart(2, '0')}`;
  $('progressBar').style.width = `${(state.index + 1) / state.sequence.length * 100}%`;
  $('chapterKicker').textContent = `CHAPITRE ${String(step.chapterIndex + 1).padStart(2, '0')} · ${chapter.title.toUpperCase()}`;
  $('stepTitle').textContent = step.title;
  $('viewerTitle').textContent = chapter.title;
  $('stepDescription').textContent = step.description;

  const partNames = {
    sideL: 'Panneau gauche', sideR: 'Panneau droit', bottom: 'Panneau inférieur',
    back: 'Panneau arrière', top: 'Plateau supérieur', sink: 'Évier',
    hob: 'Plaques', drawer: 'Tiroir', shutter: 'Volet',
    network: 'Compartiment technique', hot: 'Eau chaude', cold: 'Eau froide', gas: 'Gaz'
  };
  const parts = step.parts.length ? step.parts.join(' · ') : step.focus.map(id => partNames[id] || id).join(' · ');
  $('stepParts').textContent = parts || 'Ensemble du meuble';
  $('partHint').textContent = step.focus.length ? `${step.focus.length} élément(s) mis en évidence` : 'Vue générale du sous-ensemble';
  $('stepCheck').textContent = step.check || 'Aucun point de contrôle renseigné.';
  $('prev').disabled = state.index === 0;
  $('next').disabled = state.index === state.sequence.length - 1;

  [...chapterNav.children].forEach((button, i) => {
    button.classList.toggle('active', i === step.chapterIndex);
    if (i === step.chapterIndex) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  state.viewer?.setFocus(step.focus);
  renderPhotos(step.photos);
}

function navigate(delta) {
  const next = state.index + delta;
  if (next < 0 || next >= state.sequence.length) return;
  const oldChapter = state.sequence[state.index].chapterIndex;
  const newChapter = state.sequence[next].chapterIndex;
  if (newChapter !== oldChapter) { openSheet(newChapter); return; }
  state.index = next;
  renderStep();
}

function openSheet(index) {
  const chapter = state.chapters[index];
  $('sheetChapter').textContent = `CHAPITRE ${String(index + 1).padStart(2, '0')} / ${state.chapters.length} · FICHE DE PRÉPARATION`;
  $('sheetTitle').textContent = chapter.title;
  const body = $('bomRows');
  body.replaceChildren();
  chapter.items.forEach(([code, name, qty]) => {
    const row = document.createElement('tr');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.checked.has(`${chapter.id}:${code}`);
    checkbox.setAttribute('aria-label', `Vérifier ${name}`);
    checkbox.addEventListener('change', () => {
      const key = `${chapter.id}:${code}`;
      if (checkbox.checked) state.checked.add(key);
      else state.checked.delete(key);
      updateSheet(index);
    });
    const cell = document.createElement('td');
    cell.append(checkbox);
    row.append(cell);
    [code, name, qty].forEach(value => {
      const td = document.createElement('td');
      td.textContent = String(value ?? '');
      row.append(td);
    });
    body.append(row);
  });
  $('startChapter').onclick = () => {
    state.index = state.firstStep(index);
    $('sheet').hidden = true;
    renderStep();
  };
  $('sheet').hidden = false;
  updateSheet(index);
  $('closeSheet').focus();
}

function updateSheet(index) {
  const chapter = state.chapters[index];
  const count = chapter.items.filter(([code]) => state.checked.has(`${chapter.id}:${code}`)).length;
  $('sheetStatus').textContent = `${count} / ${chapter.items.length} références vérifiées`;
  $('sheetProgress').style.width = `${chapter.items.length ? count / chapter.items.length * 100 : 100}%`;
  $('startChapter').disabled = count !== chapter.items.length;
}

async function loadPublishedProcedure(config) {
  const [procedureSnap, chapterSnap] = await Promise.all([
    getDocs(collection(db, 'procedures')),
    getDocs(collection(db, 'chapters'))
  ]);
  const procedures = procedureSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const procedure = procedures
    .filter(p => p.status === 'published'
      && normal(p.vehicleId) === normal(config.model)
      && normal(p.finishId) === normal(config.finish)
      && normal(p.workstationId) === normal(config.station))
    .sort(sortByOrder)[0];

  if (!procedure) return false;
  const chapters = buildChapters(chapterSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(c => c.procedureId === procedure.id));

  if (!chapters.length) return false;
  setProcedureData(chapters);
  const summary = $('selectedConfiguration');
  if (summary) summary.textContent = `${config.model} · ${String(config.finish).toUpperCase()} · ${config.station} · ${procedure.title || 'Guide publié'}`;
  return true;
}

async function applyConfiguration(config) {
  if (!config) return;
  $('chapterCount').textContent = 'CHARGEMENT…';
  try {
    const loaded = await loadPublishedProcedure(config);
    if (loaded) return;
    setProcedureData(demoChapters);
    $('chapterCount').textContent = `${demoChapters.length} MODULES · DÉMO`;
    $('stepDescription').textContent += ' (Aucune procédure publiée ne correspond à cette configuration : démonstration affichée.)';
  } catch (error) {
    console.error('Chargement Firestore impossible', error);
    setProcedureData(demoChapters);
    $('chapterCount').textContent = `${demoChapters.length} MODULES · DÉMO`;
  }
}

$('prev').addEventListener('click', () => navigate(-1));
$('next').addEventListener('click', () => navigate(1));
$('openSheet').addEventListener('click', () => openSheet(currentStep().chapterIndex));
$('closeSheet').addEventListener('click', () => $('sheet').hidden = true);
$('sheet').addEventListener('click', event => { if (event.target === $('sheet')) $('sheet').hidden = true; });
document.addEventListener('keydown', event => { if (event.key === 'Escape') $('sheet').hidden = true; });

renderNavigation();
renderStep();
window.addEventListener('guide3d:configuration', event => applyConfiguration(event.detail));

try {
  const { AssemblyViewer } = await import('./viewer.js');
  state.viewer = new AssemblyViewer($('scene'));
  state.viewer.setFocus(currentStep().focus);
  $('reset').onclick = () => state.viewer.reset();
  $('explode').onclick = () => $('explode').setAttribute('aria-pressed', String(state.viewer.toggleExplode()));
  $('highlight').onclick = () => $('highlight').setAttribute('aria-pressed', String(state.viewer.toggleHighlight()));
  $('zoomIn').onclick = () => state.viewer.zoom(.83);
  $('zoomOut').onclick = () => state.viewer.zoom(1.2);
} catch (error) {
  console.error('Échec du chargement 3D', error);
  $('sceneError').hidden = false;
  document.querySelectorAll('.viewer-tools button').forEach(button => button.disabled = true);
}
