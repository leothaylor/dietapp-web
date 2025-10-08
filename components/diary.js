// components/diary.js
import { toNumber } from "../utils/helpers.js";

export function mountDiary({ supabase }) {
  const $date = $("#diary-date");
  const $meal = $("#meal-slot");
  const $search = $("#food-search");
  const $select = $("#food-select");
  const $serv = $("#servings");
  const $tbody = $("#entries-table tbody");

  // data de hoje
  const today = new Date().toISOString().slice(0, 10);
  if (!$date.value) $date.value = today;

  // buscar alimentos (is_public ou do usuário)
  $search.addEventListener("input", debounce(loadFoods, 250));
  async function loadFoods() {
    const q = ($search.value || "").trim();
    if (!q) { $select.innerHTML = ""; return; }
    const { data, error } = await supabase
      .from("foods")
      .select("id, name, brand, serving_desc, serving_g, energy_kcal_100, protein_g_100, carbs_g_100, fat_g_100")
      .ilike("name", `%${q}%`)
      .limit(20);
    if (error) { console.error(error); return; }
    $select.innerHTML = data.map(f =>
      `<option value="${f.id}">${f.name}${f.brand && f.brand !== '-' ? ' • '+f.brand:''} (${f.serving_desc || f.serving_g+' g'})</option>`
    ).join("");
  }

  // garantir edição suave das porções
  $serv.min = "0.1";
  $serv.step = "0.1";
  $serv.inputMode = "decimal";

  // inserir entrada
  $("#btn-insert-entry").addEventListener("click", async () => {
    const food_id = $select.value;
    const servings = toNumber($serv.value || "1");
    if (!food_id || servings <= 0) return;

    const date = $date.value || today;
    const meal_slot = $meal.value;

    // pegar alimento para calcular macros por porção
    const { data: foods } = await supabase
      .from("foods")
      .select("energy_kcal_100, protein_g_100, carbs_g_100, fat_g_100, serving_g")
      .eq("id", food_id)
      .limit(1);

    if (!foods || !foods[0]) return;
    const f = foods[0];
    const factor = (f.serving_g && f.serving_g > 0) ? (f.serving_g / 100.0) : 1.0;
    const kcal = Math.round((f.energy_kcal_100 * factor) * servings);
    const p = +(f.protein_g_100 * factor * servings).toFixed(1);
    const c = +(f.carbs_g_100   * factor * servings).toFixed(1);
    const g = +(f.fat_g_100     * factor * servings).toFixed(1);

    const { error } = await supabase.from("entries").insert([{
      date, meal_slot, food_id, servings, kcal, protein_g: p, carbs_g: c, fat_g: g
    }]);

    if (!error) {
      // limpar e recarregar
      $serv.value = "1";
      await loadEntries();
    } else {
      console.error(error);
    }
  });

  // carregar entradas do dia
  $date.addEventListener("change", loadEntries);
  async function loadEntries() {
    const date = $date.value || today;
    const { data, error } = await supabase
      .from("entries")
      .select("id, date, meal_slot, servings, kcal, protein_g, carbs_g, fat_g, foods(name)")
      .eq("date", date)
      .order("created_at", { ascending: true });
    if (error) { console.error(error); return; }

    // tabela
    $tbody.innerHTML = data.map(e => `
      <tr>
        <td>${labelMeal(e.meal_slot)}</td>
        <td>${e.foods?.name ?? "-"}</td>
        <td>${e.servings}</td>
        <td>${e.kcal}</td>
        <td>${e.protein_g}</td>
        <td>${e.carbs_g}</td>
        <td>${e.fat_g}</td>
      </tr>
    `).join("");

    // resumo
    const sum = data.reduce((acc, x) => {
      acc.kcal += x.kcal; acc.p += x.protein_g; acc.c += x.carbs_g; acc.g += x.fat_g;
      return acc;
    }, {kcal:0,p:0,c:0,g:0});

    $("#sum-kcal").textContent = sum.kcal.toFixed(0);
    $("#sum-p").textContent = sum.p.toFixed(0);
    $("#sum-c").textContent = sum.c.toFixed(0);
    $("#sum-f").textContent = sum.g.toFixed(0);
  }

  function labelMeal(v) {
    return ({ breakfast:"Café", lunch:"Almoço", dinner:"Jantar", snack:"Lanche" }[v] || v);
  }

  function debounce(fn, ms) {
    let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); };
  }

  // carregar ao entrar
  loadEntries();
}
