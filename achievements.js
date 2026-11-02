/* Nutri 2 — motor determinístico de conquistas. Sem IA, sem desafios configuráveis. */
export const CATEGORY_LABELS={
  diario:'Consistência alimentar',agua:'Hidratação',corpo:'Evolução corporal',
  composicao:'Composição corporal estimada',biblioteca:'Alimentos e receitas',
  organizacao:'Organização e relatórios',integradas:'Conquistas combinadas'
};
const tier=i=>['Bronze','Prata','Ouro','Diamante'][Math.min(3,Math.floor(i/3))];
const DAY=86400000;
const round=n=>Math.round(n*100)/100;
const toDay=d=>{const x=new Date(d+'T12:00:00');return Number.isNaN(x.getTime())?null:x};
const uniq=a=>[...new Set(a.filter(Boolean))].sort();
const daysBetween=(a,b)=>{const x=toDay(a),y=toDay(b);return x&&y?Math.round((y-x)/DAY):0};
function maxStreak(days){const arr=uniq(days);let result=0,n=0,last='';for(const day of arr){n=last&&daysBetween(last,day)===1?n+1:1;result=Math.max(result,n);last=day}return result}
function groupsWater(list){
 const map=new Map();
 for(const x of list||[]){if(typeof x.date!=='string'||!Number.isFinite(Number(x.ml))||x.ml<=0)continue;const current=map.get(x.date)||{ml:0,goal:x.goalMl||2500};current.ml+=Number(x.ml);current.goal=Number(x.goalMl)||current.goal;map.set(x.date,current)}
 return map
}
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
function seriesMetrics(body){
 const list=(body||[]).filter(x=>x?.date&&Number(x.weightKg)>0).slice().sort((a,b)=>a.date.localeCompare(b.date));
 const bodyDays=uniq(list.map(x=>x.date));
 const measures=uniq(list.filter(x=>Number(x.waistCm)>0&&Number(x.neckCm)>0).map(x=>x.date));
 const samples=list.filter(x=>typeof x.fatKg==='number'&&typeof x.leanKg==='number'&&Number.isFinite(x.fatKg)&&Number.isFinite(x.leanKg)&&Number(x.waistCm)>0);
 let fatLost=0,leanGained=0,waistLost=0,recomp=0,stable=0,valid=false;
 if(samples.length>=4){
   const first=samples.slice(0,2),last=samples.slice(-2);
   const methods=[...first,...last].map(x=>x.bodyFatMethod||'navy');
   const adequate=daysBetween(first[0].date,last[last.length-1].date)>=14&&
      methods.every(x=>x===methods[0]);
   if(adequate){
     valid=true;
     const fa=mean(first.map(x=>x.fatKg)),fb=mean(last.map(x=>x.fatKg));
     fatLost=Math.max(0,round(fa-fb));
     leanGained=Math.max(0,round(mean(last.map(x=>x.leanKg))-mean(first.map(x=>x.leanKg))));
     waistLost=Math.max(0,round(mean(first.map(x=>x.waistCm))-mean(last.map(x=>x.waistCm))));
     stable=Math.abs(mean(last.map(x=>x.weightKg))-mean(first.map(x=>x.weightKg)));
     if(stable<=1.5&&waistLost>=1)recomp=waistLost;
   }
 }
 return {weighDays:bodyDays.length,measureDays:measures.length,fatLost,leanGained,waistLost,recomp,stable,comparisonValid:valid}
}
function metrics(data){
 const entries=data.entries||[],foods=data.foods||[],recipes=data.recipes||[],favorites=data.favorites||[];
 const diaryDays=uniq(entries.map(e=>e.date));
 const water=groupsWater(data.water||[]);
 const hydrationDays=[...water.keys()];
 const goalDays=[...water].filter(([k,v])=>v.goal>=500&&v.ml>=v.goal).map(([k])=>k);
 const threeLiterDays=[...water].filter(([k,v])=>v.ml>=3000).map(([k])=>k);
 const logs=data.events||{};
 const body=seriesMetrics(data.body||[]);
 return {
   diaryDays:diaryDays.length,diaryStreak:maxStreak(diaryDays),waterDays:hydrationDays.length,
   waterGoalDays:goalDays.length,waterGoalStreak:maxStreak(goalDays),
   threeLiterStreak:maxStreak(threeLiterDays),threeLiterDays:threeLiterDays.length,
   foods:foods.length,recipes:recipes.length,favorites:favorites.length,
   barcodes:foods.filter(x=>x.barcode&&x.source==='openfoodfacts').length,
   backups:uniq(logs.backupDates||[]).length,reports:uniq(logs.reportDates||[]).length,
   csv:uniq(logs.csvDates||[]).length,importDays:uniq(logs.importDates||[]).length,
   ...body
 }
}
function newRule(id,category,name,description,metric,target,icon,unit='',extra={}){
 return {id,category,name,description,metric,target,icon,unit,...extra};
}
function makeRules(){
 const rules=[];
 const add=(...a)=>rules.push(newRule(...a));
 const addSeries=(category,code,metric,values,title,icon,unit='')=>{
  values.forEach((v,i)=>add(code+'_'+v,category,title+' '+tier(i),title+': '+v+(unit?' '+unit:''),metric,v,icon,unit))
 };
 addSeries('diario','diario_dias','diaryDays',[1,3,7,14,21,30,45,60,90,120],'Dias registrados','📅','dias');
 addSeries('diario','diario_sequencia','diaryStreak',[2,3,5,7,10,14,21,30,45,60],'Sequência alimentar','🗓️','dias seguidos');
 addSeries('agua','agua_registros','waterDays',[1,3,7,14,21,30,45,60,90,120],'Hidratação registrada','💧','dias');
 addSeries('agua','agua_meta','waterGoalDays',[1,3,7,14,21,30,45,60,90,120],'Metas de água atingidas','🚰','dias');
 addSeries('agua','agua_3l','threeLiterStreak',[1,2,3,5,7,10,14,21,30,60],'3 litros consecutivos','🌊','dias seguidos');
 addSeries('corpo','peso_registros','weighDays',[1,2,3,5,7,10,14,20,30,52],'Pesagens registradas','⚖️','dias');
 addSeries('corpo','medidas_registros','measureDays',[1,2,3,5,7,10,14,20,30,52],'Avaliações com medidas','📏','dias');
 addSeries('composicao','gordura_reducao','fatLost',[0.5,1,1.5,2,3,4,5],'Redução de gordura estimada','🔥','kg',{requiresComparison:true});
 addSeries('composicao','magra_aumento','leanGained',[0.5,1,1.5,2,3,4,5],'Aumento de massa livre de gordura estimada','💪','kg',{requiresComparison:true});
 addSeries('composicao','recomp','recomp',[1,2,3,5],'Recomposição sugerida pela cintura','🧬','cm',{requiresComparison:true});
 addSeries('biblioteca','alimentos','foods',[1,5,10,25,50],'Biblioteca alimentar','🥑','alimentos');
 addSeries('biblioteca','receitas','recipes',[1,3,5,10,20],'Receitas próprias','👨‍🍳','receitas');
 addSeries('biblioteca','favoritos','favorites',[1,3,5,10,20],'Refeições favoritas','⭐','refeições');
 addSeries('biblioteca','codigos','barcodes',[1,3,5,10,25],'Produtos por código','▥','produtos');
 addSeries('organizacao','backups','backups',[1,3,7,12],'Segurança dos dados','🛡️','dias com backup');
 addSeries('organizacao','relatorios','reports',[1,3,7,12],'Análises consultadas','📊','dias de análise');
 addSeries('organizacao','csv','csv',[1,3,7,12],'Exportações de relatórios','📁','dias');
 const combined=[
  [3,1,0,'Primeira integração'],[7,3,1,'Rotina alinhada'],[14,7,2,'Gestão consistente'],
  [21,10,3,'Três pilares'],[30,14,4,'Mês de acompanhamento'],
  [45,21,5,'Rotina de longo prazo'],[60,30,6,'Acompanhamento avançado'],
  [90,45,8,'Evolução documentada'],[120,60,10,'Nutri veterano'],[180,90,12,'Legado Nutri']
 ];
 combined.forEach(([d,w,b,name],i)=>add('combinada_'+i,'integradas',name,
  d+' dias com alimentos, '+w+' dias com água e '+b+' pesagens.', 'combined',i+1,'🏆','', {requirements:{diaryDays:d,waterDays:w,weighDays:b}}));
 if(rules.length!==130)throw new Error('Catálogo deve ter 130 medalhas: '+rules.length);
 return rules;
}
export const ACHIEVEMENTS=Object.freeze(makeRules());
export function evaluateAchievements(data){
 const m=metrics(data);
 return ACHIEVEMENTS.map(rule=>{
   let progress,unlocked;
   if(rule.metric==='combined'){
     const req=rule.requirements;
     const ratios=Object.keys(req).map(k=>req[k]===0?1:m[k]/req[k]);
     progress=Math.min(1,...ratios);unlocked=progress>=1;
   }else{
     progress=Math.min(1,Math.max(0,(m[rule.metric]||0)/rule.target));
     unlocked=progress>=1&&(!rule.requiresComparison||m.comparisonValid);
   }
   return {...rule,current:rule.metric==='combined'?Math.round(progress*100):round(m[rule.metric]||0),
     progress,unlocked,confidence:rule.requiresComparison?'Estimativa; não comprova variação real de tecido corporal.':null};
 });
}
export function bodyFatNavy({sex,heightCm,waistCm,neckCm,hipCm}){
 const height=Number(heightCm),waist=Number(waistCm),neck=Number(neckCm),hip=Number(hipCm);
 if(!(height>=100&&height<=250&&waist>=35&&neck>=20&&waist>neck))return null;
 const inch=2.54;
 let result;
 if(sex==='female'){
  if(!(hip>=40&&hip<=220&&waist+hip>neck))return null;
  result=163.205*Math.log10((waist+hip-neck)/inch)-97.684*Math.log10(height/inch)-104.912;
 }else if(sex==='male'){
  result=86.010*Math.log10((waist-neck)/inch)-70.041*Math.log10(height/inch)+36.76;
 }else return null;
 return Number.isFinite(result)&&result>=2&&result<=70?round(result):null;
}
export function bodyComposition(measure,prefs){
 const bf=measure.bodyFatManual!=null?Number(measure.bodyFatManual):bodyFatNavy({...measure,sex:prefs.sex,heightCm:prefs.heightCm});
 const kg=Number(measure.weightKg);
 const ok=Number.isFinite(kg)&&kg>0&&Number.isFinite(bf)&&bf>=2&&bf<=70;
 return {bodyFatPct:ok?round(bf):null,fatKg:ok?round(kg*bf/100):null,leanKg:ok?round(kg*(100-bf)/100):null,bodyFatMethod:measure.bodyFatManual!=null?(measure.method||'manual'): 'navy'};
}
export function movingWeight(body,days=7){
 const last=(body||[]).filter(x=>x?.date&&Number(x.weightKg)>0).sort((a,b)=>a.date.localeCompare(b.date));
 if(!last.length)return null;
 const end=last[last.length-1].date;
 const range=last.filter(x=>daysBetween(x.date,end)>=0&&daysBetween(x.date,end)<days);
 const unique=new Map(range.map(x=>[x.date,Number(x.weightKg)]));
 return unique.size?round(mean([...unique.values()])):null;
}
