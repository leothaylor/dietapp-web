/* Nutri • diário pessoal • armazenamento 100% local. */
import {setupExtras,refreshExtras,renderExtras,extraSnapshot,validateExtraBackup,extraBackupWrites,readPortions,markBackup} from './extras.js';
const $ = (q,root=document) => root.querySelector(q);
const $$ = (q,root=document) => [...root.querySelectorAll(q)];
const DB_NAME = 'nutri-diario-v1';
const DB_VERSION = 2;
let appReady=false;
const DEFAULT_MEALS = [['cafe','Café da manhã'],['almoco','Almoço'],['lanche','Lanches'],['jantar','Jantar']].map(([id,label])=>({id,label}));
const MAX_MEAL_SLOTS = 20;
function getMeals(){return state.meals.map(m=>[m.id,m.label])}
function isMeal(id){return state.meals.some(m=>m.id===id)}
const KEYS = ['kcal','protein','carbs','fat','fiber','sodium','calcium','iron','potassium','magnesium','zinc','phosphorus','manganese','copper','vitaminC','vitaminB1','vitaminB2','vitaminB3','vitaminB6','vitaminA','cholesterol'];
const MACROS = [['protein','Proteínas','blue','g'],['carbs','Carboidratos','gold','g'],['fat','Gorduras','red','g']];
const MICRO = [
  ['fiber','Fibras','g'],['sodium','Sódio','mg'],['calcium','Cálcio','mg'],['iron','Ferro','mg'],
  ['potassium','Potássio','mg'],['magnesium','Magnésio','mg'],['zinc','Zinco','mg'],
  ['phosphorus','Fósforo','mg'],['manganese','Manganês','mg'],['copper','Cobre','mg'],
  ['vitaminC','Vitamina C','mg'],['vitaminB1','Vitamina B1','mg'],['vitaminB2','Vitamina B2','mg'],
  ['vitaminB3','Vitamina B3','mg'],['vitaminB6','Vitamina B6','mg'],['vitaminA','Vitamina A (RAE)','µg'],
  ['cholesterol','Colesterol','mg']
];
const DEFAULT_GOALS = {id:'goals',kcal:2000,protein:100,carbs:250,fat:65};
let db;
const state={view:'diario',date:localDay(new Date()),foods:[],recipes:[],entries:[],goals:{...DEFAULT_GOALS},meals:DEFAULT_MEALS.map(m=>({...m})),tacoIndex:null,search:'',recipeLines:[],scannerControls:null,stream:null,scanTimer:null};
function localDay(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function uid(){return typeof crypto.randomUUID==='function'?crypto.randomUUID():('n'+Date.now()+Math.random().toString(36).slice(2))}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null}
function pos(v){const n=num(v);return n!==null&&n>=0?n:null}
function fmt(v,d=1){return v===null||v===undefined||!Number.isFinite(Number(v))?'—':Number(v).toLocaleString('pt-BR',{maximumFractionDigits:d})}
function amount(v){return fmt(v,0)}
function safeNumber(value){return value===null||value===undefined||value===''?null:pos(value)}
function blankNutrients(){return Object.fromEntries(KEYS.map(k=>[k,null]))}
function normalized(raw){const n=blankNutrients();for(const k of KEYS){if(Object.prototype.hasOwnProperty.call(raw||{},k))n[k]=safeNumber(raw[k])}return n}
function calcTotal(items,key){let value=0,known=0;for(const item of items){const x=item.nutrients?.[key];if(typeof x==='number'&&Number.isFinite(x)){known++;value+=x}}return {value,known,total:items.length,complete:known===items.length}}
function scale(src,grams){const factor=grams/100;const out=blankNutrients();for(const k of KEYS){out[k]=typeof src?.[k]==='number'?Math.round(src[k]*factor*100000)/100000:null}return out}
function request(store,method,arg){return new Promise((resolve,reject)=>{if(!db){reject(new Error('Banco de dados ainda não está pronto. Feche outras abas do Nutri e atualize esta página, sem limpar os dados.'));return}const t=db.transaction(store,method==='getAll'||method==='get'?'readonly':'readwrite');const object=t.objectStore(store);let result;let req;if(method==='getAll')req=object.getAll();else if(method==='get')req=object.get(arg);else if(method==='put')req=object.put(arg);else if(method==='delete')req=object.delete(arg);else req=object.clear();req.onsuccess=()=>{result=req.result};t.oncomplete=()=>resolve(result);t.onerror=()=>reject(t.error||new Error('Falha no armazenamento local'));t.onabort=()=>reject(t.error||new Error('Operação interrompida'))})}
function setStorageStatus(mode,message=''){
 const panel=$('#storage-warning'),title=$('#storage-warning-title'),body=$('#storage-warning-text'),reload=$('#storage-reload');
 if(!panel)return;
 const states={
  loading:['Preparando seus dados','O Nutri está abrindo o banco de dados local. Não registre informações até concluir.'],
  blocked:['Atualização bloqueada por outra aba','Feche todas as outras abas do Nutri (inclusive versões antigas ou instaladas como app) e volte a esta aba. O banco será liberado automaticamente. NÃO limpe os dados do navegador.'],
  stale:['Esta aba precisa ser atualizada','Outra aba atualizou a estrutura do banco local. Feche as outras abas e atualize esta página, sem apagar dados.'],
  error:['Falha na abertura do banco','Não foi possível acessar o banco local. Feche as outras abas do Nutri e recarregue esta página. Não limpe o armazenamento.'],
  ready:['','']
 };
 const [heading,detail]=states[mode]||states.error;
 panel.hidden=mode==='ready';panel.dataset.status=mode;title.textContent=heading;body.textContent=message||detail;
 if(reload)reload.hidden=mode==='loading';
}
function openDb(){return new Promise((resolve,reject)=>{
 let req;
 try{req=indexedDB.open(DB_NAME,DB_VERSION)}catch(err){reject(err);return}
 req.onblocked=()=>setStorageStatus('blocked');
 req.onupgradeneeded=()=>{const database=req.result;
  for(const store of ['foods','recipes','entries','settings','cache','body','water','favorites','awards']){
   if(!database.objectStoreNames.contains(store))database.createObjectStore(store,{keyPath:'id'});
  }
 };
 req.onsuccess=()=>{
  const connection=req.result;
  connection.onversionchange=()=>{
   connection.close();
   if(db===connection){db=undefined;appReady=false}
   setStorageStatus('stale');
  };
  resolve(connection);
 };
 req.onerror=()=>reject(req.error||new Error('Falha ao abrir o IndexedDB'));
})}
async function refresh(){[state.foods,state.recipes,state.entries]=await Promise.all(['foods','recipes','entries'].map(s=>request(s,'getAll')));state.goals=(await request('settings','get','goals'))||{...DEFAULT_GOALS};const savedMeals=await request('settings','get','meals');state.meals=validMeals(savedMeals?.items)?savedMeals.items.map(m=>({id:m.id,label:m.label.trim()})):DEFAULT_MEALS.map(m=>({...m}));await refreshExtras({notifyAwards:appReady});render()}
function notify(text,error=false){const el=$('#toast');el.textContent=text;el.className='toast'+(error?' error':'');el.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.hidden=true,4200)}
function closeModal(){stopScanner();$('#modal').hidden=true;$('#modal-body').innerHTML=''}
function modal(title,html){stopScanner();$('#modal-title').textContent=title;$('#modal-body').innerHTML=html;$('#modal').hidden=false;setTimeout(()=>$('#modal-body input:not([type=hidden]),#modal-body select')?.focus(),70)}
function empty(title,description){return '<div class="empty-state"><strong>'+esc(title)+'</strong>'+esc(description)+'</div>'}
function pill(s){return '<span class="pill">'+esc(s)+'</span>'}
function foodLabel(f){return f.name+(f.brand?' · '+f.brand:'')}
function allCatalog(){return [...state.foods.map(f=>({...f,kind:'food'})),...state.recipes.map(r=>({...r,kind:'recipe'}))].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'))}
function rowNutrients(n){return fmt(n?.kcal,0)+' kcal · P '+fmt(n?.protein)+' g · C '+fmt(n?.carbs)+' g · G '+fmt(n?.fat)+' g'}
function switchView(view){const names={diario:['Meu diário','Registro alimentar e progresso do dia.'],alimentos:['Biblioteca de alimentos','Busque, cadastre e reutilize seus alimentos.'],receitas:['Minhas receitas','Preparações calculadas e prontas para reutilizar.'],relatorios:['Relatórios','Tendências e cobertura nutricional.'],evolucao:['Evolução corporal','Peso, medidas e composição corporal estimada.'],hidratacao:['Hidratação','Água registrada e histórico de consumo.'],medalhas:['Medalhas','130 conquistas automáticas em sete categorias.'],ajustes:['Configurações','Metas, segurança e portabilidade dos dados.']};if(!names[view])return;state.view=view;$('#page-title').textContent=names[view][0];$('#page-subtitle').textContent=names[view][1];$$('.view').forEach(n=>n.classList.toggle('active',n.id==='view-'+view));$$('[data-view]').forEach(n=>n.classList.toggle('active',n.dataset.view===view));if(location.hash!=='#'+view)history.replaceState(null,'','#'+view);render();window.scrollTo({top:0,behavior:'instant'})}
function render(){if(state.view==='diario')renderDiary();if(state.view==='alimentos')renderFoods();if(state.view==='receitas')renderRecipes();if(state.view==='relatorios')renderReports();if(state.view==='ajustes')renderSettings();renderExtras(state.view)}
function renderDiary(){
  $('#selected-date').value=state.date;
  const today=state.entries.filter(e=>e.date===state.date);
  const energy=calcTotal(today,'kcal');
  const kcal=energy.value;
  const goal=state.goals.kcal||0;
  $('#kcal-today').textContent=fmt(kcal,0)+(energy.complete?'':'*');
  $('#kcal-remaining').textContent=fmt(goal-kcal,0);
  $('#kcal-goal-label').textContent='Meta: '+fmt(goal,0)+' kcal'+(energy.complete?'':' · *dados parciais');
  $('#calorie-ring').style.setProperty('--progress',(goal?Math.min(100,Math.max(0,kcal/goal*100)):0)+'%');
  $('#macro-progress').innerHTML=MACROS.map(([k,label,color])=>{const total=calcTotal(today,k),x=total.value,g=state.goals[k]||0;return '<div><div class="macro-head"><strong>'+label+'</strong><small>'+fmt(x)+(total.complete?'':'*')+' / '+fmt(g)+' g</small></div><div class="track"><div class="fill '+color+'" style="width:'+(g?Math.min(100,x/g*100):0)+'%"></div></div></div>'}).join('');
  $('#meals-list').innerHTML=getMeals().map(([key,label])=>{const a=today.filter(e=>e.meal===key);return '<article class="meal-card"><div class="meal-head"><div class="meal-label"><h3>'+esc(label)+'</h3><button class="meal-rename" aria-label="Renomear '+esc(label)+'" title="Renomear refeição" data-rename-meal="'+esc(key)+'">✎</button>'+(DEFAULT_MEALS.some(m=>m.id===key)?'':'<button class="meal-remove" aria-label="Excluir '+esc(label)+'" title="Excluir refeição personalizada" data-remove-meal="'+esc(key)+'">×</button>')+'</div><small>'+fmt(calcTotal(a,'kcal').value,0)+(calcTotal(a,'kcal').complete?'':'*')+' kcal</small></div>'+(!a.length?'<div class="meal-empty">Nenhum alimento registrado nesta refeição.</div>':a.map(e=>'<div class="meal-item"><div><strong>'+esc(e.name)+'</strong><small>'+fmt(e.grams)+' g · '+esc(e.source||'Cadastro pessoal')+'</small></div><div class="right"><b>'+fmt(e.nutrients?.kcal,0)+' kcal</b><button class="delete-button" title="Excluir lançamento" aria-label="Excluir lançamento" data-delete-entry="'+esc(e.id)+'">×</button></div></div>').join(''))+'<button class="meal-add" data-add-meal="'+key+'">+ Adicionar</button></article>'}).join('');
}
function renderFoods(){
  const q=state.search.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const match=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q);
  const local=state.foods.filter(f=>match(foodLabel(f))||match(f.barcode||''));
  let rows=local.slice(0,55).map(f=>'<article class="list-row"><div><strong>'+esc(foodLabel(f))+'</strong> '+pill(f.source==='openfoodfacts'?'Rótulo':f.source==='taco'?'TACO':'Meu cadastro')+'<small>'+rowNutrients(f.nutrients)+' por 100 g'+(f.barcode?' · EAN '+esc(f.barcode):'')+'</small></div><div class="row-actions"><button class="btn btn-primary small" data-add-id="'+esc(f.id)+'">Registrar</button><button class="btn btn-outline small" data-edit-food="'+esc(f.id)+'">Editar</button><button class="icon-button" title="Excluir alimento" data-delete-food="'+esc(f.id)+'">×</button></div></article>').join('');
  if(state.tacoIndex&&q.length>=2){
    const known=new Set(state.foods.filter(f=>f.tacoId!==undefined).map(f=>String(f.tacoId)));
    const remote=state.tacoIndex.filter(f=>match(f.description)&&!known.has(String(f.id))).slice(0,30);
    if(remote.length)rows+='<div class="overline" style="margin:13px 0 3px">RESULTADOS TACO — NEPA/UNICAMP</div>'+remote.map(f=>'<article class="list-row"><div><strong>'+esc(f.description)+'</strong><small>'+esc(f.category||'')+' · composição oficial por 100 g</small></div><div class="row-actions"><button class="btn btn-soft small" data-import-taco="'+esc(f.id)+'">+ Salvar na biblioteca</button></div></article>').join('');
  }
  $('#foods-list').innerHTML=rows||empty('Nenhum alimento encontrado','Cadastre um alimento, busque na TACO ou consulte um código de barras.');
  $('#food-search-status').textContent=state.tacoIndex?('TACO carregada: '+state.tacoIndex.length+' alimentos para pesquisa.'):('Sua biblioteca: '+state.foods.length+' alimentos. Clique em Buscar na TACO para consultar a base brasileira.');
}
function renderRecipes(){const items=[...state.recipes].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));$('#recipes-list').innerHTML=items.length?items.map(r=>'<article class="list-row"><div><strong>'+esc(r.name)+'</strong> '+pill('Receita')+'<small>'+r.ingredients.length+' ingrediente(s) · rendimento '+fmt(r.yieldGrams)+' g · '+rowNutrients(r.nutrients)+' / 100 g</small></div><div class="row-actions"><button class="btn btn-primary small" data-add-id="'+esc(r.id)+'">Registrar</button><button class="btn btn-outline small" data-edit-recipe="'+esc(r.id)+'">Editar</button><button class="icon-button" data-delete-recipe="'+esc(r.id)+'" title="Excluir receita">×</button></div></article>').join(''):empty('Nenhuma receita cadastrada','Monte sua primeira receita selecionando os ingredientes da biblioteca.')}
function renderReports(){
  const dates=Array.from({length:7},(_,i)=>{const d=new Date(state.date+'T12:00:00');d.setDate(d.getDate()-6+i);return localDay(d)});
  const values=dates.map(date=>{const list=state.entries.filter(e=>e.date===date);return {date,hasData:list.length>0,kcal:calcTotal(list,'kcal').value}});
  const max=Math.max(state.goals.kcal,1,...values.map(v=>v.kcal));
  $('#week-bars').innerHTML=values.map(v=>'<div class="day-bar"><strong>'+(v.hasData?fmt(v.kcal,0):'—')+'</strong><div class="bar'+(v.hasData?'':' no-data')+'" style="height:'+Math.max(3,(v.kcal/max)*165)+'px" title="'+esc(v.date)+'"></div><span>'+v.date.slice(8,10)+'/'+v.date.slice(5,7)+'</span></div>').join('');
  const entries=state.entries.filter(e=>e.date===state.date);
  $('#micro-list').innerHTML=entries.length?MICRO.map(([k,name,unit])=>{const t=calcTotal(entries,k);return '<div class="micro-row"><div><b>'+name+'</b><br><small>'+t.known+'/'+t.total+' registros com dados</small></div><b>'+(!t.known?'Não informado':fmt(t.value,2)+' '+unit+(t.complete?'':'*'))+'</b></div>'}).join(''):empty('Sem registros para '+state.date,'Registre alimentos para visualizar os micronutrientes disponíveis.');
}
function renderSettings(){
  const f=$('#goals-form');for(const k of ['kcal','protein','carbs','fat'])f.elements.namedItem(k).value=state.goals[k]??'';
  $('#storage-status').textContent=state.foods.length+' alimentos · '+state.recipes.length+' receitas · '+state.entries.length+' lançamentos registrados localmente.';
}
function foodForm(f=null){
 const n=f?.nutrients||blankNutrients();
 modal(f?'Editar alimento':'Cadastrar alimento','<form id="food-form"><div class="modal-grid"><label class="field"><span>Nome do alimento *</span><input name="name" required maxlength="140" value="'+esc(f?.name||'')+'" placeholder="Ex.: Iogurte natural"></label><label class="field"><span>Marca / fabricante</span><input name="brand" maxlength="100" value="'+esc(f?.brand||'')+'" placeholder="Opcional"></label><label class="field"><span>Código EAN / UPC</span><input name="barcode" inputmode="numeric" maxlength="16" value="'+esc(f?.barcode||'')+'" placeholder="Opcional"></label><label class="field"><span>Calorias por 100 g (kcal)</span><input name="kcal" type="number" min="0" max="1000" step="any" value="'+(n.kcal??'')+'" placeholder="—"></label></div><div class="modal-section-title">Macronutrientes por 100 g</div><div class="modal-grid">'+[['protein','Proteínas (g)'],['carbs','Carboidratos (g)'],['fat','Gorduras (g)']].map(([k,label])=>'<label class="field"><span>'+label+'</span><input type="number" min="0" step="any" name="'+k+'" value="'+(n[k]??'')+'" placeholder="Não informado"></label>').join('')+'</div><div class="modal-section-title">Fibras, minerais e vitaminas (opcional)</div><div class="micro-fields">'+MICRO.map(([k,label,unit])=>'<label class="field"><span>'+label+' ('+unit+')</span><input name="'+k+'" min="0" step="any" type="number" value="'+(n[k]??'')+'" placeholder="—"></label>').join('')+'</div><div class="modal-section-title">Medidas caseiras e porções</div><label class="field"><span>Uma por linha: nome = gramas</span><textarea name="portions" rows="3" placeholder="1 fatia = 25\n1 unidade = 50">'+esc((f?.portions||[]).map(p=>p.name+' = '+p.grams).join('\n'))+'</textarea></label><p class="help-line">Deixe vazio o que o rótulo não informa. Campo vazio não é zero. Base de cálculo: 100 g.</p><div class="form-actions"><button type="button" class="btn btn-outline" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">Salvar alimento</button></div></form>');
 $('#food-form').dataset.editId=f?.id||'';
}
function addForm(meal='almoco',initialId=''){
 const catalog=allCatalog();
 if(!catalog.length){switchView('alimentos');notify('Cadastre ou importe um alimento antes de registrar.');return}
 modal('Registrar no diário','<form id="entry-form"><div class="modal-grid"><label class="field"><span>Alimento ou receita</span><select name="foodId" required>'+catalog.map(f=>'<option value="'+esc(f.id)+'"'+(f.id===initialId?' selected':'')+'>'+esc(foodLabel(f))+'</option>').join('')+'</select></label><label class="field"><span>Unidade / porção</span><select name="portion"><option value="grams">Quantidade livre em gramas</option></select></label><label class="field"><span>Quantidade consumida (g)</span><input name="grams" type="number" min="0.1" max="100000" step="any" value="100" required></label><label class="field"><span>Refeição</span><select name="meal">'+getMeals().map(([key,label])=>'<option value="'+key+'"'+(meal===key?' selected':'')+'>'+label+'</option>').join('')+'</select></label><label class="field"><span>Data</span><input name="date" type="date" required value="'+esc(state.date)+'"></label></div><div id="entry-preview" class="recipe-preview"></div><div class="form-actions"><button type="button" class="btn btn-outline" data-close-modal>Cancelar</button><button type="submit" class="btn btn-primary">Salvar registro</button></div></form>');
 const entryForm=$('#entry-form');
 function resetPortions(){
   const food=allCatalog().find(x=>x.id===entryForm.elements.foodId.value);
   const portions=[...(food?.portions||[])];
   if(food?.kind==='recipe'&&Number(food.servings)>0)portions.unshift({name:'1 porção da receita',grams:food.yieldGrams/food.servings});
   entryForm.elements.portion.innerHTML='<option value="grams">Quantidade livre em gramas</option>'+portions.map((p,i)=>'<option value="'+i+'">'+esc(p.name)+' ('+fmt(p.grams)+' g)</option>').join('');
   entryForm.dataset.portions=JSON.stringify(portions);
 }
 resetPortions();
 entryForm.addEventListener('change',event=>{
   if(event.target.name==='foodId')resetPortions();
   if(event.target.name==='portion'&&entryForm.elements.portion.value!=='grams'){
     const chosen=JSON.parse(entryForm.dataset.portions||'[]')[Number(entryForm.elements.portion.value)];
     if(chosen)entryForm.elements.grams.value=chosen.grams;
   }
   updateEntryPreview();
 });
 entryForm.elements.grams.addEventListener('input',()=>{entryForm.elements.portion.value='grams';updateEntryPreview()});
 updateEntryPreview();
}
function updateEntryPreview(){const f=$('#entry-form');if(!f)return;const food=allCatalog().find(x=>x.id===f.elements.foodId.value);const grams=pos(f.elements.grams.value);$('#entry-preview').textContent=food&&grams!==null?'Porção: '+rowNutrients(scale(food.nutrients,grams)):'Defina uma porção válida.'}
function calcRecipe(ingredients,yieldGrams){
 const result=blankNutrients();
 for(const k of KEYS){let total=0,complete=true;for(const i of ingredients){if(typeof i.nutrients[k]!=='number'){complete=false;break}total+=i.nutrients[k]*i.grams/100}result[k]=complete?Math.round(total/yieldGrams*10000000)/100000:null}
 return result
}
function recipeLine(line={foodId:'',grams:100}){
 const foods=state.foods;return '<div class="recipe-line"><label class="field"><span>Alimento</span><select class="ingredient-food">'+foods.map(f=>'<option value="'+esc(f.id)+'"'+(f.id===line.foodId?' selected':'')+'>'+esc(foodLabel(f))+'</option>').join('')+'</select></label><label class="field"><span>Gramas</span><input class="ingredient-grams" type="number" min="0.1" max="100000" step="any" value="'+(line.grams||100)+'" required></label><button class="icon-button" title="Remover ingrediente" type="button" data-remove-line>×</button></div>'
}
function recipeForm(recipe=null){
 if(!state.foods.length){switchView('alimentos');notify('Cadastre um alimento antes de montar receitas.');return}
 const lines=recipe?.ingredients?.map(i=>({foodId:i.foodId,grams:i.grams}))||[{foodId:state.foods[0].id,grams:100}];
 modal(recipe?'Editar receita':'Criar receita','<form id="recipe-form"><div class="modal-grid"><label class="field"><span>Nome da receita *</span><input name="name" maxlength="140" required value="'+esc(recipe?.name||'')+'" placeholder="Ex.: Panqueca de aveia"></label><label class="field"><span>Rendimento final (g) *</span><input name="yieldGrams" type="number" min="0.1" max="1000000" step="any" required value="'+(recipe?.yieldGrams||'')+'" placeholder="Peso pronto"></label></div><label class="field"><span>Número de porções da receita</span><input name="servings" type="number" min="1" max="1000" step="1" value="'+(recipe?.servings||1)+'" required></label><div class="modal-section-title">Ingredientes</div><div id="recipe-lines">'+lines.map(recipeLine).join('')+'</div><button class="btn btn-outline small" type="button" id="add-ingredient">+ Ingrediente</button><p class="help-line">Pesos dos ingredientes antes do preparo. Informe o peso total final da receita, inclusive após a perda de água no cozimento. Retenções de micronutrientes não são estimadas.</p><div class="form-actions"><button type="button" class="btn btn-outline" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">Salvar receita</button></div></form>');
 $('#recipe-form').dataset.editId=recipe?.id||''
}
function parseFields(f){const n=blankNutrients();for(const k of KEYS)n[k]=safeNumber(f.elements.namedItem(k)?.value);return n}
function validateGrams(v){return typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=100000}
async function onFormSubmit(e){
 e.preventDefault();if(!appReady){notify('O banco ainda está sendo preparado. Feche outras abas do Nutri e aguarde a liberação.',true);return}const f=e.target;
 try{
 if(f.id==='meal-form'){const label=f.elements.label.value.trim();const id=f.dataset.mealId;if(!label||label.length>48)throw Error('Use um nome de 1 a 48 caracteres.');if(id){const items=state.meals.map(m=>m.id===id?{...m,label}:m);await saveMeals(items)}else{const items=[...state.meals,{id:'meal_'+uid().replace(/[^a-zA-Z0-9_-]/g,'').slice(0,60),label}];await saveMeals(items)}closeModal();notify(id?'Refeição renomeada.':'Nova refeição adicionada.');return}
 if(f.id==='food-form'){const name=f.elements.name.value.trim();if(!name)throw Error('Informe o nome do alimento.');const id=f.dataset.editId||uid();const old=state.foods.find(x=>x.id===id);const food={id,name,brand:f.elements.brand.value.trim(),barcode:f.elements.barcode.value.trim(),source:old?.source||'manual',sourceUrl:old?.sourceUrl||'',tacoId:old?.tacoId,nutrients:parseFields(f),portions:readPortions(f.elements.portions.value),updatedAt:new Date().toISOString()};await request('foods','put',food);closeModal();await refresh();notify('Alimento salvo com sucesso.');}
 if(f.id==='entry-form'){const food=allCatalog().find(x=>x.id===f.elements.foodId.value),grams=pos(f.elements.grams.value),date=f.elements.date.value,meal=f.elements.meal.value;if(!food||!validateGrams(grams)||!validDate(date)||!isMeal(meal))throw Error('Revise alimento, data, refeição e quantidade.');const entry={id:uid(),date,meal,foodId:food.id,name:foodLabel(food),grams,source:food.kind==='recipe'?'Receita':food.source,nutrients:scale(food.nutrients,grams),createdAt:new Date().toISOString()};await request('entries','put',entry);state.date=date;closeModal();switchView('diario');await refresh();notify('Refeição registrada.');}
 if(f.id==='recipe-form'){const name=f.elements.name.value.trim(),yieldGrams=pos(f.elements.yieldGrams.value);if(!name||!validateGrams(yieldGrams))throw Error('Informe o nome e o rendimento final válido.');const ingredients=$$('.recipe-line',f).map(line=>{const food=state.foods.find(x=>x.id===$('.ingredient-food',line)?.value);const grams=pos($('.ingredient-grams',line)?.value);if(!food||!validateGrams(grams))throw Error('Revise o alimento e peso de cada ingrediente.');return {foodId:food.id,name:foodLabel(food),grams,nutrients:normalized(food.nutrients)}});if(!ingredients.length)throw Error('Adicione ao menos um ingrediente.');const servings=Number(f.elements.servings.value);if(!Number.isInteger(servings)||servings<1||servings>1000)throw Error('Número de porções inválido.');const recipe={id:f.dataset.editId||uid(),name,kind:'recipe',yieldGrams,servings,ingredients,nutrients:calcRecipe(ingredients,yieldGrams),updatedAt:new Date().toISOString()};await request('recipes','put',recipe);closeModal();await refresh();notify('Receita salva.');}
 if(f.id==='goals-form'){const g={id:'goals'};for(const k of ['kcal','protein','carbs','fat']){g[k]=pos(f.elements.namedItem(k).value);if(g[k]===null||g[k]>20000)throw Error('Revise as metas informadas.')}await request('settings','put',g);await refresh();notify('Metas salvas.');}
 }catch(err){notify(err.message||'Não foi possível salvar.',true)}
}
function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00');return !Number.isNaN(d.getTime())&&localDay(d)===s}
async function loadTaco(){
 $('#food-search-status').textContent='Carregando índice nutricional TACO...';
 try{const cache=await request('cache','get','taco-index');if(cache?.foods?.length){state.tacoIndex=cache.foods;renderFoods();return}
 const resp=await fetch('https://brolesi.github.io/taco/foods.json',{headers:{Accept:'application/json'}});if(!resp.ok)throw Error('HTTP '+resp.status);const data=await resp.json();const foods=Array.isArray(data)?data:data.foods;if(!Array.isArray(foods)||foods.length<500)throw Error('Formato inesperado do catálogo TACO');state.tacoIndex=foods;await request('cache','put',{id:'taco-index',foods,updatedAt:new Date().toISOString()});renderFoods();notify('TACO carregada: '+foods.length+' alimentos.');}
 catch(err){$('#food-search-status').textContent='Não foi possível carregar a TACO. Verifique sua conexão ou tente mais tarde.';notify('Erro ao consultar TACO: '+err.message,true)}
}
function tacoToFood(d){return {id:uid(),name:d.description||'Alimento TACO',brand:'',barcode:'',source:'taco',tacoId:d.id,sourceUrl:'https://brolesi.github.io/taco/foods/'+d.id+'.json',nutrients:normalized({kcal:d.energy_kcal,protein:d.protein_g,carbs:d.carbohydrate_g,fat:d.lipids_g,fiber:d.dietary_fiber_g,sodium:d.sodium_mg,calcium:d.calcium_mg,iron:d.iron_mg,potassium:d.potassium_mg,magnesium:d.magnesium_mg,zinc:d.zinc_mg,phosphorus:d.phosphorus_mg,manganese:d.manganese_mg,copper:d.copper_mg,vitaminC:d.vitamin_c_mg,vitaminB1:d.thiamine_mg,vitaminB2:d.riboflavin_mg,vitaminB3:d.niacin_mg,vitaminB6:d.pyridoxine_mg,vitaminA:d.rae_mcg,cholesterol:d.cholesterol_mg}),updatedAt:new Date().toISOString()}}
async function importTaco(id){try{notify('Consultando composição nutricional...');const resp=await fetch('https://brolesi.github.io/taco/foods/'+encodeURIComponent(id)+'.json');if(!resp.ok)throw Error('HTTP '+resp.status);const data=await resp.json();if(!data.description||data.id===undefined)throw Error('Dados incompletos');if(state.foods.some(f=>String(f.tacoId)===String(data.id))){notify('Alimento já cadastrado.');return}await request('foods','put',tacoToFood(data));await refresh();notify('Alimento da TACO salvo.')}catch(err){notify('Falha ao importar TACO: '+err.message,true)}}
function offValue(n,key,factor=1){return safeNumber(n?.[key])===null?null:safeNumber(n[key])*factor}
function offToFood(p,code){const n=p.nutriments||{};const kcal=offValue(n,'energy-kcal_100g')??(offValue(n,'energy_100g')===null?null:offValue(n,'energy_100g')/4.184);return {id:uid(),name:(p.product_name||p.product_name_pt||'Produto sem nome').trim(),brand:(p.brands||'').slice(0,100),barcode:code,source:'openfoodfacts',sourceUrl:'https://world.openfoodfacts.org/product/'+code,nutrients:normalized({kcal,protein:offValue(n,'proteins_100g'),carbs:offValue(n,'carbohydrates_100g'),fat:offValue(n,'fat_100g'),fiber:offValue(n,'fiber_100g'),sodium:offValue(n,'sodium_100g',1000),calcium:offValue(n,'calcium_100g',1000),iron:offValue(n,'iron_100g',1000),potassium:offValue(n,'potassium_100g',1000),magnesium:offValue(n,'magnesium_100g',1000),zinc:offValue(n,'zinc_100g',1000),vitaminC:offValue(n,'vitamin-c_100g',1000),vitaminB1:offValue(n,'vitamin-b1_100g',1000),vitaminB2:offValue(n,'vitamin-b2_100g',1000),vitaminB3:offValue(n,'vitamin-pp_100g',1000),vitaminB6:offValue(n,'vitamin-b6_100g',1000),vitaminA:offValue(n,'vitamin-a_100g',1000000),cholesterol:offValue(n,'cholesterol_100g',1000)}),updatedAt:new Date().toISOString()}}
function barcodeModal(){modal('Consultar código de barras','<p class="muted">Use um EAN/UPC da embalagem. Se o produto estiver no Open Food Facts, os valores disponíveis serão importados para a sua biblioteca.</p><form id="barcode-form"><label class="field"><span>Código de barras</span><input name="barcode" required pattern="[0-9]{8,14}" inputmode="numeric" placeholder="Ex.: 789..." maxlength="14" autocomplete="off" /></label><div class="form-actions"><button class="btn btn-soft" type="button" id="camera-start">Abrir câmera</button><button class="btn btn-primary" type="submit">Consultar produto</button></div></form><div id="camera-region" hidden><video id="camera-video" class="scan-frame" autoplay playsinline muted></video><p class="help-line">Aponte para o código EAN/UPC. Se a câmera não funcionar, digite o código acima.</p></div><div id="barcode-result" class="help-line"></div>')}
function barcodeFromInput(raw){const text=String(raw).trim();if(/^\d{8,14}$/.test(text))return text;const m=text.match(/(?:\/product\/|\/)(\d{8,14})(?:[\/?#]|$)/);return m?.[1]||''}
async function queryBarcode(raw){const code=barcodeFromInput(raw);if(!/^\d{8,14}$/.test(code)){notify('Digite um EAN ou UPC válido de 8 a 14 dígitos.',true);return}const existing=state.foods.find(x=>x.barcode===code);if(existing){closeModal();notify('Produto encontrado na sua biblioteca.');addForm('almoco',existing.id);return}
 const status=$('#barcode-result');if(status)status.textContent='Consultando Open Food Facts...';
 try{const url='https://world.openfoodfacts.org/api/v2/product/'+encodeURIComponent(code)+'.json?fields=code,product_name,product_name_pt,brands,nutriments';const resp=await fetch(url,{headers:{Accept:'application/json'}});if(!resp.ok)throw Error('HTTP '+resp.status);const data=await resp.json();if(data.status!==1||!data.product)throw Error('Produto não encontrado na base.');const food=offToFood(data.product,code);if(!food.nutrients.kcal&&food.nutrients.kcal!==0)notify('O produto não informa calorias. Confira o rótulo.');await request('foods','put',food);closeModal();await refresh();notify('Produto importado: confira os nutrientes no cadastro.');foodForm(food)}
 catch(err){if(status)status.textContent='Consulta indisponível ou código não encontrado: '+err.message+'. Você pode cadastrar manualmente.';notify('Não foi possível consultar o produto.',true)}
}
function stopScanner(){if(state.scanTimer){clearInterval(state.scanTimer);state.scanTimer=null}try{state.scannerControls?.stop?.()}catch{}state.scannerControls=null;if(state.stream){state.stream.getTracks().forEach(t=>t.stop());state.stream=null}}
async function startScanner(){
 const region=$('#camera-region');if(!region)return;region.hidden=false;
 const video=$('#camera-video');$('#barcode-result').textContent='Iniciando câmera...';
 try{
 if(!navigator.mediaDevices?.getUserMedia)throw Error('Câmera indisponível no navegador.');
 if('BarcodeDetector' in window){state.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});video.srcObject=state.stream;await video.play();const supported=typeof BarcodeDetector.getSupportedFormats==='function'?await BarcodeDetector.getSupportedFormats():null;const formats=['ean_13','ean_8','upc_a','upc_e','qr_code'].filter(x=>!supported||supported.includes(x));const detector=new BarcodeDetector({formats});let busy=false;state.scanTimer=setInterval(async()=>{if(busy||video.readyState<2)return;busy=true;try{const found=await detector.detect(video);if(found.length&&found[0].rawValue){const code=found[0].rawValue;stopScanner();$('#barcode-form input[name=barcode]').value=code;queryBarcode(code)}}catch{}finally{busy=false}},650);$('#barcode-result').textContent='Câmera ativa. Aponte para o código.'}
 else{const mod=await import('https://esm.sh/@zxing/browser@0.1.5');const reader=new mod.BrowserMultiFormatReader();state.scannerControls=await reader.decodeFromConstraints({video:{facingMode:'environment'}},video,(result)=>{if(result?.getText()){const code=result.getText();stopScanner();if($('#barcode-form')){$('#barcode-form input[name=barcode]').value=code;queryBarcode(code)}}});$('#barcode-result').textContent='Câmera ativa (ZXing). Aponte para o código.'}
 }catch(err){stopScanner();region.hidden=true;$('#barcode-result').textContent='Não foi possível acessar a câmera. Use a digitação do EAN/UPC. '+(err.message||'')}
}
async function exportJson(){
 try{await markBackup();const payload={schema:'nutri-backup',version:2,exportedAt:new Date().toISOString(),foods:state.foods,recipes:state.recipes,entries:state.entries,settings:[state.goals,{id:'meals',items:state.meals}],extra:extraSnapshot()};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='nutri-backup-'+localDay(new Date())+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);notify('Backup exportado. Guarde o arquivo fora do navegador.')}
 catch(err){notify('Falha na exportação: '+err.message,true)}
}
function validMeals(items){return Array.isArray(items)&&items.length>=DEFAULT_MEALS.length&&items.length<=MAX_MEAL_SLOTS&&items.every(m=>m&&typeof m.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(m.id)&&typeof m.label==='string'&&m.label.trim().length>0&&m.label.trim().length<=48)&&new Set(items.map(m=>m.id)).size===items.length&&DEFAULT_MEALS.every(d=>items.some(m=>m.id===d.id))}
async function saveMeals(items){if(!validMeals(items))throw Error('Lista de refeições inválida.');await request('settings','put',{id:'meals',items});state.meals=items.map(m=>({...m}));render()}
function mealForm(id=null){const item=id?state.meals.find(x=>x.id===id):null;if(id&&!item)return;if(!item&&state.meals.length>=MAX_MEAL_SLOTS){notify('Limite de '+MAX_MEAL_SLOTS+' refeições atingido.',true);return}const label=item?.label||'Refeição '+(state.meals.length+1);modal(item?'Renomear refeição':'Adicionar refeição','<form id="meal-form"><label class="field"><span>Nome da refeição</span><input name="label" maxlength="48" required placeholder="Ex.: Lanche da tarde, Refeição 5" value="'+esc(label)+'"></label><p class="help-line">O nome escolhido aparecerá em todos os dias e no seletor de refeições. Seus lançamentos existentes serão preservados.</p><div class="form-actions"><button class="btn btn-outline" type="button" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">'+(item?'Salvar nome':'Criar refeição')+'</button></div></form>');$('#meal-form').dataset.mealId=id||''}
function validNutrition(n){return n&&typeof n==='object'&&KEYS.every(k=>n[k]===null||n[k]===undefined||(typeof n[k]==='number'&&Number.isFinite(n[k])&&n[k]>=0&&n[k]<100000000))}
function validCollection(arr,type,allowedMeals=new Set(getMeals().map(m=>m[0]))){if(!Array.isArray(arr)||arr.length>100000)return false;return arr.every(x=>{if(!x||typeof x.id!=='string'||x.id.length>120)return false;if(type==='foods')return typeof x.name==='string'&&x.name.length<=200&&validNutrition(x.nutrients);if(type==='recipes')return typeof x.name==='string'&&validNutrition(x.nutrients)&&validateGrams(x.yieldGrams)&&Array.isArray(x.ingredients)&&x.ingredients.length<1000&&x.ingredients.every(i=>typeof i.foodId==='string'&&validateGrams(i.grams)&&validNutrition(i.nutrients));if(type==='entries')return typeof x.name==='string'&&validDate(x.date)&&allowedMeals.has(x.meal)&&validateGrams(x.grams)&&validNutrition(x.nutrients);return false})}
async function importJson(file){
 if(!file)return;
 if(file.size>12*1024*1024){notify('Arquivo muito grande. Máximo 12 MB.',true);return}
 try{const data=JSON.parse(await file.text());if(data.schema!=='nutri-backup'||![1,2].includes(data.version)||!Array.isArray(data.settings)||data.settings.length<1||data.settings.length>2)throw Error('Formato de backup incompatível ou inválido.');const advanced=validateExtraBackup(data);const g=data.settings.find(x=>x?.id==='goals');if(!g||data.settings.filter(x=>x?.id==='goals').length!==1)throw Error('Metas ausentes ou repetidas.');const mealsRecord=data.settings.find(x=>x?.id==='meals');if(data.settings.some(x=>!x||!['goals','meals'].includes(x.id))||data.settings.filter(x=>x?.id==='meals').length>1)throw Error('Configurações desconhecidas no backup.');if(mealsRecord&&!validMeals(mealsRecord.items))throw Error('Refeições do backup inválidas.');const backupMeals=mealsRecord?.items||DEFAULT_MEALS;const allowedMeals=new Set(backupMeals.map(m=>m.id));if(!validCollection(data.foods,'foods')||!validCollection(data.recipes,'recipes')||!validCollection(data.entries,'entries',allowedMeals))throw Error('Dados de alimentos, receitas ou lançamentos inválidos.');data.settings=[g,{id:'meals',items:backupMeals},advanced.prefs];const ids=new Set();for(const collection of [data.foods,data.recipes,data.entries])for(const item of collection){if(ids.has(item.id))throw Error('Backup contém IDs duplicados.');ids.add(item.id)}for(const k of ['kcal','protein','carbs','fat'])if(pos(g[k])===null||pos(g[k])>20000)throw Error('Metas inválidas.');
 if(!confirm('Isso substituirá seus dados locais: '+data.foods.length+' alimentos, '+data.recipes.length+' receitas e '+data.entries.length+' registros. Você já exportou um backup dos dados atuais?'))return;
 await new Promise((resolve,reject)=>{const stores=['foods','recipes','entries','settings','body','water','favorites','awards'];const t=db.transaction(stores,'readwrite');for(const s of stores)t.objectStore(s).clear();const extraRows=extraBackupWrites(advanced).filter(([s])=>s!=='settings');for(const [store,rows] of [['foods',data.foods],['recipes',data.recipes],['entries',data.entries],['settings',data.settings],...extraRows])for(const item of rows)t.objectStore(store).put(item);t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error)});
 await refresh();notify('Backup restaurado com sucesso.');
 }catch(err){notify('Não foi possível restaurar: '+err.message,true)}finally{$('#import-json').value=''}
}
function updateNetwork(){const online=navigator.onLine;$('#network-status').textContent=online?'● Online':'○ Offline';$('#network-status').style.color=online?'#a6e9d5':'#edbe83'}
function adjustDate(delta){const d=new Date(state.date+'T12:00:00');d.setDate(d.getDate()+delta);state.date=localDay(d);render()}
async function onClick(e){
 if(e.target.closest('[data-close-modal]')){closeModal();return}
 const nav=e.target.closest('[data-view]');if(nav){switchView(nav.dataset.view);return}
 const button=e.target.closest('button');if(!button)return;
 if(button.id==='storage-reload'){location.reload();return}
 if(!appReady){notify('Banco local indisponível. Feche as outras abas do Nutri; não apague os dados do site.',true);return}
 try{
 if(button.id==='prev-date')adjustDate(-1);
 else if(button.id==='next-date')adjustDate(1);
 else if(button.id==='top-backup'||button.id==='export-json')exportJson();
 else if(button.id==='quick-add')addForm();
 else if(button.id==='add-meal-slot')mealForm();
 else if(button.dataset.renameMeal)mealForm(button.dataset.renameMeal);
 else if(button.dataset.removeMeal){const id=button.dataset.removeMeal;const item=state.meals.find(m=>m.id===id);if(!item||DEFAULT_MEALS.some(m=>m.id===id))return;if(state.entries.some(e=>e.meal===id)){notify('Não é possível excluir esta refeição: existem registros no histórico. Renomeie-a ou apague os registros primeiro.',true);return}if(confirm('Remover o espaço "'+item.label+'" de todos os dias?')){await saveMeals(state.meals.filter(m=>m.id!==id));notify('Refeição removida.')}}
 else if(button.dataset.addMeal)addForm(button.dataset.addMeal);
 else if(button.dataset.addId)addForm('almoco',button.dataset.addId);
 else if(button.id==='food-create')foodForm();
 else if(button.dataset.editFood)foodForm(state.foods.find(x=>x.id===button.dataset.editFood));
 else if(button.dataset.deleteFood){const f=state.foods.find(x=>x.id===button.dataset.deleteFood);if(f&&confirm('Excluir '+f.name+' da biblioteca? Lançamentos anteriores permanecem preservados.')){await request('foods','delete',f.id);await refresh();notify('Alimento excluído.')}} 
 else if(button.dataset.deleteEntry){if(confirm('Excluir este lançamento do diário?')){await request('entries','delete',button.dataset.deleteEntry);await refresh();notify('Registro excluído.')}} 
 else if(button.id==='taco-load')loadTaco();
 else if(button.dataset.importTaco)importTaco(button.dataset.importTaco);
 else if(button.id==='barcode-open'||button.id==='barcode-manual')barcodeModal();
 else if(button.id==='camera-start')startScanner();
 else if(button.id==='recipe-create')recipeForm();
 else if(button.dataset.editRecipe)recipeForm(state.recipes.find(x=>x.id===button.dataset.editRecipe));
 else if(button.dataset.deleteRecipe){const r=state.recipes.find(x=>x.id===button.dataset.deleteRecipe);if(r&&confirm('Excluir receita '+r.name+'? Os registros antigos serão mantidos.')){await request('recipes','delete',r.id);await refresh();notify('Receita excluída.')}} 
 else if(button.id==='add-ingredient'){$('#recipe-lines').insertAdjacentHTML('beforeend',recipeLine({foodId:state.foods[0].id,grams:100}));}
 else if(button.hasAttribute('data-remove-line')){const lines=$$('.recipe-line');if(lines.length>1)button.closest('.recipe-line').remove();else notify('A receita precisa de um ingrediente.',true)}
 }catch(err){notify(err.message||'Operação não concluída.',true)}
}
document.addEventListener('click',onClick);
document.addEventListener('submit',e=>{if(e.target.id==='barcode-form'){e.preventDefault();queryBarcode(e.target.elements.barcode.value)}else onFormSubmit(e)});
$('#food-search').addEventListener('input',e=>{state.search=e.target.value;renderFoods()});
$('#selected-date').addEventListener('change',e=>{if(validDate(e.target.value)){state.date=e.target.value;render()}});
$('#import-json').addEventListener('change',e=>importJson(e.target.files?.[0]));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#modal').hidden)closeModal()});
window.addEventListener('online',updateNetwork);window.addEventListener('offline',updateNetwork);
window.addEventListener('hashchange',()=>switchView(location.hash.slice(1)||'diario'));
setupExtras({state,request,refresh,notify,modal,closeModal,db:()=>db,switchView,isReady:()=>appReady});
(async function init(){
 updateNetwork();
 const initialView=location.hash.slice(1)||'diario';
 setStorageStatus('loading');
 // Renderizar a prévia de medalhas mesmo antes da abertura do banco, sem permitir gravações.
 switchView(initialView);
 try{
  db=await openDb();
  await refresh();
  appReady=true;
  setStorageStatus('ready');
  switchView(initialView);
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('Service Worker:',err));
  const cache=await request('cache','get','taco-index');
  if(cache?.foods?.length)state.tacoIndex=cache.foods;
  if(state.view==='alimentos')renderFoods();
 }catch(err){
  console.error('Inicialização do armazenamento Nutri:',err);
  setStorageStatus('error',err?.name==='VersionError'
   ?'Existe uma versão mais nova do banco neste navegador. Feche todas as abas do Nutri e atualize. Seus dados não serão apagados.'
   :'Erro ao abrir os dados locais: '+(err?.message||'erro desconhecido')+'. Não limpe os dados do site.');
  notify('Falha ao abrir o banco local. Veja o aviso no topo.',true);
 }
})();
