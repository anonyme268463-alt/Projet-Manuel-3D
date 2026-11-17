import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { db } from './firebase-client.js';

const $ = id => document.getElementById(id);
const workspace = document.querySelector('.workspace');

const welcome = document.createElement('main');
welcome.className = 'welcome-screen';
welcome.innerHTML = `<section class="welcome-card"><p class="eyebrow">Guide de montage interactif</p><h1>Le bon geste,<br><em>à chaque étape.</em></h1><p class="welcome-copy">Les procédures de montage de chaque véhicule Antilope Van, étape par étape, avec la pièce concernée mise en évidence en 3D.</p><button class="welcome-cta" id="accessGuide">Accéder au guide <span>→</span></button><ul class="welcome-points"><li>Procédures par poste</li><li>Nomenclature à cocher</li><li>Vue 3D éclatée</li></ul></section><section class="welcome-side"><div class="welcome-illustration"><svg viewBox="0 0 560 300" role="img" aria-label="Illustration : van aménagé et bloc cuisine en vue technique">
  <defs><linearGradient id="vanBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".10"/><stop offset="1" stop-color="#ffffff" stop-opacity=".03"/></linearGradient></defs>
  <g fill="none" stroke="#dfe6f6" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
    <path d="M44 214V78q0-24 24-24h292q18 0 30 13l64 70q8 9 21 11l18 3q13 2 13 16v47H44Z" fill="url(#vanBody)"/>
    <path d="M370 72l52 58H356V72Z" fill="#ffffff14"/>
    <rect x="252" y="76" width="88" height="48" rx="6" fill="#ffffff10"/>
    <path d="M232 76v130M346 76v130" stroke-opacity=".55"/>
    <path d="M44 160h50M480 176h26" stroke-opacity=".55"/>
    <circle cx="130" cy="214" r="30" fill="#16224a"/><circle cx="130" cy="214" r="11"/>
    <circle cx="424" cy="214" r="30" fill="#16224a"/><circle cx="424" cy="214" r="11"/>
  </g>
  <g stroke-linejoin="round">
    <rect x="114" y="122" width="96" height="74" rx="4" fill="#3cc08f" fill-opacity=".16" stroke="#3cc08f" stroke-width="2"/>
    <path d="M108 122h108" stroke="#3cc08f" stroke-width="5" stroke-linecap="round"/>
    <path d="M162 130v58M118 156h40" stroke="#3cc08f" stroke-width="1.5" stroke-opacity=".7"/>
    <rect x="124" y="114" width="28" height="5" rx="2" fill="#3cc08f"/>
  </g>
  <g fill="none" stroke="#9fb0d4" stroke-width="1.2" stroke-dasharray="3 4">
    <path d="M114 106v-20M210 106v-20M114 92h96"/>
    <path d="M162 122 V36 H286"/>
  </g>
  <g font-family="Inter, sans-serif" font-size="12" font-weight="600">
    <text x="292" y="34" fill="#ffffff">Bloc cuisine</text>
    <text x="292" y="50" fill="#9fb0d4" font-weight="500">7 étapes · 13 pièces</text>
  </g>
  <path d="M30 248h500" stroke="#ffffff" stroke-opacity=".12" stroke-width="2"/>
</svg></div><div class="welcome-side-copy"><span>Atelier 3D</span><h2>Un guide clair.<br>Un montage maîtrisé.</h2><p>Conçu pour accompagner les équipes de production.</p></div></section>`;

const wizard = document.createElement('main');
wizard.className = 'wizard-screen';
wizard.hidden = true;
wizard.innerHTML = `<div class="wizard-inner"><div class="wizard-heading"><div><p class="eyebrow">Configuration du véhicule</p><h1 id="wizardTitle"></h1><p id="wizardSubtitle"></p></div><div class="wizard-count"><strong id="wizardNumber">01</strong> / 04</div></div><div class="wizard-steps" id="wizardProgress" aria-hidden="true"><span></span><span></span><span></span><span></span></div><div class="wizard-cards" id="wizardCards"></div><div class="wizard-bottom"><button id="wizardBack" class="btn btn-outline">← Retour</button><span id="wizardHint"></span></div></div>`;

document.querySelector('.topbar').after(welcome);
welcome.after(wizard);
workspace.hidden = true;

const state = { page: 0, model: null, finish: null, station: null };

// Options de démonstration, remplacées par les données du créateur lorsqu'elles existent.
const DEMO = {
  models: [
    { id: 'flex-3', name: 'Flex 3', description: 'Gamme du véhicule' },
    { id: 'flex-5', name: 'Flex 5', description: 'Gamme du véhicule' },
    { id: 'flex-plus', name: 'Flex +', description: 'Gamme du véhicule' }
  ],
  finishes: [
    { id: 'alba', name: 'Alba', label: 'Noir & Chêne', colors: ['#18191b', '#ba9163'] },
    { id: 'sera', name: 'Sera', label: 'Noir & Blanc', colors: ['#18191b', '#f4f3ef'] }
  ],
  stations: [
    { id: 'cuisine', name: 'Cuisine', description: 'Assemblage du bloc cuisine', available: true },
    { id: 'menuiserie', name: 'Menuiserie', description: 'Meubles et habillages', available: false },
    { id: 'electricite', name: 'Électricité', description: 'Installation électrique', available: false },
    { id: 'plomberie', name: 'Plomberie', description: 'Installation des réseaux d’eau', available: false },
    { id: 'gaz', name: 'Gaz', description: 'Installation des équipements gaz', available: false },
    { id: 'finitions', name: 'Finitions', description: 'Contrôles et finitions', available: false }
  ]
};
const options = { ...DEMO };

async function loadOptions() {
  const read = async name => {
    const snapshot = await getDocs(collection(db, name));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.name).localeCompare(String(b.name), 'fr'));
  };
  try {
    const [vehicles, finishes, stations] = await Promise.all([read('vehicles'), read('finishes'), read('workstations')]);
    const v = vehicles.filter(x => x.active !== false && x.name);
    const f = finishes.filter(x => x.active !== false && x.name);
    const w = stations.filter(x => x.name);
    if (v.length) options.models = v.map(x => ({ id: x.id, name: x.name, description: x.description || 'Gamme du véhicule' }));
    if (f.length) options.finishes = f.map(x => ({ id: x.id, name: x.name, label: x.label || '', colors: Array.isArray(x.colors) ? x.colors : [] }));
    if (w.length) options.stations = w.map(x => ({ id: x.id, name: x.name, description: x.description || '', available: x.available !== false }));
  } catch (error) {
    console.warn('[Guide 3D] Options de configuration : données de démonstration utilisées.', error?.code || error);
  }
}

const headings = [
  ['Choisissez votre gamme', 'Sélectionnez le modèle de van.'],
  ['Choisissez votre coloris', 'Sélectionnez la finition intérieure.'],
  ['Choisissez votre poste', 'Sélectionnez le travail à réaliser.'],
  ['Vérifiez votre configuration', 'Vous pouvez modifier votre sélection avant de continuer.']
];

function card(title, subtitle, callback, { swatches, disabled = false, primary = false } = {}) {
  const button = document.createElement('button');
  button.className = primary ? 'wizard-card primary' : 'wizard-card';
  button.type = 'button';
  button.disabled = disabled;
  if (swatches) {
    const colors = document.createElement('span');
    colors.className = 'wizard-swatches';
    swatches.forEach(color => {
      const dot = document.createElement('i');
      dot.style.backgroundColor = color;
      colors.append(dot);
    });
    button.append(colors);
  }
  const strong = document.createElement('strong');
  strong.textContent = title;
  const small = document.createElement('small');
  small.textContent = subtitle;
  button.append(strong, small);
  const foot = document.createElement('span');
  foot.className = 'wizard-card-foot';
  foot.textContent = disabled ? 'À venir' : '→';
  button.append(foot);
  if (!disabled) button.addEventListener('click', callback);
  return button;
}

function render() {
  $('wizardTitle').textContent = headings[state.page][0];
  $('wizardSubtitle').textContent = headings[state.page][1];
  $('wizardNumber').textContent = String(state.page + 1).padStart(2, '0');
  [...$('wizardProgress').children].forEach((bar, i) => bar.classList.toggle('done', i <= state.page));
  $('wizardBack').style.visibility = state.page === 0 ? 'hidden' : 'visible';
  const grid = $('wizardCards');
  grid.replaceChildren();

  if (state.page === 0) {
    options.models.forEach(model => grid.append(card(model.name, model.description, () => {
      state.model = model; state.page = 1; render();
    })));
  }
  if (state.page === 1) {
    options.finishes.forEach(finish => grid.append(card(finish.name.toUpperCase(), finish.label, () => {
      state.finish = finish; state.page = 2; render();
    }, { swatches: finish.colors })));
  }
  if (state.page === 2) {
    options.stations.forEach(station => grid.append(card(station.name, station.description, () => {
      state.station = station; state.page = 3; render();
    }, { disabled: !station.available })));
  }
  if (state.page === 3) {
    grid.append(card('Gamme', state.model.name, () => { state.page = 0; render(); }));
    grid.append(card('Coloris', [state.finish.name.toUpperCase(), state.finish.label].filter(Boolean).join(' · '), () => {
      state.page = 1; render();
    }));
    grid.append(card('Poste', state.station.name, () => { state.page = 2; render(); }));
    grid.append(card('Ouvrir le guide', 'Afficher la procédure correspondant à la sélection', openGuide, { primary: true }));
  }
  $('wizardHint').textContent = state.page === 2
    ? 'Les postes « À venir » n’ont pas encore de guide.'
    : state.page === 3 ? 'Seules les procédures publiées sont affichées.' : 'Choisissez une option pour continuer.';
}

function openGuide() {
  wizard.hidden = true;
  workspace.hidden = false;
  const config = {
    model: state.model.name, modelId: state.model.id,
    finish: state.finish.name, finishId: state.finish.id,
    station: state.station.name, stationId: state.station.id
  };
  window.__GUIDE_CONFIG__ = config;
  $('vehicle').replaceChildren(new Option(config.model, config.modelId));
  $('station').replaceChildren(new Option(config.station, config.stationId));
  let summary = $('selectedConfiguration');
  if (!summary) {
    summary = document.createElement('p');
    summary.id = 'selectedConfiguration';
    summary.className = 'selected-configuration';
    document.querySelector('.viewer-heading > div').append(summary);
  }
  summary.textContent = `${config.model} · ${config.finish.toUpperCase()} · ${config.station} · Chargement du guide…`;
  window.dispatchEvent(new CustomEvent('guide3d:configuration', { detail: config }));
  window.scrollTo(0, 0); wizard.scrollTop = 0;
}

$('accessGuide').addEventListener('click', async () => {
  const button = $('accessGuide');
  button.disabled = true;
  await loadOptions();
  button.disabled = false;
  welcome.hidden = true;
  wizard.hidden = false;
  state.page = 0;
  render();
  window.scrollTo(0, 0); wizard.scrollTop = 0;
});
$('wizardBack').addEventListener('click', () => {
  state.page = Math.max(0, state.page - 1);
  render();
});

const change = document.createElement('button');
change.type = 'button';
change.className = 'change-configuration';
change.textContent = '← Changer de configuration';
document.querySelector('.side-footer').append(change);
change.addEventListener('click', async () => {
  await loadOptions();
  workspace.hidden = true;
  wizard.hidden = false;
  state.page = 0;
  render();
  window.scrollTo(0, 0); wizard.scrollTop = 0;
});
