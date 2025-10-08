// components/diary.js
const $ = (s)=>document.querySelector(s);

let wired = false;

export function mountDiary(supabase){
  if (!wired){
    // buscar conforme digita
    $("#food-search").addEventListener("input", ()=> searchFoods(supabase));
    // inserir
    $("#btn-insert-entry").addEventListener("click", ()=> insertEntry(supabase));
    // data padrão
    $("#diary-date").value = new Date().toISOString().slice(0,10);
    wired = true;
  }

  // carrega lista do dia
  listEntries(supabase);
  // e tenta popular alimentos se o campo não estiver vazio
  searchFoods(supabase);
}

async function searchFoods(supabase){
  const q = $("#food-search").value.trim();

  const sel = $("#food-select");
  sel.innerHTML = `<option value="">Buscando...</option>`;

  const query = supabase.from("foods").select("id,name,serving_desc,serving_g").order("name");
  if (q) query.ilike("name", `%${q}%`);
  const { data, error } = await query.limit(50);

  if (error){
    sel.innerHTML = `<option value="">Erro ao buscar</option>`;
    console.error(error);
    return;
  }
  if (!data?.length){
    sel.innerHTML = `<option value="">Nenhum alimento</option>`;
    return;
  }

  sel.innerHTML = data.map(f=>(
    `<option value="${f.id}" data-sg="${f.serving_g||0}">${f.name}${f.serving_desc?` — ${f.serving_desc}`:""}</option>`
  )).join("");
}

async function insertEntry(supabase){
  const foodId = $("#food-select").value;
  const servings = parseFloat($("#servings").value||"1");
  const meal = $("#meal-slot").value;
  const date = $("#diary-date").value;

  if (!foodId || !(servings>0)){
    alert("Escolha um alimento e informe porções > 0");
    return;
  }

  try{
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) throw new Error("Sem sessão");

    // pega macros do alimento
    const { data: foods } = await supabase.from("foods")
      .select("energy_kcal_100g,protein_g_100g,carbs_g_100g,fat_g_100g,serving_g")
      .eq("id", foodId).limit(1);

    if (!foods?.length) throw new Error("Alimento não encontrado");

    const f = foods[0];
    const sg = f.serving_g || 100; // default

    // converte 100g -> porção
    const factor = (sg/100) * servings;
    const kcal = Math.round(f.energy_kcal_100g * factor);
    const p = Math.round(f.protein_g_100g * factor);
    const c = Math.round(f.carbs_g_100g * factor);
    const g = Math.round(f.fat_g_100g * factor);

    const { error } = await supabase.from("entries").insert({
      user_id: session.user.id, date, meal_slot: meal, food_id: foodId,
      servings, kcal, protein_g: p, carbs_g: c, fat_g: g
    });

    if (error) throw error;

    // recarrega tabela
    await listEntries(supabase);
    $("#servings").value = "1";
  }catch(e){
    alert(`Erro ao inserir: ${e.message}`);
  }
}

async function listEntries(supabase){
  const date = $("#diary-date").value;
  const tbody = $("#entries-table tbody");
  tbody.innerHTML = "<tr><td colspan='7'>Carregando...</td></tr>";

  const session = (await supabase.auth.getSession()).data.session;
  if (!session) return;

  const { data, error } = await supabase
    .from("entries")
    .select("meal_slot, foods(name), servings, kcal, protein_g, carbs_g, fat_g")
    .eq("user_id", session.user.id)
    .eq("date", date)
    .order("meal_slot");

  if (error){
    tbody.innerHTML = "<tr><td colspan='7'>Erro</td></tr>";
    console.error(error);
    return;
  }
  if (!data?.length){
    tbody.innerHTML = "<tr><td colspan='7'>Sem lançamentos</td></tr>";
    setDaySummary({kcal:0,p:0,c:0,g:0});
    return;
  }

  let sumK=0,sumP=0,sumC=0,sumG=0;
  tbody.innerHTML = data.map(r=>{
    sumK+=r.kcal||0; sumP+=r.protein_g||0; sumC+=r.carbs_g||0; sumG+=r.fat_g||0;
    return `<tr>
      <td>${ptMeal(r.meal_slot)}</td>
      <td>${r.foods?.name||"—"}</td>
      <td>${r.servings||1}</td>
      <td>${r.kcal||0}</td>
      <td>${r.protein_g||0}</td>
      <td>${r.carbs_g||0}</td>
      <td>${r.fat_g||0}</td>
    </tr>`;
  }).join("");

  setDaySummary({kcal:sumK,p:sumP,c:sumC,g:sumG});
}

function ptMeal(m){
  return ({breakfast:"Café",lunch:"Almoço",dinner:"Jantar",snack:"Lanche"}[m]||m);
}
function setDaySummary({kcal,p,c,g}){
  $("#sum-kcal").textContent = kcal;
  $("#sum-p").textContent = p+" g";
  $("#sum-c").textContent = c+" g";
  $("#sum-f").textContent = g+" g";
}
