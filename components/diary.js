// components/diary.js — TROQUE a função mountDiary inteira por esta
export function mountDiary({ supabase }) {
  const dateEl = $("#diary-date");
  const searchEl = $("#food-search");
  const selectEl = $("#food-select");
  const servingsEl = $("#servings");
  const mealEl = $("#meal-slot");
  const insertBtn = $("#btn-insert-entry");
  const tbody = $("#entries-table tbody");

  // Sempre deixo porções editável; quando um food é escolhido, eu apenas seto 1.0 se estiver vazio
  servingsEl.removeAttribute("disabled");

  // Data de hoje
  dateEl.value = new Date().toISOString().slice(0, 10);

  // Busca alimentos
  let pick = null;
  async function searchFoods(q) {
    pick = null;
    selectEl.innerHTML = "";
    if (!q || q.trim().length < 2) return;

    const { data, error } = await supabase
      .from("foods")
      .select("id,name,brand,energy_kcal_100g,protein_g_100g,carbs_g_100g,fat_g_100g,serving_desc,serving_g")
      .ilike("name", `%${q}%`)
      .limit(20);

    if (error) {
      alert("Erro na busca de alimentos");
      console.error(error);
      return;
    }
    data.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.brand ? `${f.name} • ${f.brand}` : f.name;
      opt.dataset.payload = JSON.stringify(f);
      selectEl.appendChild(opt);
    });
    if (data.length) {
      selectEl.selectedIndex = 0;
      onChoose();
    }
  }

  function onChoose() {
    const opt = selectEl.options[selectEl.selectedIndex];
    if (!opt) return;
    pick = JSON.parse(opt.dataset.payload);
    if (!servingsEl.value || Number(servingsEl.value) <= 0) servingsEl.value = "1";
  }

  selectEl.addEventListener("change", onChoose);
  searchEl.addEventListener("input", (e) => searchFoods(e.target.value));

  // Inserir lançamento
  insertBtn.addEventListener("click", async () => {
    if (!pick || Number(servingsEl.value) <= 0) {
      alert("Escolha um alimento e informe porções > 0");
      return;
    }
    const servings = Number(servingsEl.value);
    const factor = pick.serving_g > 0 ? (servings * pick.serving_g) / 100 : servings;

    const payload = {
      date: dateEl.value,
      meal_slot: mealEl.value,
      food_id: pick.id,
      servings,
      kcal: Math.round(pick.energy_kcal_100g * factor),
      protein_g: +(pick.protein_g_100g * factor).toFixed(1),
      carbs_g: +(pick.carbs_g_100g * factor).toFixed(1),
      fat_g: +(pick.fat_g_100g * factor).toFixed(1),
    };

    const { error } = await supabase.from("entries").insert(payload);
    if (error) {
      alert("Erro ao inserir alimento");
      console.error(error);
      return;
    }
    await loadEntries();
    servingsEl.value = "1";
  });

  // Listagem do dia
  async function loadEntries() {
    tbody.innerHTML = "";
    const { data, error } = await supabase
      .from("entries")
      .select("id,meal_slot,servings,kcal,protein_g,carbs_g,fat_g, foods(name,brand)")
      .eq("date", dateEl.value)
      .order("timestamp", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    let sumK = 0, sumP = 0, sumC = 0, sumF = 0;
    data.forEach((r) => {
      sumK += r.kcal; sumP += r.protein_g; sumC += r.carbs_g; sumF += r.fat_g;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${labelMeal(r.meal_slot)}</td>
        <td>${r.foods?.brand ? `${r.foods.name} • ${r.foods.brand}` : r.foods?.name || "-"}</td>
        <td>${r.servings}</td>
        <td>${r.kcal}</td>
        <td>${r.protein_g}</td>
        <td>${r.carbs_g}</td>
        <td>${r.fat_g}</td>`;
      tbody.appendChild(tr);
    });

    $("#sum-kcal").textContent = sumK;
    $("#sum-p").textContent = sumP.toFixed(0);
    $("#sum-c").textContent = sumC.toFixed(0);
    $("#sum-f").textContent = sumF.toFixed(0);
  }

  dateEl.addEventListener("change", loadEntries);
  loadEntries();
}

function labelMeal(v) {
  return ({ breakfast: "Café", lunch: "Almoço", dinner: "Jantar", snack: "Lanche" }[v] || v);
}
