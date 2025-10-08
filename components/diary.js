diff --git a/components/diary.js b/components/diary.js
index 96a18172c1f03d65385bc84ba0c1d544a41a37de..1d5c3a2e2590b7a564745b2a28a35fac63930609 100644
--- a/components/diary.js
+++ b/components/diary.js
@@ -1,153 +1,187 @@
-// components/diary.js
-import { supabase } from "../app.js";
-const $ = (s)=>document.querySelector(s);
-
-function toNumber(v){ const n = Number(String(v).replace(",", ".")); return isFinite(n)?n:0; }
-
-export async function mountDiary({ session }) {
-  const uid = session.user.id;
-
-  // data hoje
-  const dateEl = $("#diary-date");
-  if (dateEl && !dateEl.value) {
-    const today = new Date();
+// components/diary.js
+const $ = (s) => document.querySelector(s);
+
+function toNumber(v) {
+  const n = Number(String(v).replace(",", "."));
+  return Number.isFinite(n) ? n : 0;
+}
+
+let client;
+let userId;
+let initialized = false;
+
+export async function mountDiary({ supabase, session }) {
+  client = supabase;
+  userId = session.user.id;
+
+  // data hoje
+  const dateEl = $("#diary-date");
+  if (dateEl && !dateEl.value) {
+    const today = new Date();
     const d = today.toISOString().slice(0,10);
     dateEl.value = d;
   }
 
-  // busca de alimentos
-  $("#food-search")?.addEventListener("input", debounce(loadFoods, 250));
-  $("#food-select")?.addEventListener("change", ()=>{
-    const has = $("#food-select").value;
-    $("#servings").disabled = !has;
-  });
-
-  $("#btn-insert-entry")?.addEventListener("click", async ()=>{
-    const foodId = $("#food-select").value;
-    const servings = toNumber($("#servings").value);
-    const meal = $("#meal-slot").value;
-
-    if (!foodId || servings <= 0) {
-      return alert("Escolha um alimento e informe porções > 0");
-    }
-
-    // pega nutrição do alimento para gravar os campos calculados
-    const { data: food } = await supabase.from("foods")
-      .select("id, name, serving_g, energy_kcal_100g, protein_g_100g, carbs_g_100g, fat_g_100g")
-      .eq("id", foodId).maybeSingle();
-
-    const factor = (food?.serving_g || 100) / 100 * servings;
-    const kcal = Math.round((food?.energy_kcal_100g||0) * factor);
-    const p    = Math.round((food?.protein_g_100g||0)    * factor);
-    const c    = Math.round((food?.carbs_g_100g||0)      * factor);
-    const f    = Math.round((food?.fat_g_100g||0)        * factor);
-
-    const { error } = await supabase.from("entries").insert({
-      user_id: uid,
-      date: $("#diary-date").value,
-      meal_slot: meal,
-      food_id: foodId,
-      servings,
-      kcal, protein_g: p, carbs_g: c, fat_g: f
-    });
-    if (error) return alert("Erro ao inserir: " + error.message);
-
-    await loadEntries();
-  });
-
-  $("#diary-date")?.addEventListener("change", loadEntries);
-
-  await loadFoods();
-  await loadEntries();
-
-  async function loadFoods() {
-    const q = ($("#food-search").value || "").trim();
-    let query = supabase.from("foods")
-      .select("id, name, brand, serving_desc, serving_g")
-      .order("name", { ascending: true })
-      .limit(30);
-    if (q) query = query.ilike("name", `%${q}%`);
-    const { data, error } = await query;
-    const sel = $("#food-select");
-    sel.innerHTML = "";
-    if (error) return;
+  if (!initialized) {
+    initialized = true;
+
+    // busca de alimentos
+    $("#food-search")?.addEventListener("input", debounce(loadFoods, 250));
+    $("#food-select")?.addEventListener("change", () => {
+      const has = $("#food-select").value;
+      $("#servings").disabled = !has;
+    });
+
+    $("#btn-insert-entry")?.addEventListener("click", handleInsertEntry);
+    $("#diary-date")?.addEventListener("change", loadEntries);
+  }
+
+  await loadFoods();
+  await loadEntries();
+
+  async function loadFoods() {
+    const q = ($("#food-search").value || "").trim();
+    let query = client.from("foods")
+      .select("id, name, brand, serving_desc, serving_g")
+      .order("name", { ascending: true })
+      .limit(30);
+    if (q) query = query.ilike("name", `%${q}%`);
+    const { data, error } = await query;
+    const sel = $("#food-select");
+    sel.innerHTML = "";
+    if (error) {
+      console.error("Erro ao carregar alimentos", error);
+      return;
+    }
 
     for (const f of data || []) {
       const opt = document.createElement("option");
       opt.value = f.id;
       opt.textContent = `${f.name}${f.brand ? " • "+f.brand : ""} (${f.serving_desc||"-"} · ${f.serving_g||"-"}g)`;
       sel.appendChild(opt);
     }
     $("#servings").disabled = !(sel.value);
-  }
-
-  async function loadEntries() {
-    const date = $("#diary-date").value;
-    const { data, error } = await supabase
-      .from("entries")
-      .select("id, meal_slot, servings, kcal, protein_g, carbs_g, fat_g, foods(name)")
-      .eq("user_id", uid).eq("date", date)
-      .order("created_at", { ascending: true });
-
-    const tbody = $("#entries-table tbody");
-    tbody.innerHTML = "";
-    if (error) return;
+  }
+
+  async function loadEntries() {
+    const date = $("#diary-date").value;
+    const { data, error } = await client
+      .from("entries")
+      .select("id, meal_slot, servings, kcal, protein_g, carbs_g, fat_g, foods(name)")
+      .eq("user_id", userId).eq("date", date)
+      .order("created_at", { ascending: true });
+
+    const tbody = $("#entries-table tbody");
+    tbody.innerHTML = "";
+    if (error) {
+      console.error("Erro ao carregar diário", error);
+      return;
+    }
 
     let sumK=0, sumP=0, sumC=0, sumF=0;
     for (const e of data || []) {
       const tr = document.createElement("tr");
       tr.innerHTML = `
         <td>${ptMeal(e.meal_slot)}</td>
         <td>${e.foods?.name || "-"}</td>
         <td>${e.servings}</td>
         <td>${e.kcal ?? 0}</td>
         <td>${e.protein_g ?? 0}</td>
         <td>${e.carbs_g ?? 0}</td>
         <td>${e.fat_g ?? 0}</td>`;
       tbody.appendChild(tr);
 
       sumK += e.kcal||0; sumP += e.protein_g||0; sumC += e.carbs_g||0; sumF += e.fat_g||0;
     }
-
-    // metas do dia: usa perfil salvo
-    const { data: prof } = await supabase.from("profiles")
-      .select("weight_kg, height_cm, age, sex, activity_routine, training_freq, goal_pct")
-      .eq("user_id", uid).maybeSingle();
-    let target = "—";
-    if (prof) {
-      const { kcal } = calcDailyTarget(prof);
-      target = kcal;
-    }
+
+    // metas do dia: usa perfil salvo
+    const { data: prof, error: profError } = await client.from("profiles")
+      .select("weight_kg, height_cm, age, sex, activity_routine, training_freq, goal_pct")
+      .eq("user_id", userId).maybeSingle();
+    let target = "—";
+    if (profError) {
+      console.error("Erro ao carregar meta diária", profError);
+    } else if (prof) {
+      const { kcal } = calcDailyTarget(prof);
+      target = kcal;
+    }
 
     $("#sum-target").textContent = target;
     $("#sum-kcal").textContent   = sumK;
     $("#sum-p").textContent      = sumP;
-    $("#sum-c").textContent      = sumC;
-    $("#sum-f").textContent      = sumF;
-  }
-
-  function ptMeal(m) {
-    return m==="breakfast"?"Café":m==="lunch"?"Almoço":m==="dinner"?"Jantar":"Lanche";
-  }
-}
+    $("#sum-c").textContent      = sumC;
+    $("#sum-f").textContent      = sumF;
+  }
+
+  async function handleInsertEntry() {
+    const foodId = $("#food-select").value;
+    const servings = toNumber($("#servings").value);
+    const meal = $("#meal-slot").value;
+
+    if (!foodId || servings <= 0) {
+      alert("Escolha um alimento e informe porções > 0");
+      return;
+    }
+
+    const { data: food, error: foodError } = await client
+      .from("foods")
+      .select("id, name, serving_g, energy_kcal_100g, protein_g_100g, carbs_g_100g, fat_g_100g")
+      .eq("id", foodId)
+      .maybeSingle();
+
+    if (foodError) {
+      alert("Não foi possível carregar o alimento selecionado: " + foodError.message);
+      return;
+    }
+
+    const factor = ((food?.serving_g || 100) / 100) * servings;
+    const kcal = Math.round((food?.energy_kcal_100g || 0) * factor);
+    const p = Math.round((food?.protein_g_100g || 0) * factor);
+    const c = Math.round((food?.carbs_g_100g || 0) * factor);
+    const f = Math.round((food?.fat_g_100g || 0) * factor);
+
+    const { error } = await client.from("entries").insert({
+      user_id: userId,
+      date: $("#diary-date").value,
+      meal_slot: meal,
+      food_id: foodId,
+      servings,
+      kcal,
+      protein_g: p,
+      carbs_g: c,
+      fat_g: f,
+    });
+
+    if (error) {
+      alert("Erro ao inserir: " + error.message);
+      return;
+    }
+
+    await loadEntries();
+  }
+
+  function ptMeal(m) {
+    return m==="breakfast"?"Café":m==="lunch"?"Almoço":m==="dinner"?"Jantar":"Lanche";
+  }
+}
 
 // mesmo alvo diário do profile.js (versão reduzida)
 function calcDailyTarget(p){
   const w = toNumber(p.weight_kg), h = toNumber(p.height_cm), a = toNumber(p.age);
   const bmr = Math.round((p.sex==="male" ? (10*w+6.25*h-5*a+5) : (10*w+6.25*h-5*a-161)));
   const base =
     p.activity_routine === "very_active" ? 1.7 :
     p.activity_routine === "active"      ? 1.55 :
     p.activity_routine === "moderate"    ? 1.45 :
     p.activity_routine === "light"       ? 1.35 : 1.25;
   const tf = String(p.training_freq||"0");
   const bonus = (tf==="5+"?0.10:tf==="3-4"?0.07:tf==="1-2"?0.04:0);
   const tdee = Math.round(bmr*(base+bonus));
   const kcal = Math.round(tdee*(1 + (toNumber(p.goal_pct)/100)));
   return { kcal };
 }
 
 // util
 function debounce(fn, ms){
   let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
 }
