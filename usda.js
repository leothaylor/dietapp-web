/* USDA FoodData Central — consulta pública opcional, apenas Foundation e SR Legacy.
   DEMO_KEY é uma chave de demonstração compartilhada (limite baixo), não credencial privada. */
const API='https://api.nal.usda.gov/fdc/v1';
const IDMAP={kcal:[1008,2047,2048],protein:[1003],carbs:[1005],fat:[1004],fiber:[1079],
 sodium:[1093],calcium:[1087],iron:[1089],potassium:[1092],magnesium:[1090],
 zinc:[1095],phosphorus:[1091],manganese:[1101],copper:[1098],vitaminC:[1162],
 vitaminB1:[1165],vitaminB2:[1166],vitaminB3:[1167],vitaminB6:[1175],
 vitaminA:[1106],cholesterol:[1253]};
const UNITS={kcal:'KCAL',protein:'G',carbs:'G',fat:'G',fiber:'G',vitaminA:'UG'};
const clean=v=>String(v??'').slice(0,200);
function valueFor(nutrients,ids){
 for(const id of ids){const row=nutrients.find(x=>Number(x?.nutrient?.id??x?.nutrientId)===id);const value=row?.amount??row?.value;if(typeof value==='number'&&Number.isFinite(value)&&value>=0)return {value,unit:String(row.nutrient?.unitName||row.unitName||'').toUpperCase()}}
 return null;
}
export function normalizeUsda(item){
 const rows=item.foodNutrients||[],nutrients={};
 for(const [key,ids] of Object.entries(IDMAP)){
   const found=valueFor(rows,ids);
   if(!found){nutrients[key]=null;continue}
   if(key==='kcal'&&found.unit==='KJ'){nutrients[key]=Math.round(found.value/4.184*100)/100;continue}
   const expected=UNITS[key]||'MG';
   const unit=found.unit||expected;
   if(unit===expected)nutrients[key]=found.value;
   else if(expected==='MG'&&unit==='G')nutrients[key]=found.value*1000;
   else if(expected==='UG'&&unit==='MG')nutrients[key]=found.value*1000;
   else if(expected==='MG'&&unit==='UG')nutrients[key]=found.value/1000;
   else nutrients[key]=null;
 }
 if(nutrients.kcal!=null&&nutrients.kcal>1000)nutrients.kcal=null;
 return {id:String(item.fdcId),name:clean(item.description||'Alimento USDA'),brand:'',
   source:'usda',sourceUrl:'https://fdc.nal.usda.gov/food-details/'+item.fdcId+'/nutrients',
   nutrients,portions:[],updatedAt:new Date().toISOString()};
}
export async function searchUsda(term){
 const query=String(term||'').trim();if(query.length<2||query.length>100)throw Error('Informe um termo de busca de 2 a 100 caracteres.');
 const url=API+'/foods/search?api_key=DEMO_KEY&pageSize=12&query='+encodeURIComponent(query)+'&dataType='+encodeURIComponent('Foundation')+'&dataType='+encodeURIComponent('SR Legacy');
 const response=await fetch(url,{headers:{Accept:'application/json'}});
 if(response.status===429)throw Error('Limite gratuito temporariamente atingido. Tente mais tarde.');
 if(!response.ok)throw Error('USDA indisponível (HTTP '+response.status+').');
 const data=await response.json();if(!Array.isArray(data.foods))throw Error('Resposta USDA inválida.');
 return data.foods.filter(x=>Number.isFinite(x.fdcId)&&['Foundation','SR Legacy'].includes(x.dataType)).map(x=>({fdcId:x.fdcId,description:clean(x.description),dataType:x.dataType}));
}
export async function fetchUsdaFood(id){
 if(!Number.isInteger(Number(id))||Number(id)<1)throw Error('Identificador USDA inválido.');
 const response=await fetch(API+'/food/'+Number(id)+'?api_key=DEMO_KEY');
 if(response.status===429)throw Error('Limite gratuito temporariamente atingido.');
 if(!response.ok)throw Error('Alimento não encontrado no USDA.');
 const item=await response.json();if(Number(item.fdcId)!==Number(id))throw Error('Identificador USDA inconsistente.');
 if(!['Foundation','SR Legacy'].includes(item.dataType))throw Error('Tipo alimentar não suportado nesta versão.');
 return normalizeUsda(item);
}
