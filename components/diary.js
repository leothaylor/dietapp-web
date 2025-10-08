// components/diary.js
import { fmt } from "../utils/helpers.js";

export function mountDiary({ supabase }) {
  // data padrão hoje
  const today = new Date().toISOString().slice(0,10);
  $("#diary-date").value = today;

  // carrega alvo (kcal do perfil)
  async function loadTarget() {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return;
    const { data } = await supabase.from("profiles")
      .select("tdee_kcal, protein_g, carbs_g, fat_g")
      .eq("user_id", session.user.id).maybeSingle();
    $("#sum-target").textContent = data?.tdee_kcal ?? "—";
  }

  // busca de alimentos (por nome/brand)
  async function searchFoods(q) {
    if (!q) { $("#food-select").innerHTML = ""; return; }
    const { data, error } = await supabase
      .from("foods")
      .select("id, name, brand, energy_kcal, protein_g_100, carbs_g_100, fat_g_100, serving_desc, serving_g")
      .or(`name.ilike.%${q}%,brand.ilike.%${q}%`)
      .limit(20);
    if (error) { console.error(error); return; }
    $("#food-select").innerHTML = data.map(f =>
      `<option value="${f.id}"
        data-kcal="${f.energy_kcal}"
        data-p="${f.protein_g_100}" data-c="${f.carbs_g_100}" data-g="${f.fat_g_100}"
        data-sg="${f.serving_g || 100}"
      >${f.name}${f.brand ? " · " + f.brand : ""}</option>`
    ).join("");
  }

  // listeners busca
  $("#food-search").addEventListener("input", (e) => searchFoods(e.target.value.trim()));

  // inserir entrada
  $("#btn-insert-entry").addEventListener("click", async () => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return;

    const foodId = $("#food-select").value;
    if (!foodId) { alert("Escolha um alimento da lista."); return; }

    const servings = Number($("#servings").value || 1);
    if (!servings || servings <= 0) { alert("Informe porções."); return; }

    // pega macros do option selecionado
    const opt = $("#food-select").selectedOptions[0];
    const kcal100 = Number(opt.dataset.kcal || 0);
    const p100 = Number(opt.dataset.p || 0);
    const c100 = Number(opt.dataset.c || 0);
    const g100 = Number(opt.dataset.g || 0);
    const sg = Number(opt.dataset.sg || 100);

    // normaliza para 1 porção = 'serving_g'
    const factor = (sg || 100) / 100;
    const kcal_per_serv = Math.round(kcal100 * factor);
    const p_per_serv = +(p100 * factor).toFixed(1);
    const c_per_serv = +(c100 * factor).toFixed(1);
    const g_per_serv = +(g100 * factor).toFixed(1);

    const meal = $("#meal-slot").value;
    const date = $("#diary-date").value;

    const { error } = await supabase.from("entries").insert({
      user_id: session.user.id,
      date, meal_slot: meal, food_id: foodId,
      servings,
      kcal: kcal_per_serv * servings,
      protein_g: p_per_serv * servings,
      carbs_g: c_per_serv * servings,
      fat_g: g_per_serv * servings
    });

    if (error) { alert("Erro ao inserir: " + error.message); return; }
    await loadEntries(); // atualiza tabela e somatório
    $("#servings").value = "1";
  });

  // lista entradas do dia
  async function loadEntries() {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return;
    const date = $("#diary-date").value;
    const { data, error } = await supabase.from("entries")
      .select("id, meal_slot, servings, kcal, protein_g, carbs_g, fat_g, foods(name)")
      .eq("user_id", session.user.id).eq("date", date).order("created_at");
    if (error) { console.error(error); return; }

    const tbody = $("#entries-table tbody");
    tbody.innerHTML = data.map(r => `
      <tr>
        <td>${labelMeal(r.meal_slot)}</td>
        <td>${r.foods?.name || "—"}</td>
        <td>${r.servings}</td>
        <td>${r.kcal}</td>
        <td>${fmt(r.protein_g,1)}</td>
        <td>${fmt(r.carbs_g,1)}</td>
        <td>${fmt(r.fat_g,1)}</td>
      </tr>
    `).join("");

    // somatórios
    const sum = data.reduce((acc, r) => ({
      kcal: acc.kcal + (r.kcal||0),
      p: acc.p + (r.protein_g||0),
      c: acc.c + (r.carbs_g||0),
      g: acc.g + (r.fat_g||0),
    }), {kcal:0,p:0,c:0,g:0});

    $("#sum-kcal").textContent = sum.kcal || "—";
    $("#sum-p").textContent = fmt(sum.p,1);
    $("#sum-c").textContent = fmt(sum.c,1);
    $("#sum-f").textContent = fmt(sum.g,1);
  }

  function labelMeal(v){
    return ({ breakfast:"Café"
