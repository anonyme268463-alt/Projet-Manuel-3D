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

const state = { page: 0, model: '', finish: '', station: '' };
const models = ['Flex 3', 'Flex 5', 'Flex +'];
const stations = [
  ['Cuisine', 'Assemblage du bloc cuisine', true],
  ['Menuiserie', 'Meubles et habillages', false],
  ['Électricité', 'Installation électrique', false],
  ['Plomberie', 'Installation des réseaux d’eau', false],
  ['Gaz', 'Installation des équipements gaz', false],
  ['Finitions', 'Contrôles et finitions', false]
];
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
    models.forEach(model => grid.append(card(model, 'Gamme du véhicule', () => {
      state.model = model; state.page = 1; render();
    })));
  }
  if (state.page === 1) {
    grid.append(card('ALBA', 'Noir & Chêne', () => {
      state.finish = 'Alba'; state.page = 2; render();
    }, { swatches: ['#18191b', '#ba9163'] }));
    grid.append(card('SERA', 'Noir & Blanc', () => {
      state.finish = 'Sera'; state.page = 2; render();
    }, { swatches: ['#18191b', '#f4f3ef'] }));
  }
  if (state.page === 2) {
    stations.forEach(([name, desc, available]) => grid.append(card(name, desc, () => {
      state.station = name; state.page = 3; render();
    }, { disabled: !available })));
  }
  if (state.page === 3) {
    grid.append(card('Gamme', state.model, () => { state.page = 0; render(); }));
    grid.append(card('Coloris', `${state.finish.toUpperCase()} · ${state.finish === 'Alba' ? 'Noir & Chêne' : 'Noir & Blanc'}`, () => {
      state.page = 1; render();
    }));
    grid.append(card('Poste', state.station, () => { state.page = 2; render(); }));
    grid.append(card('Ouvrir le guide', 'Afficher la procédure correspondant à la sélection', openGuide, { primary: true }));
  }
  $('wizardHint').textContent = state.page === 2
    ? 'Seule la cuisine dispose actuellement d’une démonstration.'
    : state.page === 3 ? 'Les procédures de démonstration ne sont pas des instructions industrielles.' : 'Choisissez une option pour continuer.';
}

function openGuide() {
  wizard.hidden = true;
  workspace.hidden = false;
  const config = { model: state.model, finish: state.finish, station: state.station };
  window.__GUIDE_CONFIG__ = config;
  $('vehicle').replaceChildren(new Option(state.model, state.model));
  $('station').replaceChildren(new Option(state.station, state.station));
  let summary = $('selectedConfiguration');
  if (!summary) {
    summary = document.createElement('p');
    summary.id = 'selectedConfiguration';
    summary.className = 'selected-configuration';
    document.querySelector('.viewer-heading > div').append(summary);
  }
  summary.textContent = `${state.model} · ${state.finish.toUpperCase()} · ${state.station} · Chargement du guide…`;
  window.dispatchEvent(new CustomEvent('guide3d:configuration', { detail: config }));
  window.scrollTo(0, 0); wizard.scrollTop = 0;
}

$('accessGuide').addEventListener('click', () => {
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
change.addEventListener('click', () => {
  workspace.hidden = true;
  wizard.hidden = false;
  state.page = 0;
  render();
  window.scrollTo(0, 0); wizard.scrollTop = 0;
});
