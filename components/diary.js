// components/diary.js
import { fmt, setText, toNumber } from "../utils/helpers.js";

export async function mountDiary(supabase) {
  const dateInput     = document.getElementById("diary-date");
  const mealSel       = document.getElementById("meal-slot");
  const qInput        = document.getElementById("food-search");
  const foodSelect    = document.getElementById("food-select");
  const servingsInput = document.getElementById("servings");
  const insertBtn     = document.getElementById("btn-insert-entry");
  const tbody         = document.querySelector("#entries-table tbody");

  dateInput.value = new Date().toISOString().slice(0,10);

  // habilita/desabilita porções conforme há seleção
  const refreshServingsState = () => {
    servingsInput.disabled = !foodSelect.value;
  };
  refreshServingsState();

  // Busca foods (usa coluna gerada search_name)
  async function searchFoods() {
    const q = qInput.value.trim().toLowerCase();
    foodSelect.innerHTML = "";
    if (!q) { refreshServingsState(); return; }

    const { data, error } = await supabase
      .from("foods")
      .select("id,name,brand,serving_desc,serving_g,energy_kcal_100g,protein_g_100g,carbs_g_100g,fat_g_100g")
      .ilike("search_name", `%${q}%`)
      .order("name", { ascending: true })
      .limit(20);

    if (error) { console.error(error); refreshServingsState(); return; }

    for (const f of data) {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = `${f.name}${f.brand ? " · " + f.brand : ""} — ${f.serving_desc || f.serving_g + " g"}`;
      opt.dataset.servingG = f.serving_g || 0;
      opt.dataset.k100 = f.energy_kcal_100g || 0;
      opt.dataset.p100 = f.protein_g_100g || 0;
      opt.dataset.c100 = f.carbs_g_100g || 0;
      opt.dataset.f100 = f.fat_g_100g || 0;
      foodSelect.appendChild(opt);
    }
    refreshServingsState();
  }

  qInput.addEventListener("input", searchFoods);
  foodSelect.addEventListener("change", refreshServingsState);

  // Inserir
  insertBtn.addEventListener("click", async () => {
    const foodId   = foodSelect.value;
    const servings = toNumber(servingsInput.value);
    if (!foodId || servings <= 0) {
      alert("Escolha um alimento e informe porções > 0");
      return;
    }
    const user = (await supabase.auth.getUser()).data.user;
    const date = dateInput.value;
    const meal = mealSel.value;

    // calcula macros por porção (usando 100 g)
    const opt = foodSelect.selectedOptions[0];
    const k = (+opt.dataset.k100 || 0) * (servings * (+opt.dataset.servingG || 0)) / 100;
    const p = (+opt.dataset.p100 || 0) * (servings * (+opt.dataset.servingG || 0)) / 100;
    const c = (+opt.dataset.c100 || 0) * (servings * (+opt.dataset.servingG || 0)) / 100;
    const f = (+opt.dataset.f100 || 0) * (servings * (+opt.dataset.servingG || 0)) / 100;

    const { error } = await supabase.from("entries").insert({
      user_id: user.id, date, meal_slot: meal, food_id: foodId,
      servings, kcal: k, protein_g: p, carbs_g: c, fat_g: f
    });

    if (error) { alert("Erro ao inserir: " + error.message); return; }

    // limpa somente porções
    servingsInput.value = "1";
    await loadEntries(); // atualiza tabela
  });

  // Carregar listagem do dia
  async function loadEntries() {
    const user = (await supabase.auth.getUser()).data.user;
    const { data, error } = await supabase
      .from("entries")
      .select("meal_slot, servings, kcal, protein_g, carbs_g, fat_g, foods(name)")
      .eq("user_id", user.id)
      .eq("date", dateInput.value)
      .order("timestamp", { ascending: true });

    if (error) { console.error(error); return; }

    tbody.innerHTML = "";
    let sk=0, sp=0, sc=0, sf=0;
    for (const r of data) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.meal_slot}</td>
        <td>${r.foods?.name || "—"}</td>
        <td>${fmt(r.servings)}</td>
        <td>${fmt(r.kcal)}</td>
        <td>${fmt(r.protein_g)}</td>
        <td>${fmt(r.carbs_g)}</td>
        <td>${fmt(r.fat_g)}</td>`;
      tbody.appendChild(tr);
      sk+=r.kcal||0; sp+=r.protein_g||0; sc+=r.carbs_g||0; sf+=r.fat_g||0;
    }
    setText("#sum-kcal", fmt(sk));
    setText("#sum-p", fmt(sp));
    setText("#sum-c", fmt(sc));
    setText("#sum-f", fmt(sf));
  }

  dateInput.addEventListener("change", loadEntries);
  await loadEntries();
}
