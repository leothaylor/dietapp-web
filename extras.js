/* Nutri 2 — módulos adicionais. Dados privados mantidos exclusivamente no IndexedDB. */
import {ACHIEVEMENTS,CATEGORY_LABELS,evaluateAchievements,bodyComposition,movingWeight} from './achievements.js';
import {searchUsda,fetchUsdaFood} from './usda.js';
let api;
export const extra={body:[],water:[],favorites:[],awards:[],prefs:null,period:'30',analysisPeriod:'30'};
const DEFAULT_PREFS={id:'advanced',heightCm:null,sex:'male',weightGoal:null,weightLow:null,weightHigh:null,waterGoalMl:2500,events:{backupDates:[],csvDates:[],reportDates:[],importDates:[]}};
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const get=(s,root=document)=>root.querySelector(s);
const all=(s,root=document)=>[...root.querySelectorAll(s)];
const round=n=>Math.round(n*100)/100;
const n=v=>v===null||v===undefined||v===''?null:(Number.isFinite(+v)?+v:null);
const fmt=(v,places=1)=>v===null||v===undefined||!Number.isFinite(+v)?'—':(+v).toLocaleString('pt-BR',{maximumFractionDigits:places});
const iso=d=>d.toISOString().slice(0,10);
const dayDate=s=>new Date(s+'T12:00:00');
const uid=()=>typeof crypto?.randomUUID==='function'?crypto.randomUUID():'n'+Date.now()+Math.random().toString(36).slice(2);
const validDay=x=>/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(dayDate(x).valueOf())&&iso(dayDate(x))===x;
const keys=['kcal','protein','carbs','fat','fiber','sodium','calcium','iron','potassium','magnesium','zinc','phosphorus','manganese','copper','vitaminC','vitaminB1','vitaminB2','vitaminB3','vitaminB6','vitaminA','cholesterol'];
const micronames={fiber:'Fibras',sodium:'Sódio',calcium:'Cálcio',iron:'Ferro',potassium:'Potássio',magnesium:'Magnésio',zinc:'Zinco',phosphorus:'Fósforo',manganese:'Manganês',copper:'Cobre',vitaminC:'Vitamina C',vitaminB1:'Vitamina B1',vitaminB2:'Vitamina B2',vitaminB3:'Vitamina B3',vitaminB6:'Vitamina B6',vitaminA:'Vitamina A',cholesterol:'Colesterol'};
const microUnits={fiber:'g',vitaminA:'µg',...Object.fromEntries(Object.keys(micronames).filter(k=>k!=='fiber'&&k!=='vitaminA').map(k=>[k,'mg']))};
function validPrefs(x){return x&&typeof x==='object'&&['male','female'].includes(x.sex)&&[x.heightCm,x.weightGoal,x.weightLow,x.weightHigh].every(v=>v===null||v===undefined||(Number.isFinite(v)&&v>=0&&v<=300))&&Number.isFinite(x.waterGoalMl)&&x.waterGoalMl>=250&&x.waterGoalMl<=10000}
export function validateExtraBackup(data){
 const x=data?.extra||{};
 if(data?.version===1&&!data.extra)return {body:[],water:[],favorites:[],awards:[],prefs:{...DEFAULT_PREFS}};
 if(!x||typeof x!=='object'||!Array.isArray(x.body)||!Array.isArray(x.water)||!Array.isArray(x.favorites)||!Array.isArray(x.awards))throw Error('Estrutura de backup avançado inválida.');
 if(x.body.length>50000||x.water.length>100000||x.favorites.length>10000||x.awards.length>130)throw Error('Limite de registros excedido.');
 const validNum=v=>v===null||v===undefined||(typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<10000000);
 if(!x.body.every(z=>z&&typeof z.id==='string'&&validDay(z.date)&&z.weightKg>0&&z.weightKg<=500&&[z.waistCm,z.neckCm,z.hipCm,z.armCm,z.forearmCm,z.chestCm,z.thighCm,z.calfCm,z.abdomenCm,z.bodyFatManual].every(validNum)))throw Error('Medições corporais inválidas.');
 if(!x.water.every(z=>z&&typeof z.id==='string'&&validDay(z.date)&&z.ml>0&&z.ml<=10000))throw Error('Registros de água inválidos.');
 if(!x.favorites.every(z=>z&&typeof z.id==='string'&&typeof z.name==='string'&&z.name.length<=120&&Array.isArray(z.items)&&z.items.length<=100&&z.items.every(i=>i&&typeof i.name==='string'&&i.grams>0&&i.nutrients&&typeof i.nutrients==='object'&&keys.every(k=>i.nutrients[k]===null||i.nutrients[k]===undefined||validNum(i.nutrients[k])))))throw Error('Favoritos do backup inválidos.');
 if(!x.awards.every(z=>z&&typeof z.id==='string'&&ACHIEVEMENTS.some(a=>a.id===z.id)&&typeof z.unlockedAt==='string'))throw Error('Medalhas do backup inválidas.');
 const prefs=x.prefs?{...DEFAULT_PREFS,...x.prefs}: {...DEFAULT_PREFS};
 if(!validPrefs(prefs))throw Error('Metas e medidas do backup inválidas.');
 const ids=new Set();
 for(const row of [...x.body,...x.water,...x.favorites,...x.awards]){if(ids.has(row.id))throw Error('IDs duplicados no backup.');ids.add(row.id)}
 return {body:x.body,water:x.water,favorites:x.favorites,awards:x.awards,prefs};
}
export function extraSnapshot(){return {body:extra.body,water:extra.water,favorites:extra.favorites,awards:extra.awards,prefs:extra.prefs}}
export function extraBackupWrites(x){return [['body',x.body],['water',x.water],['favorites',x.favorites],['awards',x.awards],['settings',[x.prefs]]]}
export async function refreshExtras({notifyAwards=false}={}){
 if(!api)return;
 const [body,water,favorites,awards,prefs]=await Promise.all(['body','water','favorites','awards'].map(s=>api.request(s,'getAll')).concat([api.request('settings','get','advanced')]));
 extra.body=body;extra.water=water;extra.favorites=favorites;extra.awards=awards;
 extra.prefs=validPrefs(prefs)?{...DEFAULT_PREFS,...prefs,events:{...DEFAULT_PREFS.events,...(prefs.events||{})}}: {...DEFAULT_PREFS};
 await syncAchievements(notifyAwards);
}
export function setupExtras(context){api=context;document.addEventListener('click',onExtraClick);document.addEventListener('submit',onExtraSubmit);document.addEventListener('change',onExtraChange)}
export async function markBackup(){await logEvent('backupDates');await persist()}
async function logEvent(kind){const date=api.state.date;const events={...extra.prefs.events};const values=new Set(events[kind]||[]);values.add(date);events[kind]=[...values].sort();extra.prefs={...extra.prefs,events};await api.request('settings','put',extra.prefs)}
async function persist(){await api.refresh()}
function daysAgo(date,days){if(days==='all')return true;const delta=Math.round((dayDate(api.state.date)-dayDate(date))/86400000);return delta>=0&&delta<Number(days)}
function distinctLatest(samples){const m=new Map();[...samples].sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||''))).forEach(v=>m.set(v.date,v));return [...m.values()].sort((a,b)=>a.date.localeCompare(b.date))}
function valsByDay(date){return extra.water.filter(w=>w.date===date).reduce((a,w)=>a+(Number(w.ml)||0),0)}
function measured(){return distinctLatest(extra.body)}
function currentMeasure(){return measured().at(-1)||null}
function goalWeightText(weight){
 const p=extra.prefs; if(p.weightLow!=null&&p.weightHigh!=null&&p.weightLow>0&&p.weightHigh>=p.weightLow)return weight>=p.weightLow&&weight<=p.weightHigh?'Dentro da faixa':weight<p.weightLow?'Faltam '+fmt(p.weightLow-weight)+' kg para a faixa':fmt(weight-p.weightHigh)+' kg acima da faixa';
 return p.weightGoal!=null&&p.weightGoal>0?'Distância até a meta: '+fmt(Math.abs(weight-p.weightGoal))+' kg':'Defina sua meta de peso nos ajustes';
}
function chart(data,key,title,unit='',height=170){
 const a=data.filter(x=>x[key]!==null&&x[key]!==undefined&&Number.isFinite(+x[key])).slice().sort((x,y)=>x.date.localeCompare(y.date));
 if(!a.length)return '<div class="empty-state"><strong>'+e(title)+'</strong>Sem dados suficientes para o gráfico.</div>';
 let min=Math.min(...a.map(x=>+x[key])),max=Math.max(...a.map(x=>+x[key]));
 const pad=Math.max((max-min)*.16,Math.max(.3,Math.abs(max)*.01));min-=pad;max+=pad;
 const W=650,H=height,low=H-30,top=14,spread=Math.max(1,max-min);
 const points=a.map((x,i)=>({x:35+(a.length===1?.5:i/(a.length-1))*(W-58),y:low-(x[key]-min)/spread*(low-top),record:x}));
 const line=points.map(p=>p.x.toFixed(2)+','+p.y.toFixed(2)).join(' ');
 const dots=points.map(p=>'<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="3.2" fill="#60c3aa"><title>'+e(p.record.date)+' — '+fmt(p.record[key],2)+' '+e(unit)+'</title></circle>').join('');
 return '<div class="chart-shell"><div class="chart-name">'+e(title)+' <span>'+fmt(a.at(-1)[key],2)+' '+e(unit)+'</span></div><svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+e(title)+' ao longo do tempo"><line x1="35" x2="'+(W-22)+'" y1="'+low+'" y2="'+low+'" stroke="#36506a"/><line x1="35" x2="'+(W-22)+'" y1="'+top+'" y2="'+top+'" stroke="#24394b" stroke-dasharray="3,5"/><polyline points="'+line+'" fill="none" stroke="#60c3aa" stroke-width="2.9" stroke-linejoin="round" stroke-linecap="round"/>'+dots+'<text x="35" y="'+(H-8)+'" fill="#93a7b6" font-size="12">'+e(a[0].date.slice(5))+'</text><text x="'+(W-92)+'" y="'+(H-8)+'" fill="#93a7b6" font-size="12">'+e(a.at(-1).date.slice(5))+'</text><text x="3" y="25" fill="#93a7b6" font-size="11">'+fmt(max,1)+'</text><text x="3" y="'+(low-3)+'" fill="#93a7b6" font-size="11">'+fmt(min,1)+'</text></svg></div>';
}
function barChart(points,label,unit='',maxBars=30){
 const list=points.slice(-maxBars),max=Math.max(1,...list.map(x=>x.value||0));
 return '<div class="histogram" aria-label="'+e(label)+'">'+list.map(x=>'<div class="histogram-item" title="'+e(x.date)+': '+fmt(x.value)+' '+e(unit)+'"><small>'+fmt(x.value,0)+'</small><div class="histogram-bar" style="height:'+Math.max(2,Math.round((x.value||0)/max*135))+'px"></div><span>'+e(x.date.slice(8))+'</span></div>').join('')+'</div>';
}
export function renderExtras(view){
 if(!api)return;
 if(view==='evolucao')renderBody();
 else if(view==='hidratacao')renderWater();
 else if(view==='medalhas')renderAwards();
 else if(view==='relatorios')renderAdvancedReports();
 else if(view==='diario')renderDiaryExtras();
 else if(view==='ajustes')renderAdvancedSettings();
 else if(view==='receitas')renderRecipeExtras();
}
function renderBody(){
 const rows=measured(),latest=rows.at(-1),p=extra.prefs;
 const weight=latest?.weightKg??null;
 const avg=movingWeight(extra.body);
 const cards=[
  ['Peso atual',weight===null?'—':fmt(weight,2)+' kg',weight===null?'Primeira pesagem pendente':goalWeightText(weight)],
  ['Meta de peso',p.weightGoal?fmt(p.weightGoal)+' kg':p.weightLow?fmt(p.weightLow)+'–'+fmt(p.weightHigh)+' kg':'—','Editável em Configurações'],
  ['Gordura estimada',latest?.bodyFatPct!=null?fmt(latest.bodyFatPct)+' %':'—',latest?.bodyFatMethod==='navy'?'Equação US Navy; estimativa':'Método informado'],
  ['Massa gorda',latest?.fatKg!=null?fmt(latest.fatKg)+' kg':'—','Estimativa, não medição direta'],
  ['Massa livre de gordura',latest?.leanKg!=null?fmt(latest.leanKg)+' kg':'—','Não equivale a massa muscular'],
  ['Média móvel 7 dias',avg!=null?fmt(avg,2)+' kg':'—','Baseada nas pesagens disponíveis']
 ];
 get('#body-summary').innerHTML=cards.map(([title,value,caption])=>'<article class="panel metric-box"><div class="overline">'+e(title)+'</div><strong>'+e(value)+'</strong><small>'+e(caption)+'</small></article>').join('');
 const subset=rows.filter(x=>daysAgo(x.date,extra.period));
 get('#body-charts').innerHTML=[['weightKg','Peso corporal','kg'],['waistCm','Cintura','cm'],['bodyFatPct','Percentual de gordura estimado','%'],['fatKg','Massa gorda estimada','kg'],['leanKg','Massa livre de gordura estimada','kg']].map(([key,title,unit])=>chart(subset,key,title,unit)).join('');
 get('#body-history').innerHTML=rows.length?rows.slice().reverse().map(x=>'<article class="list-row"><div><strong>'+e(x.date)+' · '+fmt(x.weightKg,2)+' kg</strong><small>Cintura '+fmt(x.waistCm)+' cm · Pescoço '+fmt(x.neckCm)+' cm · BF '+fmt(x.bodyFatPct)+' %'+(x.bodyFatMethod==='navy'?' (US Navy)':' (informado)')+'</small></div><div class="row-actions"><button class="btn btn-outline small" data-edit-body="'+e(x.id)+'">Editar</button><button class="icon-button" data-delete-body="'+e(x.id)+'" aria-label="Excluir medição">×</button></div></article>').join(''):'<div class="empty-state"><strong>Sem avaliações corporais</strong>Cadastre seu peso e suas medidas para acompanhar as tendências.</div>';
}
function renderWater(){
 const date=api.state.date;const total=valsByDay(date),goal=extra.prefs.waterGoalMl;
 get('#water-date-label').textContent='Data selecionada: '+date;
 get('#water-current').textContent=fmt(total,0)+' ml';
 get('#water-goal').textContent='Meta: '+fmt(goal,0)+' ml · '+fmt(Math.min(100,total/goal*100),0)+'%';
 get('#water-fill').style.width=Math.min(100,total/goal*100)+'%';
 get('#water-entries').innerHTML=extra.water.filter(x=>x.date===date).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(x=>'<div class="water-event">'+fmt(x.ml,0)+' ml <small>'+e(x.createdAt.slice(11,16))+'</small><button class="delete-button" data-delete-water="'+e(x.id)+'" aria-label="Excluir água">×</button></div>').join('')||'<p class="muted">Ainda não há água registrada nesta data.</p>';
 const days=Array.from({length:30},(_,i)=>{const d=dayDate(date);d.setDate(d.getDate()-29+i);const key=iso(d);return {date:key,value:valsByDay(key)}});
 get('#water-chart').innerHTML=barChart(days,'Água consumida','ml',30);
}
function renderDiaryExtras(){
 const target=get('#favorites-list');if(!target)return;
 target.innerHTML=extra.favorites.length?extra.favorites.map(f=>'<div class="favorite-item"><div><strong>'+e(f.name)+'</strong><small>'+f.items.length+' itens · '+fmt(f.items.reduce((t,i)=>t+(i.nutrients?.kcal||0),0),0)+' kcal na combinação original</small></div><div class="row-actions"><button class="btn btn-soft small" data-apply-favorite="'+e(f.id)+'">+ Adicionar hoje</button><button class="icon-button" title="Excluir favorito" data-delete-favorite="'+e(f.id)+'">×</button></div></div>').join(''):'<p class="muted small-text">Salve combinações de refeições para registrar tudo com um toque.</p>';
}
function renderRecipeExtras(){
 const el=get('#recipe-extra-note');if(el)el.textContent='Agora é possível duplicar receitas, definir rendimento em porções e cadastrar medidas caseiras nos alimentos.';
 all('[data-edit-recipe]').forEach(button=>{
   const row=button.closest('.list-row');
   if(row&&!row.querySelector('[data-duplicate-recipe]')){const b=document.createElement('button');b.type='button';b.className='btn btn-outline small';b.textContent='Duplicar';b.dataset.duplicateRecipe=button.dataset.editRecipe;button.after(b)}
 });
}
function renderAdvancedReports(){
 const period=extra.analysisPeriod,periodEntries=api.state.entries.filter(x=>daysAgo(x.date,period));
 const dates=[...new Set(periodEntries.map(x=>x.date))];
 const averages=['kcal','protein','carbs','fat'].map(key=>{
  const valid=periodEntries.filter(x=>typeof x.nutrients?.[key]==='number');
  const total=valid.reduce((a,x)=>a+x.nutrients[key],0);
  return {key,avg:dates.length?total/dates.length:0,coverage:periodEntries.length?Math.round(100*valid.length/periodEntries.length):0};
 });
 const names={kcal:'Energia',protein:'Proteína',carbs:'Carboidratos',fat:'Gorduras'};
 get('#analysis-summary').innerHTML='<div class="stats-mini">'+averages.map(x=>'<div class="mini-stat"><small>'+names[x.key]+' / dia registrado</small><strong>'+fmt(x.avg,1)+(x.key==='kcal'?' kcal':' g')+'</strong><small>'+x.coverage+'% de registros com dados</small></div>').join('')+'</div>';
 const goal=api.state.goals;
 const byDay=dates.map(date=>({date,entries:periodEntries.filter(x=>x.date===date)}));
 const completed=byDay.filter(d=>{
   const kcal=d.entries.reduce((a,x)=>a+(x.nutrients?.kcal||0),0),protein=d.entries.reduce((a,x)=>a+(x.nutrients?.protein||0),0);
   return d.entries.every(x=>x.nutrients?.kcal!==null&&x.nutrients?.protein!==null)&&Math.abs(kcal-goal.kcal)<=goal.kcal*.1&&protein>=goal.protein*.9
 }).length;
 get('#analysis-adherence').textContent=dates.length?'Dias registrados dentro de ±10% da meta calórica e com ao menos 90% da proteína: '+completed+' / '+dates.length+' ('+fmt(100*completed/dates.length,0)+'%). Os dias sem lançamentos não entram neste índice.':'Sem registros no período selecionado.';
 const coverage=Object.keys(micronames).map(key=>({key,known:periodEntries.filter(x=>typeof x.nutrients?.[key]==='number').length,total:periodEntries.length}));
 get('#analysis-micros').innerHTML=coverage.map(x=>'<div class="micro-row"><b>'+e(micronames[x.key])+'</b><small>'+x.known+'/'+x.total+' registros com dados</small></div>').join('');
 const latest=measured().filter(x=>daysAgo(x.date,period));
 get('#analysis-comparison').innerHTML=latest.length>=2?'<p>Peso: '+fmt(latest[0].weightKg,2)+' → '+fmt(latest.at(-1).weightKg,2)+' kg. Cintura: '+fmt(latest[0].waistCm)+' → '+fmt(latest.at(-1).waistCm)+' cm.</p>':'<p class="muted">Cadastre ao menos duas avaliações corporais no período para comparar peso e cintura.</p>';
 get('#analysis-trends').innerHTML=chart(byDay.map(d=>({date:d.date,kcal:d.entries.reduce((s,x)=>s+(x.nutrients?.kcal||0),0)})),'kcal','Energia nos dias registrados','kcal',180);
}
function renderAdvancedSettings(){
 const f=get('#advanced-form');if(!f)return;
 for(const name of ['heightCm','weightGoal','weightLow','weightHigh','waterGoalMl'])f.elements.namedItem(name).value=extra.prefs[name]??'';
 f.elements.namedItem('sex').value=extra.prefs.sex;
}
function bodyForm(row){
 const b=row||{};
 const fields=[['weightKg','Peso (kg) *',1,400],['waistCm','Cintura (cm)',30,250],['neckCm','Pescoço (cm)',15,100],['hipCm','Quadril (cm)',40,250],['armCm','Braço (cm)',10,120],['forearmCm','Antebraço (cm)',10,100],['chestCm','Peitoral (cm)',40,220],['abdomenCm','Abdômen (cm)',30,250],['thighCm','Coxa (cm)',15,140],['calfCm','Panturrilha (cm)',10,120]];
 const html='<form id="body-form"><div class="modal-grid"><label class="field"><span>Data</span><input name="date" type="date" required value="'+e(b.date||api.state.date)+'"></label>'+fields.map(([id,label,min,max])=>'<label class="field"><span>'+label+'</span><input name="'+id+'" type="number" '+(id==='weightKg'?'required':'')+' min="'+min+'" max="'+max+'" step="0.01" placeholder="Não informado" value="'+(b[id]??'')+'"></label>').join('')+'<label class="field"><span>Percentual de gordura informado (%), opcional</span><input name="bodyFatManual" type="number" step="0.01" min="2" max="70" placeholder="Automático pela US Navy" value="'+(b.bodyFatManual??'')+'"></label><label class="field"><span>Método, caso informe BF</span><select name="method">'+[['manual','Estimativa pessoal'],['dobras','Dobras cutâneas'],['bioimpedancia','Bioimpedância'],['dexa','DXA'],['outro','Outro método']].map(([id,label])=>'<option value="'+id+'"'+(b.method===id?' selected':'')+'>'+label+'</option>').join('')+'</select></label></div><p class="help-line">Para estimativa US Navy: defina altura e sexo nos Ajustes e registre cintura/pescoço (e quadril no cálculo feminino). A massa livre de gordura não equivale apenas a músculos.</p><div class="form-actions"><button type="button" class="btn btn-outline" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">Salvar medição</button></div></form>';
 api.modal(b.id?'Editar avaliação corporal':'Nova avaliação corporal',html);
 get('#body-form').dataset.editId=b.id||'';
}
function favoriteForm(){
 const meals=api.state.meals,options=meals.map(m=>'<option value="'+e(m.id)+'">'+e(m.label)+'</option>').join('');
 api.modal('Salvar refeição favorita','<form id="favorite-form"><label class="field"><span>Nome do favorito</span><input name="name" required maxlength="120" placeholder="Ex.: Almoço habitual"></label><label class="field"><span>Selecionar refeição do dia '+e(api.state.date)+'</span><select name="meal">'+options+'</select></label><p class="help-line">Salva a combinação exata de alimentos e quantidades. Editar os alimentos depois não altera esse favorito.</p><div class="form-actions"><button class="btn btn-outline" type="button" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">Salvar favorito</button></div></form>')
}
function copyForm(){
 api.modal('Copiar refeições','<form id="copy-form"><div class="modal-grid"><label class="field"><span>Copiar da data</span><input name="fromDate" type="date" required></label><label class="field"><span>Copiar para</span><input type="date" value="'+e(api.state.date)+'" disabled></label><label class="field"><span>Refeição</span><select name="meal"><option value="all">Todas as refeições</option>'+api.state.meals.map(m=>'<option value="'+e(m.id)+'">'+e(m.label)+'</option>').join('')+'</select></label></div><p class="help-line">Os nutrientes são copiados exatamente como registrados. Essa operação adiciona novos lançamentos e não substitui os existentes.</p><div class="form-actions"><button class="btn btn-outline" type="button" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">Copiar registros</button></div></form>');
 const y=dayDate(api.state.date);y.setDate(y.getDate()-1);get('#copy-form [name=fromDate]').value=iso(y);
}
function csvExport(kind){
 const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 let rows=[];
 if(kind==='food')rows=[['Data','Refeição','Alimento','Gramas',...keys],...api.state.entries.map(x=>[x.date,x.meal,x.name,x.grams,...keys.map(k=>x.nutrients?.[k]??'')])];
 else if(kind==='body')rows=[['Data','Peso kg','Cintura cm','Pescoço cm','Quadril cm','BF estimado %','Massa gorda kg','Massa livre de gordura kg','Método'],...extra.body.map(x=>[x.date,x.weightKg,x.waistCm,x.neckCm,x.hipCm,x.bodyFatPct,x.fatKg,x.leanKg,x.bodyFatMethod])];
 else if(kind==='water')rows=[['Data','Água ml'],...[...new Set(extra.water.map(x=>x.date))].sort().map(d=>[d,valsByDay(d)])];
 else return;
 const csv='\uFEFF'+rows.map(row=>row.map(q).join(';')).join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='nutri-'+kind+'-'+api.state.date+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
 logEvent('csvDates').then(()=>persist()).catch(()=>{});api.notify('CSV exportado para o dispositivo.');
}
function showAward(award){
 const box=get('#achievement-popup');if(!box)return;
 box.innerHTML='<div class="award-symbol">'+award.icon+'</div><div><small>MEDALHA DESBLOQUEADA</small><strong>'+e(award.name)+'</strong><span>'+e(award.description)+'</span></div><button data-close-award aria-label="Fechar medalha">×</button>';
 box.hidden=false;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)box.classList.add('no-motion');else box.classList.remove('no-motion');
 setTimeout(()=>{if(get('#achievement-popup')===box)box.hidden=true},7200);
}
async function syncAchievements(notifyNew){
 const calculated=evaluateAchievements({entries:api.state.entries,foods:api.state.foods,recipes:api.state.recipes,body:extra.body,water:extra.water,favorites:extra.favorites,events:extra.prefs.events});
 const earned=new Set(calculated.filter(x=>x.unlocked).map(x=>x.id));
 const previous=new Map(extra.awards.map(x=>[x.id,x]));
 const missing=calculated.filter(x=>x.unlocked&&!previous.has(x.id));
 const revoked=extra.awards.filter(x=>!earned.has(x.id));
 if(!missing.length&&!revoked.length)return;
 for(const item of revoked)await api.request('awards','delete',item.id);
 for(const item of missing){const record={id:item.id,unlockedAt:new Date().toISOString()};await api.request('awards','put',record)}
 extra.awards=[...extra.awards.filter(x=>earned.has(x.id)),...missing.map(x=>({id:x.id,unlockedAt:new Date().toISOString()}))];
 if(notifyNew&&missing.length)showAward(missing.at(-1));
}
function renderAwards(){
 const selected=get('#awards-category')?.value||'all';
 const rules=evaluateAchievements({entries:api.state.entries,foods:api.state.foods,recipes:api.state.recipes,water:extra.water,body:extra.body,favorites:extra.favorites,events:extra.prefs.events});
 const unlocked=new Set(extra.awards.map(x=>x.id));
 const count=rules.filter(x=>unlocked.has(x.id)).length;
 get('#awards-summary').textContent=count+' / '+rules.length+' medalhas desbloqueadas';
 get('#awards-fill').style.width=(count/rules.length*100)+'%';
 const shown=rules.filter(r=>selected==='all'||selected===r.category).sort((a,b)=>Number(unlocked.has(b.id))-Number(unlocked.has(a.id))||a.category.localeCompare(b.category)||a.target-b.target);
 get('#awards-grid').innerHTML=shown.map(x=>{const yes=unlocked.has(x.id),date=extra.awards.find(r=>r.id===x.id)?.unlockedAt?.slice(0,10);
 return '<article class="achievement-card'+(yes?' earned':' locked')+'"><div class="achievement-icon" aria-hidden="true">'+x.icon+'</div><strong>'+e(x.name)+'</strong><small>'+e(x.description)+'</small><span class="achievement-category">'+e(CATEGORY_LABELS[x.category])+'</span>'+(yes?'<span class="achievement-date">Conquistada em '+e(date||'')+'</span>':'<div class="progress-track"><div class="progress-fill" style="width:'+Math.min(100,Math.round(x.progress*100))+'%"></div></div><span class="achievement-date">'+Math.round(x.progress*100)+'% concluído</span>')+(x.confidence?'<span class="achievement-note">Estimativa antropométrica</span>':'')+'</article>'
 }).join('');
 get('#awards-history').innerHTML=[...extra.awards].sort((a,b)=>b.unlockedAt.localeCompare(a.unlockedAt)).slice(0,35).map(x=>{const d=rules.find(r=>r.id===x.id);return d?'<div class="history-item"><span>'+d.icon+' '+e(d.name)+'</span><small>'+e(x.unlockedAt.slice(0,10))+'</small></div>':''}).join('')||'<p class="muted">Suas medalhas aparecerão aqui automaticamente.</p>';
}
function parsePortions(text){
 const lines=String(text||'').split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
 if(lines.length>20)throw Error('Máximo de 20 medidas caseiras por alimento.');
 return lines.map(line=>{const i=line.lastIndexOf('=');if(i<1)throw Error('Use uma medida por linha: 1 fatia = 25');const name=line.slice(0,i).trim(),grams=Number(line.slice(i+1).trim().replace(',','.'));if(!name||name.length>60||!Number.isFinite(grams)||grams<=0||grams>100000)throw Error('Medida inválida: '+line);return {name,grams}});
}
export function readPortions(text){return parsePortions(text)}
function usdaModal(){
 api.modal('Buscar alimentos no USDA','<form id="usda-form"><label class="field"><span>Pesquisa em inglês (ex.: cooked rice, banana)</span><input name="term" required minlength="2" maxlength="100" placeholder="Ex.: chicken breast"></label><div class="form-actions"><button class="btn btn-primary" type="submit">Pesquisar</button></div></form><div id="usda-results" class="list-stack"></div><p class="fine-print">Fonte gratuita USDA FoodData Central, banco Foundation / SR Legacy. A chave pública DEMO_KEY tem limites compartilhados e pode falhar. Seus dados não são enviados ao nosso repositório.</p>');
}
function usdaResults(items){
 get('#usda-results').innerHTML=items.length?items.map(x=>'<div class="list-row"><div><strong>'+e(x.description)+'</strong><small>'+e(x.dataType)+' · FDC '+x.fdcId+'</small></div><button class="btn btn-soft small" data-usda-id="'+x.fdcId+'">+ Importar</button></div>').join(''):'<p class="muted">Nenhum alimento encontrado.</p>'
}
function libraryImportModal(){
 api.modal('Importar biblioteca gerada pelo GPT','<p class="muted">Arquivo JSON no formato <code>nutri-library</code>, com alimentos e receitas. Os dados serão validados e acrescentados sem apagar a biblioteca.</p><label class="field"><span>Selecione o arquivo</span><input id="library-json-input" type="file" accept="application/json,.json"></label><p class="help-line">Valores nutricionais por 100 g. Informações ausentes devem ser null. Não faça importação de arquivos sem verificar a origem.</p><div class="form-actions"><button class="btn btn-outline" data-close-modal>Cancelar</button><button class="btn btn-primary" id="library-json-apply" type="button">Importar</button></div>')
}
async function importLibrary(){
 const file=get('#library-json-input')?.files?.[0];if(!file||file.size>8e6)throw Error('Selecione um JSON de até 8 MB.');
 const data=JSON.parse(await file.text());
 if(data.schema!=='nutri-library'||data.version!==1||!Array.isArray(data.foods)||data.foods.length>1000||!Array.isArray(data.recipes||[])||(data.recipes||[]).length>300)throw Error('Formato inválido. Consulte o modelo de importação no README.');
 const foods=data.foods.map(f=>{
  if(!f||typeof f.name!=='string'||!f.name.trim()||f.name.length>140||!f.nutrients||typeof f.nutrients!=='object')throw Error('Alimento inválido.');
  const out={};for(const k of keys){const val=f.nutrients[k];if(val==null||val==='')out[k]=null;else if(typeof val!=='number'||!Number.isFinite(val)||val<0||val>10000000)throw Error('Nutriente inválido: '+k);else out[k]=val}
  if(out.kcal!=null&&out.kcal>1000)throw Error('Calorias por 100 g fora do intervalo.');
  const portions=(f.portions||[]).map(p=>({name:String(p.name||'').slice(0,60),grams:Number(p.grams)}));if(portions.length>20||portions.some(p=>!p.name||p.grams<=0||p.grams>100000))throw Error('Porção inválida.');
  return {id:uid(),name:f.name.trim(),brand:String(f.brand||'').slice(0,100),barcode:String(f.barcode||'').slice(0,16),source:'gpt-import',nutrients:out,portions,updatedAt:new Date().toISOString()}
 });
 const recipes=(data.recipes||[]).map(r=>{
   if(!r||typeof r.name!=='string'||!r.name.trim()||!Array.isArray(r.ingredients)||!r.ingredients.length||r.ingredients.length>100||!(Number(r.yieldGrams)>0))throw Error('Receita inválida.');
   const ingredientRows=r.ingredients.map(i=>{const f=foods.find(x=>x.name===i.foodName)||api.state.foods.find(x=>x.name===i.foodName);if(!f||!(Number(i.grams)>0))throw Error('Ingrediente de receita não encontrado: '+i.foodName);return {foodId:f.id,name:f.name,grams:Number(i.grams),nutrients:f.nutrients}});
   const computed={};for(const k of keys){computed[k]=ingredientRows.every(i=>typeof i.nutrients[k]==='number')?round(ingredientRows.reduce((a,i)=>a+i.nutrients[k]*i.grams/Number(r.yieldGrams),0)):null}
   return {id:uid(),name:r.name.trim().slice(0,140),kind:'recipe',yieldGrams:Number(r.yieldGrams),servings:Number(r.servings)||1,ingredients:ingredientRows,nutrients:computed,updatedAt:new Date().toISOString()}
 });
 if(!confirm('Adicionar '+foods.length+' alimentos e '+recipes.length+' receitas à biblioteca?'))return;
 const tx=api.db().transaction(['foods','recipes'],'readwrite');for(const item of foods)tx.objectStore('foods').put(item);for(const item of recipes)tx.objectStore('recipes').put(item);
 await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});
 await logEvent('importDates');api.closeModal();await persist();api.notify('Biblioteca importada: '+foods.length+' alimentos, '+recipes.length+' receitas.');
}
async function onExtraSubmit(evt){
 const f=evt.target;if(!['body-form','advanced-form','water-form','favorite-form','copy-form','usda-form'].includes(f.id))return;
 evt.preventDefault();evt.stopPropagation();
 try{
 if(f.id==='usda-form'){
   const result=get('#usda-results');result.textContent='Pesquisando USDA...';
   try{usdaResults(await searchUsda(f.elements.term.value))}catch(err){result.textContent='Não foi possível consultar: '+err.message}
   return;
 }
 if(f.id==='body-form'){
  const date=f.elements.date.value,weightKg=n(f.elements.weightKg.value);if(!validDay(date)||weightKg===null||weightKg<1||weightKg>400)throw Error('Revise a data e o peso.');
  const data={id:f.dataset.editId||uid(),date,weightKg,createdAt:new Date().toISOString()};
  for(const name of ['waistCm','neckCm','hipCm','armCm','forearmCm','chestCm','abdomenCm','thighCm','calfCm','bodyFatManual']){data[name]=n(f.elements.namedItem(name).value);if(data[name]!==null&&(data[name]<0||data[name]>300))throw Error('Medida fora de intervalo: '+name)}
  if(data.bodyFatManual!=null&&(data.bodyFatManual<2||data.bodyFatManual>70))throw Error('BF informado deve estar entre 2 e 70%.');
  data.method=f.elements.method.value;
  Object.assign(data,bodyComposition(data,extra.prefs));
  await api.request('body','put',data);api.closeModal();await persist();api.notify('Medição corporal salva.');
 }
 if(f.id==='advanced-form'){
  const p={...extra.prefs,sex:f.elements.sex.value};
  for(const k of ['heightCm','weightGoal','weightLow','weightHigh','waterGoalMl'])p[k]=n(f.elements.namedItem(k).value);
  if(!validPrefs(p)||p.heightCm!==null&&(p.heightCm<100||p.heightCm>250)||p.waterGoalMl>10000||p.waterGoalMl<250)throw Error('Revise altura, metas e limites.');
  if(p.weightLow!=null&&p.weightHigh!=null&&p.weightLow>p.weightHigh)throw Error('Faixa de peso inválida.');
  await api.request('settings','put',p);
  extra.prefs=p;
  const existing=extra.body.filter(x=>x.bodyFatManual==null);
  for(const x of existing){const changed={...x,...bodyComposition(x,p)};await api.request('body','put',changed)}
  await persist();api.notify('Configurações de evolução e água salvas.');
 }
 if(f.id==='water-form'){
  const ml=n(f.elements.ml.value),date=api.state.date;if(!ml||ml<=0||ml>10000)throw Error('Use volume entre 1 e 10.000 ml.');
  await api.request('water','put',{id:uid(),date,ml,goalMl:extra.prefs.waterGoalMl,createdAt:new Date().toISOString()});
  f.reset();await persist();api.notify('Água registrada.');
 }
 if(f.id==='favorite-form'){
  const name=f.elements.name.value.trim(),meal=f.elements.meal.value;
  const items=api.state.entries.filter(x=>x.date===api.state.date&&x.meal===meal).map(x=>({name:x.name,foodId:x.foodId,grams:x.grams,meal:x.meal,nutrients:{...x.nutrients},source:x.source}));
  if(!name||!items.length)throw Error('Informe o nome e escolha uma refeição com registros.');
  await api.request('favorites','put',{id:uid(),name,items,createdAt:new Date().toISOString()});api.closeModal();await persist();api.notify('Refeição salva nos favoritos.');
 }
 if(f.id==='copy-form'){
  const source=f.elements.fromDate.value,meal=f.elements.meal.value;
  if(!validDay(source)||source===api.state.date)throw Error('Selecione uma data de origem diferente do dia atual.');
  const list=api.state.entries.filter(x=>x.date===source&&(meal==='all'||x.meal===meal));if(!list.length)throw Error('Não existem registros para copiar nessa data.');
  if(!confirm('Copiar '+list.length+' registro(s) para '+api.state.date+'?'))return;
  const tx=api.db().transaction('entries','readwrite');for(const x of list)tx.objectStore('entries').put({...x,id:uid(),date:api.state.date,createdAt:new Date().toISOString()});
  await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});
  api.closeModal();await persist();api.notify(list.length+' registro(s) copiados.');
 }
 }catch(err){api.notify('Erro: '+err.message,true)}
}
async function onExtraClick(evt){
 const b=evt.target.closest('button');if(!b)return;
 try{
 if(b.id==='body-create')bodyForm();
 else if(b.dataset.editBody)bodyForm(extra.body.find(x=>x.id===b.dataset.editBody));
 else if(b.dataset.deleteBody){if(confirm('Excluir esta avaliação corporal?')){await api.request('body','delete',b.dataset.deleteBody);await persist()}}
 else if(b.dataset.waterAdd){const ml=Number(b.dataset.waterAdd);await api.request('water','put',{id:uid(),date:api.state.date,ml,goalMl:extra.prefs.waterGoalMl,createdAt:new Date().toISOString()});await persist();api.notify('+'+ml+' ml registrados.')}
 else if(b.dataset.deleteWater){if(confirm('Excluir este registro de água?')){await api.request('water','delete',b.dataset.deleteWater);await persist()}}
 else if(b.id==='favorite-create')favoriteForm();
 else if(b.dataset.deleteFavorite){if(confirm('Excluir esta refeição favorita?')){await api.request('favorites','delete',b.dataset.deleteFavorite);await persist()}}
 else if(b.dataset.applyFavorite){const favorite=extra.favorites.find(x=>x.id===b.dataset.applyFavorite);if(!favorite)return;const tx=api.db().transaction('entries','readwrite');for(const x of favorite.items){const meal=api.state.meals.some(m=>m.id===x.meal)?x.meal:api.state.meals[0].id;tx.objectStore('entries').put({...x,id:uid(),meal,date:api.state.date,createdAt:new Date().toISOString()})}await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});await persist();api.notify(favorite.items.length+' alimentos adicionados ao diário.')}
 else if(b.id==='copy-meal-open')copyForm();
 else if(b.dataset.duplicateRecipe){const recipe=api.state.recipes.find(x=>x.id===b.dataset.duplicateRecipe);if(!recipe)return;await api.request('recipes','put',{...recipe,id:uid(),name:recipe.name+' — Cópia',updatedAt:new Date().toISOString()});await persist();api.notify('Receita duplicada.')}
 else if(b.dataset.csvExport)csvExport(b.dataset.csvExport);
 else if(b.id==='analysis-log'){await logEvent('reportDates');await persist();api.notify('Relatório registrado no histórico de análises.')}
 else if(b.id==='usda-open')usdaModal();
 else if(b.dataset.usdaId){
   const item=await fetchUsdaFood(b.dataset.usdaId);
   if(api.state.foods.some(f=>f.sourceUrl===item.sourceUrl)){api.notify('Alimento USDA já cadastrado.');return}
   await api.request('foods','put',{...item,id:uid()});
   api.closeModal();await persist();api.notify('Alimento USDA importado: '+item.name);
 }
 else if(b.id==='library-json-open')libraryImportModal();
 else if(b.id==='library-json-apply')await importLibrary();
 else if(b.hasAttribute('data-close-award'))get('#achievement-popup').hidden=true;
 }catch(err){api.notify(err.message||'Ação não concluída.',true)}
}
function onExtraChange(evt){
 const x=evt.target;
 if(x.id==='body-period'){extra.period=x.value;renderBody()}
 if(x.id==='analysis-period'){extra.analysisPeriod=x.value;renderAdvancedReports()}
 if(x.id==='awards-category')renderAwards();
}
/* Test helpers only; no mutable globals exposed. */
export const extraDiagnostics=()=>({body:extra.body.length,water:extra.water.length,favorites:extra.favorites.length,awards:extra.awards.length,catalog:ACHIEVEMENTS.length});
