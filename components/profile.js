// components/profile.js
import { fmt, toNumber, setText } from "../utils/helpers.js";
import { supabase } from "../app.js";

function bmr({ sex, weight_kg, height_cm, age }) {
  const s = sex === "male" ? 5 : -161;
  return 10*weight_kg + 6.25*height_cm - 5*age + s;
}
function activityFactor(routine, freq) {
  const base = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }[routine] || 1.2;
  const bump = { "0":0, "1-2":0.0, "3-4":0.05, "5+":0.1 }[freq] || 0;
  return base + bump;
}

export async function mountProfile() {
  const $ = (s) => document.querySelector(s);
  const msg = $("#profile-msg");
  const btnCalc = $("#btn-calc");
  const btnSave = $("#btn-save-profile");

  // mostra/oculta quadril p/ sexo
  const fieldHip = document.getElementById("field-hip");
  document.getElementById("sex").addEventListener("change", () => {
    fieldHip.classList.toggle("hidden", document.getElementById("sex").value !== "female");
  });

  // carrega do banco
  const user = (await supabase.auth.getUser()).data.user;
  const { data: rows } = await supabase.from("profiles").select("*").eq("user_id", user.id).limit(1);
  if (rows?.[0]) fillForm(rows[0]);

  function fillForm(p) {
    for (const k of ["name","sex","age","height_cm","weight_kg","neck_cm","waist_cm","hip_cm","activity_routine","training_freq","goal_type","goal_pct"]) {
      const el = document.getElementById(k);
      if (!el) continue;
      el.value = p[k] ?? el.value;
    }
    renderCalc();
  }

  function readForm() {
    return {
      name: $("#name").value.trim(),
      sex: $("#sex").value,
      age: toNumber($("#age").value),
      height_cm: toNumber($("#height_cm").value),
      weight_kg: toNumber($("#weight_kg").value),
      neck_cm: toNumber($("#neck_cm").value),
      waist_cm: toNumber($("#waist_cm").value),
      hip_cm: toNumber($("#hip_cm").value),
      activity_routine: $("#activity_routine").value,
      training_freq: $("#training_freq").value,
      goal_type: $("#goal_type").value,
      goal_pct: toNumber($("#goal_pct").value)
    };
  }

  function renderCalc() {
    const p = readForm();
    const b = bmr(p);
    const af = activityFactor(p.activity_routine, p.training_freq);
    const tdee = b * af;
    const adj = tdee * ((p.goal_pct||0)/100);
    const kcal = Math.round(tdee + adj);

    // macros simples: P=2g/kg, F=0.9g/kg, resto C
    const prot = Math.round(Math.max(0, p.weight_kg*2));
    const fat  = Math.round(Math.max(0, p.weight_kg*0.9));
    const carbs = Math.max(0, Math.round((kcal - prot*4 - fat*9)/4));

    setText("#o_bmr", b.toFixed(0));
    setText("#o_tdee_base", tdee.toFixed(0));
    setText("#o_kcal", kcal);
    setText("#o_p", prot);
    setText("#o_f", fat);
    setText("#o_c", carbs);
  }

  btnCalc.addEventListener("click", renderCalc);

  // meta → ajusta goal_pct automaticamente
  document.getElementById("goal_type").addEventListener("change", (e) => {
    const map = { cut: -15, maintenance: 0, bulk: 12 };
    document.getElementById("goal_pct").value = map[e.target.value] ?? 0;
    renderCalc();
  });

  btnSave.addEventListener("click", async () => {
    msg.textContent = "";
    btnSave.disabled = true;
    btnSave.textContent = "Salvando...";

    try {
      const p = readForm();
      // recalcula antes de gravar
      const b = bmr(p);
      const af = activityFactor(p.activity_routine, p.training_freq);
      const tdee = Math.round(b * af);
      const kcal = Math.round(tdee + tdee*((p.goal_pct||0)/100));
      const prot = Math.round(Math.max(0, p.weight_kg*2));
      const fat  = Math.round(Math.max(0, p.weight_kg*0.9));
      const carbs = Math.max(0, Math.round((kcal - prot*4 - fat*9)/4));

      const { error } = await supabase.from("profiles").upsert({
        user_id: (await supabase.auth.getUser()).data.user.id,
        ...p,
        tdee_kcal: tdee,
        bodyfat_pct: null,
        protein_g: prot,
        fat_g: fat,
        carbs_g: carbs
      }, { onConflict: "user_id" });

      if (error) throw error;
      msg.textContent = "Salvo!";
      renderCalc();
    } catch (e) {
      msg.textContent = e.message || "Erro ao salvar.";
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = "Salvar";
    }
  });

  // calcula na primeira carga
  renderCalc();
}
