import test from 'node:test';
import assert from 'node:assert/strict';
import {ACHIEVEMENTS,CATEGORY_LABELS,evaluateAchievements,bodyFatNavy,bodyComposition,movingWeight} from '../achievements.js';
import {normalizeUsda} from '../usda.js';
import {validateExtraBackup,readPortions} from '../extras.js';

test('130 medalhas, identificadores únicos, sete categorias',()=>{
 assert.equal(ACHIEVEMENTS.length,130);
 assert.equal(new Set(ACHIEVEMENTS.map(x=>x.id)).size,130);
 const counts={diario:20,agua:30,corpo:20,composicao:18,biblioteca:20,organizacao:12,integradas:10};
 for(const [key,count] of Object.entries(counts)){
  assert.equal(ACHIEVEMENTS.filter(x=>x.category===key).length,count);
  assert.ok(CATEGORY_LABELS[key]);
 }
});
test('sete dias de água em 3 litros desbloqueiam 7, não 14',()=>{
 const water=Array.from({length:7},(_,i)=>({date:'2026-11-'+String(i+1).padStart(2,'0'),ml:3000,goalMl:3000}));
 const out=evaluateAchievements({water,entries:[],body:[],foods:[],recipes:[],favorites:[],events:{}});
 assert.equal(out.find(x=>x.id==='agua_3l_7').unlocked,true);
 assert.equal(out.find(x=>x.id==='agua_3l_14').unlocked,false);
});
test('volume fracionado no dia é somado e não cria registros duplicados',()=>{
 const water=[{date:'2026-11-01',ml:1500,goalMl:2500},{date:'2026-11-01',ml:1600,goalMl:2500}];
 const out=evaluateAchievements({water,entries:[],body:[],foods:[],recipes:[],favorites:[],events:{}});
 assert.equal(out.find(x=>x.id==='agua_meta_1').unlocked,true);
 assert.equal(out.find(x=>x.id==='agua_registros_3').unlocked,false);
});
test('sequência interrompida não resulta em medalha de 7 dias',()=>{
 const water=Array.from({length:6},(_,i)=>({date:'2026-11-'+String(i<3?i+1:i+2).padStart(2,'0'),ml:3000,goalMl:3000}));
 const out=evaluateAchievements({water,entries:[],body:[],foods:[],recipes:[],favorites:[],events:{}});
 assert.equal(out.find(x=>x.id==='agua_3l_7').unlocked,false);
});
test('estimativa Navy para homem com valores plausíveis',()=>{
 const value=bodyFatNavy({sex:'male',heightCm:170,waistCm:82,neckCm:41});
 assert.ok(value>9&&value<17);
});
test('Navy feminino exige quadril',()=>{
 assert.equal(bodyFatNavy({sex:'female',heightCm:160,waistCm:75,neckCm:33}),null);
 assert.ok(bodyFatNavy({sex:'female',heightCm:160,waistCm:75,neckCm:33,hipCm:98})>0);
});
test('não confunde massa livre de gordura com massa muscular',()=>{
 const res=bodyComposition({weightKg:70,bodyFatManual:20,method:'dobras'},{heightCm:170,sex:'male'});
 assert.equal(res.fatKg,14);assert.equal(res.leanKg,56);assert.equal(res.bodyFatMethod,'dobras');
});
test('média de peso utiliza pesagens no período',()=>{
 const body=[{date:'2026-10-01',weightKg:80},{date:'2026-11-01',weightKg:70},{date:'2026-11-02',weightKg:72}];
 assert.equal(movingWeight(body),71);
});
test('sem comparações repetidas, não se concedem medalhas de composição corporal',()=>{
 const body=[{date:'2026-10-01',weightKg:70,fatKg:10,leanKg:60,waistCm:82}];
 const out=evaluateAchievements({body,entries:[],water:[],foods:[],recipes:[],favorites:[],events:{}});
 assert.equal(out.some(x=>x.category==='composicao'&&x.unlocked),false);
});
test('backup V1 permanece restaurável com dados avançados vazios',()=>{
 const legacy={schema:'nutri-backup',version:1,foods:[],recipes:[],entries:[],settings:[{id:'goals',kcal:2000,protein:100,carbs:250,fat:65}]};
 const data=validateExtraBackup(legacy);
 assert.equal(data.prefs.waterGoalMl,2500);assert.deepEqual(data.body,[]);assert.deepEqual(data.awards,[]);
});
test('backup V2 inválido é rejeitado sem mutação',()=>{
 assert.throws(()=>validateExtraBackup({version:2,extra:{body:[{id:'x',date:'invalid'}],water:[],favorites:[],awards:[]}}));
});
test('medidas caseiras convertidas para gramas',()=>{
 assert.deepEqual(readPortions('1 fatia = 25\n1 colher = 15'),[{name:'1 fatia',grams:25},{name:'1 colher',grams:15}]);
 assert.throws(()=>readPortions('colher 30'));
});
test('USDA: mapeia micronutrientes e preserva campos ausentes como null',()=>{
 const x=normalizeUsda({fdcId:123,description:'Cooked rice',foodNutrients:[{nutrient:{id:1008,unitName:'kcal'},amount:130},{nutrient:{id:1003,unitName:'g'},amount:2.7},{nutrient:{id:1093,unitName:'mg'},amount:1}]});
 assert.equal(x.nutrients.kcal,130);assert.equal(x.nutrients.protein,2.7);assert.equal(x.nutrients.sodium,1);assert.equal(x.nutrients.iron,null);
});
