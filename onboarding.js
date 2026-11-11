const $ = (id) => document.getElementById(id);
const workspace = document.querySelector('.workspace');
const welcome = document.createElement('main');
welcome.className = 'welcome-screen';
welcome.innerHTML = `<section class="welcome-card"><div class="welcome-brand">ANTILOPE VAN <small>ESPACE DE PRODUCTION</small></div><p class="eyebrow">GUIDE DE MONTAGE INTERACTIF</p><h1>Le bon geste,<br><em>à chaque étape.</em></h1><p class="welcome-copy">Retrouvez les procédures de montage de votre véhicule, étape par étape, avec une visualisation 3D.</p><button class="welcome-cta" id="accessGuide">ACCÉDER AU GUIDE <span>→</span></button><p class="welcome-note">Accès libre · Version de démonstration</p></section><section class="welcome-side"><div class="welcome-orbit"></div><div class="welcome-side-copy"><span>ATELIER 3D</span><h2>Un guide clair.<br>Un montage maîtrisé.</h2><p>Conçu pour accompagner les équipes de production.</p></div></section>`;
const wizard = document.createElement('main');
wizard.className = 'wizard-screen';
wizard.hidden = true;
wizard.innerHTML = `<div class="wizard-heading"><div><p class="eyebrow">CONFIGURATION DU VÉHICULE</p><h1 id="wizardTitle"></h1><p id="wizardSubtitle"></p></div><div class="wizard-count"><strong id="wizardNumber">01</strong> / 04</div></div><div class="wizard-track"><div id="wizardProgress"></div></div><div class="wizard-cards" id="wizardCards"></div><div class="wizard-bottom"><button id="wizardBack" class="btn-outline">← Retour</button><span id="wizardHint"></span></div>`;
document.querySelector('.topbar').after(welcome);
welcome.after(wizard);
workspace.hidden = true;
const state = {page: 0, model: '', finish: '', station: ''};
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
function card(title, subtitle, callback, {swatches, disabled=false} = {}) {
  const button = document.createElement('button');
  button.className = 'wizard-card'; button.type = 'button'; button.disabled = disabled;
  if (swatches) {
    const colors = document.createElement('span'); colors.className = 'wizard-swatches';
    swatches.forEach(color => {const dot=document.createElement('i');dot.style.backgroundColor=color;colors.append(dot)});
    button.append(colors);
  }
  const strong=document.createElement('strong');strong.textContent=title;
  const small=document.createElement('small');small.textContent=subtitle;
  button.append(strong,small);
  const foot=document.createElement('span');foot.className='wizard-card-foot';foot.textContent=disabled?'À VENIR':'→';button.append(foot);
  if(!disabled)button.addEventListener('click',callback);
  return button;
}
function render() {
  $('wizardTitle').textContent = headings[state.page][0];
  $('wizardSubtitle').textContent = headings[state.page][1];
  $('wizardNumber').textContent = String(state.page + 1).padStart(2,'0');
  $('wizardProgress').style.width = `${(state.page+1)*25}%`;
  $('wizardBack').hidden = state.page === 0;
  const grid=$('wizardCards');grid.replaceChildren();
  if(state.page===0) models.forEach(model => grid.append(card(model,'Gamme du véhicule',()=>{state.model=model;state.page=1;render()})));
  if(state.page===1) {
    grid.append(card('ALBA','Noir & Chêne',()=>{state.finish='Alba';state.page=2;render()},{swatches:['#18191b','#ba9163']}));
    grid.append(card('SERA','Noir & Blanc',()=>{state.finish='Sera';state.page=2;render()},{swatches:['#18191b','#f4f3ef']}));
  }
  if(state.page===2) stations.forEach(([name,desc,available])=>grid.append(card(name,desc,()=>{state.station=name;state.page=3;render()},{disabled:!available})));
  if(state.page===3) {
    grid.append(card('Gamme',state.model,()=>{state.page=0;render()}));
    grid.append(card('Coloris',`${state.finish.toUpperCase()} · ${state.finish==='Alba'?'Noir & Chêne':'Noir & Blanc'}`,()=>{state.page=1;render()}));
    grid.append(card('Poste',state.station,()=>{state.page=2;render()}));
    grid.append(card('OUVRIR LE GUIDE','Afficher la procédure 3D de démonstration',openGuide));
  }
  $('wizardHint').textContent=state.page===2?'Seule la cuisine dispose actuellement d’une démonstration.':state.page===3?'Les procédures sont encore des exemples non validés.':'Choisissez une option pour continuer.';
}
function openGuide(){
  wizard.hidden=true;workspace.hidden=false;
  $('vehicle').replaceChildren(new Option(state.model,state.model));
  $('station').replaceChildren(new Option(state.station,state.station));
  let summary=$('selectedConfiguration');
  if(!summary){summary=document.createElement('p');summary.id='selectedConfiguration';summary.className='selected-configuration';document.querySelector('.viewer-heading > div').append(summary)}
  summary.textContent=`${state.model} · ${state.finish.toUpperCase()} · ${state.station} · Démonstration générique`;
  window.scrollTo(0,0);
}
$('accessGuide').addEventListener('click',()=>{welcome.hidden=true;wizard.hidden=false;state.page=0;render();window.scrollTo(0,0)});
$('wizardBack').addEventListener('click',()=>{state.page=Math.max(0,state.page-1);render()});
const change=document.createElement('button');change.type='button';change.className='change-configuration';change.textContent='← Changer de configuration';
document.querySelector('.side-footer').append(change);
change.addEventListener('click',()=>{workspace.hidden=true;wizard.hidden=false;state.page=0;render();window.scrollTo(0,0)});
