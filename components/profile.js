// components/profile.js
import { fmt, toNumber, setText } from "../utils/helpers.js";
import { bfNavy, bfDeurenberg, mediana, bmr, activityFactor, macrosDefault } from "../utils/formulas.js";

export function mountProfile({ supabase }) {
  const fieldHip = $("#field-hip");
  $("#sex").addEventListener("change", () => {
    fieldHip.classList.toggle("hidden", $("#sex").value !== "female");
  });

  // Sugerir ajuste de meta com base no tipo
  $("#goal_type").addEventListener("change", () => {
    const map = { cut: -15, maintenance: 0, bulk: 10 };
    $("#goal_pct").value = map[$("#goal_type").value] ?? 0;
  });

  supabase.auth.onAuthStateChange(async (_evt, session) => {
    if (!session) return;
    const { data } = await supabase
      .from("profiles").select("*")
      .eq("user_id", session.user.id).maybeSingle();

    if (data) fill(data); else $("#profile-msg").textContent = "Complete seu perfil e salve.";
    $("#nav-user").textContent = session.user.email;
  });

  function readForm() {
    return {
      name: $("#name").value.trim() || null,
      sex: $("#sex").value,
      age: Number($("#age").value),
      height_cm: Number($("#height_cm").value),
      weight_kg: Number($("#weight_kg").value),
      neck_cm: Number($("#neck_cm").value),
      waist_cm: Number($("#waist_cm").value),
      hip_cm: toNumber($("#hip_cm").value),
      activity_routine: $("#activity_routine").value,
      training_freq: $("#training_freq").value,
      goal_type: $("#goal_type").value,
      goal_pct: Number($("#goal_pct").value || 0),
    };
  }

  function fill(p) {
    $("#name").value = p.name ?? "";
    $("#sex").value = p.sex ?? "";
    $("#age").value = p.age ?? "";
    $("#height_cm").value = p.height_cm ?? "";
    $("#weight_kg").value = p.weight_kg ?? "";
    $("#neck_cm").value = p.neck_cm ?? "";
    $("#waist_cm").value = p.waist_cm ?? "";
    $("#hip_cm").value = p.hip_cm ?? "";
    $("#activity_routine").value = p.activity_routine ?? "moderate";
    $("#training_freq").value = p.training_freq ?? "3-4";
    $("#goal_type").value = p.goal_type ?? "maintenance";
    $("#goal_pct").value = 0;

    setText("o_bf_final", fmt(p.bodyfat_pct, 1));
    setText("o_tdee_base", fmt(p.tdee_kcal, 0));
    setText("o_kcal", fmt(p.tdee_kcal ?? 0, 0));
  }

  $("#btn-calc").addEventListener("click", () => {
    const f = readForm();
    if (!f.sex) { $("#profile-msg").textContent = "Escolha sexo."; return; }

    const navy = bfNavy({ sex: f.sex, height_cm: f.height_cm, neck_cm: f.neck_cm, waist_cm: f.waist_cm, hip_cm: f.hip_cm });
    const deur = bfDeurenberg({ sex: f.sex, age: f.age, height_cm: f.height_cm, weight_kg: f.weight_kg });
    const bf_final = mediana(navy, deur);

    const bmrVal = bmr({ sex: f.sex, height_cm: f.height_cm, weight_kg: f.weight_kg, age: f.age });
    const af = activityFactor(f.activity_routine, f.training_freq);
    const tdee_base = bmrVal * af;
    const kcal_alvo = Math.round(tdee_base * (1 + (f.goal_pct / 100)));

    const { prot_g, carb_g, gord_g } = macrosDefault(f.weight_kg, kcal_alvo);

    setText("o_bf_navy", fmt(navy, 1));
    setText("o_bf_deur", fmt(deur, 1));
    setText("o_bf_final", fmt(bf_final, 1));
    setText("o_bmr", fmt(bmrVal, 0));
    setText("o_tdee_base", fmt(tdee_base, 0));
    setText("o_kcal", kcal_alvo);
    setText("o_p", prot_g); setText("o_c", carb_g); setText("o_f", gord_g);

    $("#btn-save-profile").dataset.kcal = kcal_alvo;
    $("#btn-save-profile").dataset.bf = bf_final;
    $("#btn-save-profile").dataset.p = prot_g;
    $("#btn-save-profile").dataset.c = carb_g;
    $("#btn-save-profile").dataset.f = gord_g;
  });

  $("#btn-save-profile").addEventListener("click", async () => {
    const f = readForm();
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return;

    const updateFields = {
      user_id: session.user.id,
      name: f.name, sex: f.sex, age: f.age,
      height_cm: f.height_cm, weight_kg: f.weight_kg,
      neck_cm: f.neck_cm, waist_cm: f.waist_cm, hip_cm: f.hip_cm,
      activity_routine: f.activity_routine,
      training_freq: f.training_freq, goal_type: f.goal_type,
      tdee_kcal: Number($("#btn-save-profile").dataset.kcal || 0),
      bodyfat_pct: Number($("#btn-save-profile").dataset.bf || 0),
      protein_g: Number($("#btn-save-profile").dataset.p || 0),
      carbs_g: Number($("#btn-save-profile").dataset.c || 0),
      fat_g: Number($("#btn-save-profile").dataset.f || 0),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("profiles").upsert(updateFields, { onConflict: "user_id" });
    $("#profile-msg").textContent = error ? ("Erro: " + error.message) : "Salvo!";
  });
}
