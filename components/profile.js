// components/profile.js
const $ = (sel) => document.querySelector(sel);

// fórmulas simples e estáveis
function toNumber(v) { const n = Number(String(v).replace(",", ".")); return isFinite(n) ? n : 0; }

function bfNavy({ sex, neck_cm, waist_cm, hip_cm, height_cm }) {
  const h = toNumber(height_cm), n = toNumber(neck_cm), w = toNumber(waist_cm), hp = toNumber(hip_cm);
  if (sex === "female") {
    if (w <= 0 || n <= 0 || hp <= 0 || h <= 0) return 0;
    return Math.max(0, 163.205 * Math.log10(w + hp - n) - 97.684 * Math.log10(h) - 78.387);
  } else {
    if (w <= 0 || n <= 0 || h <= 0) return 0;
    return Math.max(0, 86.010 * Math.log10(w - n) - 70.041 * Math.log10(h) + 36.76);
  }
}
function bfDeurenberg({ age, sex, weight_kg, height_cm }) {
  const bmi = toNumber(weight_kg) / ((toNumber(height_cm)/100)**2 || 1);
  const s = sex === "male" ? 1 : 0;
  return Math.max(0, 1.2*bmi + 0.23*toNumber(age) - 10.8*s - 5.4);
}
function bmr({ sex, weight_kg, height_cm, age }) {
  const w = toNumber(weight_kg), h = toNumber(height_cm), a = toNumber(age);
  return Math.round(sex === "male" ? (10*w + 6.25*h - 5*a + 5) : (10*w + 6.25*h - 5*a - 161));
}
function activityFactor({ activity_routine, training_freq }) {
  const tf = String(training_freq||"0");
  const base =
    activity_routine === "very_active" ? 1.7 :
    activity_routine === "active"      ? 1.55 :
    activity_routine === "moderate"    ? 1.45 :
    activity_routine === "light"       ? 1.35 : 1.25;
  const bonus = (tf === "5+" ? 0.10 : tf === "3-4" ? 0.07 : tf === "1-2" ? 0.04 : 0);
  return +(base + bonus).toFixed(2);
}

function calcTargets(p) {
  const bmrKcal = bmr(p);
  const af = activityFactor(p);
  const tdee = Math.round(bmrKcal * af);
  const adj  = 1 + (toNumber(p.goal_pct)/100);
  const kcal = Math.max(1000, Math.round(tdee * adj));
  // macros simples: P=2g/kg, F=0.8g/kg, resto carbo
  const prot = Math.round(toNumber(p.weight_kg) * 2);
  const fat  = Math.round(toNumber(p.weight_kg) * 0.8);
  const carbs= Math.max(0, Math.round((kcal - prot*4 - fat*9)/4));
  return { bmrKcal, tdee, kcal, prot, carbs, fat };
}

export async function mountProfile({ supabase, session }) {
  const uid = session.user.id;

  // mostra campo quadril só para mulher
  const fieldHip = $("#field-hip");
  $("#sex")?.addEventListener("change", ()=>{
    const female = $("#sex").value === "female";
    fieldHip.classList.toggle("hidden", !female);
  });

  // carregar perfil
  async function loadProfile() {
    const { data, error } = await supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle();
    if (error) return;
    const p = data || {};
    // preencher
    $("#name").value = p.name || "";
    $("#sex").value = p.sex || "";
    $("#age").value = p.age ?? "";
    $("#height_cm").value = p.height_cm ?? "";
    $("#weight_kg").value = p.weight_kg ?? "";
    $("#neck_cm").value = p.neck_cm ?? "";
    $("#waist_cm").value = p.waist_cm ?? "";
    $("#hip_cm").value = p.hip_cm ?? "";
    $("#activity_routine").value = p.activity_routine || "sedentary";
    $("#training_freq").value = p.training_freq || "0";
    $("#goal_type").value = p.goal_type || "maintenance";
    $("#goal_pct").value = p.goal_pct ?? 0;

    // mostra cálculos se já houver
    renderCalc(p);
  }

  function readForm() {
    return {
      user_id: uid,
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
      goal_pct: toNumber($("#goal_pct").value),
    };
  }

  function renderCalc(p) {
    const navy = Math.round(bfNavy(p)*10)/10;
    const deur = Math.round(bfDeurenberg(p)*10)/10;
    const bf   = Math.round(((navy||0)+(deur||0))/2 *10)/10;
    const { bmrKcal, tdee, kcal, prot, carbs, fat } = calcTargets(p);

    $("#o_bf_navy").textContent = isFinite(navy)?navy:"—";
    $("#o_bf_deur").textContent = isFinite(deur)?deur:"—";
    $("#o_bf_final").textContent= isFinite(bf)?bf:"—";
    $("#o_bmr").textContent     = isFinite(bmrKcal)?bmrKcal:"—";
    $("#o_tdee_base").textContent= isFinite(tdee)?tdee:"—";
    $("#o_kcal").textContent    = isFinite(kcal)?kcal:"—";
    $("#o_p").textContent       = isFinite(prot)?prot:"—";
    $("#o_c").textContent       = isFinite(carbs)?carbs:"—";
    $("#o_f").textContent       = isFinite(fat)?fat:"—";
  }

  $("#btn-calc")?.addEventListener("click", (e)=>{
    e.preventDefault();
    const p = readForm();
    renderCalc(p);
  });

  $("#goal_type")?.addEventListener("change", ()=>{
    const m = $("#goal_type").value;
    $("#goal_pct").value = (m==="cut") ? -15 : (m==="bulk" ? 12 : 0);
    renderCalc(readForm());
  });

  $("#btn-save-profile")?.addEventListener("click", async (e)=>{
    e.preventDefault();
    const p = readForm();
    renderCalc(p);
    $("#profile-msg").textContent = "Salvando...";
    const { error } = await supabase.from("profiles").upsert(p, { onConflict: "user_id" });
    $("#profile-msg").textContent = error ? ("Erro: "+error.message) : "Salvo!";
    setTimeout(()=>$("#profile-msg").textContent="", 1800);
  });

  await loadProfile();
}
