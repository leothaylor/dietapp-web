import { todayISO, fmt, setText } from "../utils/helpers.js";

export function mountDiary({ supabase }) {
  $("#diary-date").value = todayISO();

  $("#food-search").addEventListener("input", async (e) => {
    const q = e.target.value.trim();
    const select = $("#food-select");
    select.innerHTML = "";
    if (!q) return;
    const { data, error } = await supabase
      .from("foods")
      .select("id,name,brand,energy_kcal_100g,protein_g_100g,carbs_g_100g,fat_g_100g")
      .ilike("name", `%${q}%`)
      .limit(25);
    if (error) return;
    data.forEach(f => {
      const o = document.createElement("option");
      o.value = JSON.stringify(f);
      o.textContent = `${f.name}${f.brand?` (${f.brand})`:''} — ${f.energy_kcal_100g} kcal/100g`;
      select.appendChild(o);
    });
  });

  $("#btn-insert-entry").addEventListener("click", async () => {
    const v = $("#food-select").value;
    if (!v) return alert("Selecione um alimento.");
    const food = JSON.parse(v);
    const servings = Number($("#servings").value || 1);
    const kcal = Math.round((food.energy_kcal_100g || 0) * servings);
    const p = Math.round((food.protein_g_100g || 0) * servings);
    const c = Math.round((food.carbs_g_100g || 0) * servings);
    const g = Math.round((food.fat_g_100g || 0) * servings);

    const session = (await supabase.auth.getSession()).data.session;
    const { error } = await supabase.from("entries").insert({
      user_id: session.user.id,
      date: $("#diary-date").value,
      meal_slot: $("#meal-slot").value,
      food_id: food.id,
      servings,
      kcal, protein_g: p, carbs_g: c, fat_g: g
    });
    if (error) return alert(error.message);
    await reloadDay();
  });

  $("#btn-add-entry").addEventListener("click", () => $("#food-search").focus());

  async function reloadDay() {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return;
    const day = $("#diary-date").value;
    const { data, error } = await supabase
      .from("entries")
      .select("meal_slot, servings, kcal, protein_g, carbs_g, fat_g, foods(name)")
      .eq("user_id", session.user.id)
      .eq("date", day)
      .order("meal_slot");
    const tbody = $("#entries-table tbody");
    tbody.innerHTML = "";
    let sumK=0,sumP=0,sumC=0,sumF=0;
    (data||[]).forEach(r => {
      sumK+=r.kcal||0; sumP+=r.protein_g||0; sumC+=r.carbs_g||0; sumF+=r.fat_g||0;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${r.meal_slot}</td>
        <td>${r.foods?.name ?? "-"}</td>
        <td>${fmt(r.servings,2)}</td>
        <td>${r.kcal}</td><td>${r.protein_g}</td><td>${r.carbs_g}</td><td>${r.fat_g}</td>`;
      tbody.appendChild(tr);
    });
    setText("sum-kcal", sumK);
    setText("sum-p", sumP);
    setText("sum-c", sumC);
    setText("sum-f", sumF);

    const prof = await supabase.from("profiles").select("tdee_kcal").single().catch(()=>({data:null}));
    setText("sum-target", prof.data?.tdee_kcal ?? "—");
  }

  $("#diary-date").addEventListener("change", reloadDay);
  supabase.auth.onAuthStateChange((_e, s) => { if (s) reloadDay(); });
}
