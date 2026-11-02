import { chapters, sequence, firstStepOfChapter } from './data.js';
const $=(id)=>document.getElementById(id);
const state={index:0,checked:new Set(),viewer:null};
const chapterNav=$('chapterList');
$('chapterCount').textContent=`${chapters.length} MODULES`;
function chapterButton(chapter,i){const button=document.createElement('button');button.type='button';button.className='chapter-button';button.innerHTML=`<span class="chapter-index">${String(i+1).padStart(2,'0')}</span><span class="chapter-text"><strong></strong><small></small></span><span class="chapter-chevron">›</span>`;button.querySelector('strong').textContent=chapter.title;button.querySelector('small').textContent=`${chapter.steps.length} étape${chapter.steps.length>1?'s':''} · ${chapter.subtitle}`;button.addEventListener('click',()=>openSheet(i));chapterNav.append(button);return button;}
const chapterButtons=chapters.map(chapterButton);
function renderStep(){const step=sequence[state.index];const chapter=chapters[step.chapterIndex];
 $('stepBadge').textContent=`ÉTAPE ${String(state.index+1).padStart(2,'0')} / ${String(sequence.length).padStart(2,'0')}`;
 $('progressBar').style.width=`${(state.index+1)/sequence.length*100}%`;
 $('chapterKicker').textContent=`CHAPITRE ${String(step.chapterIndex+1).padStart(2,'0')} · ${chapter.title.toUpperCase()}`;
 $('stepTitle').textContent=step.title;$('viewerTitle').textContent=chapter.title;
 $('stepDescription').textContent=step.description;
 $('stepParts').textContent=step.focus.length?step.focus.map(id=>({sideL:'Panneau gauche',sideR:'Panneau droit',bottom:'Panneau inférieur',back:'Panneau arrière',top:'Plateau supérieur',sink:'Évier',hob:'Plaques',drawer:'Tiroir',shutter:'Volet',network:'Compartiment technique',hot:'Eau chaude',cold:'Eau froide',gas:'Gaz'})[id]||id).join(' · '):'Ensemble du meuble';
 $('partHint').textContent=step.focus.length?`${step.focus.length} élément(s) mis en évidence`:'Vue générale du sous-ensemble';
 $('stepCheck').textContent=step.check;$('prev').disabled=state.index===0;$('next').disabled=state.index===sequence.length-1;
 chapterButtons.forEach((button,i)=>{button.classList.toggle('active',i===step.chapterIndex);if(i===step.chapterIndex)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current')});
 state.viewer?.setFocus(step.focus);
}
function navigate(delta){const next=state.index+delta;if(next<0||next>=sequence.length)return;const oldChapter=sequence[state.index].chapterIndex;const newChapter=sequence[next].chapterIndex;if(newChapter!==oldChapter){openSheet(newChapter);return}state.index=next;renderStep()}
function openSheet(index){const chapter=chapters[index];$('sheetChapter').textContent=`CHAPITRE ${String(index+1).padStart(2,'0')} / ${chapters.length} · FICHE DE PRÉPARATION`;$('sheetTitle').textContent=chapter.title;const body=$('bomRows');body.replaceChildren();
 chapter.items.forEach(([code,name,qty])=>{const row=document.createElement('tr');const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=state.checked.has(`${chapter.id}:${code}`);checkbox.setAttribute('aria-label',`Vérifier ${name}`);checkbox.addEventListener('change',()=>{const key=`${chapter.id}:${code}`;if(checkbox.checked)state.checked.add(key);else state.checked.delete(key);updateSheet(index)});const cell=document.createElement('td');cell.append(checkbox);row.append(cell);for(const value of [code,name,qty]){const td=document.createElement('td');td.textContent=String(value);row.append(td)}body.append(row)});
 $('startChapter').onclick=()=>{state.index=firstStepOfChapter(index);$('sheet').hidden=true;renderStep()};$('sheet').hidden=false;updateSheet(index);$('closeSheet').focus();}
function updateSheet(index){const chapter=chapters[index];const count=chapter.items.filter(([code])=>state.checked.has(`${chapter.id}:${code}`)).length;$('sheetStatus').textContent=`${count} / ${chapter.items.length} références vérifiées`;$('sheetProgress').style.width=`${count/chapter.items.length*100}%`;$('startChapter').disabled=count!==chapter.items.length;}
$('prev').addEventListener('click',()=>navigate(-1));$('next').addEventListener('click',()=>navigate(1));$('openSheet').addEventListener('click',()=>openSheet(sequence[state.index].chapterIndex));$('closeSheet').addEventListener('click',()=>$('sheet').hidden=true);$('sheet').addEventListener('click',event=>{if(event.target===$('sheet'))$('sheet').hidden=true});document.addEventListener('keydown',event=>{if(event.key==='Escape')$('sheet').hidden=true});
renderStep();openSheet(0);
// L'interface et les procédures restent utilisables si le CDN 3D est inaccessible.
try{const {AssemblyViewer}=await import('./viewer.js');state.viewer=new AssemblyViewer($('scene'));state.viewer.setFocus(sequence[state.index].focus);
 $('reset').onclick=()=>state.viewer.reset();$('explode').onclick=()=>{$('explode').setAttribute('aria-pressed',String(state.viewer.toggleExplode()))};$('highlight').onclick=()=>{$('highlight').setAttribute('aria-pressed',String(state.viewer.toggleHighlight()))};$('zoomIn').onclick=()=>state.viewer.zoom(.83);$('zoomOut').onclick=()=>state.viewer.zoom(1.2);
}catch(error){console.error('Échec du chargement 3D',error);$('sceneError').hidden=false;document.querySelectorAll('.viewer-tools button').forEach(button=>button.disabled=true)}
