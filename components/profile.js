// components/profile.js
import { bfNavy, bfDeurenberg, mediana, bmr, activityFactor, macrosDefault, toNumber, fmt } from "../utils/helpers.js";
// ↑ se você ainda não tem helpers, remova essa linha e troque pelos cálculos que já usava.
// Abaixo deixei cálculos simples inline para evitar dependência:

function calcAll() {
  // pegue valores do formulário
  const sex = $("#sex").value;
  const age = +$("#age").value || 0;
  const height = +$("#height_cm").value || 0;
  const neck = +$("#neck_cm").value || 0;
  const waist = +$("#waist_cm").value || 0;
  const weight = +$("#weight_kg").value || 0;
  const routine = $("#activity_routine").value;
  const goalPct = +$("#goal_pct").value || 0;
  const trainings = $("#training_freq").value;

  // cálculos MUITO simplificados apenas para não travar:
  const bfN = Math.max(0, Math.min(60, 495/(1.0324 - 0.19077*Math.log10(waist-neck||1) + 0.15456*Math.log10(height||1)) - 450 || 0)); // navy aprox
  const bfD = Math.max(0, Math.min(60, 1.2*(weight/((height/100)**2)) + 0.23*age - 16.2 - (sex==="male"?10.8:0)));
  const bfFinal = Math.round((bfN + bfD)/2 *10)/10;

  const bmrEst = Math.round((sex==="male" ? (10*weight + 6.25*height - 5*age + 5) : (10*weight + 6.25*height - 5*age -161)));
  const af = ({"sedentary":1.2,"light":1.375,"moderate":1.55,"active":1.725,"very_active":1.9}[routine]||1.2);
  const tdeeBase = Math.round(bmrEst * af);
  const kcalTarget = Math.round(tdeeBase * (1 + goalPct/100));
  const protein = Math.round(weight*2); // g
  const fat = Math.round(weight*0.9);   // g
  const carbs = Math.max(0, Math.round((kcalTarget - (protein*4 + fat*9))/4));

  // escreve na tela
  $("#o_bf_navy").textContent = bfN ? `${bfN.toFixed(1)}` : "—";
  $("#o_bf_deur").textContent = bfD ? `${bfD.toFixed(1)}` : "—";
  $("#o_bf_final").textContent = bfFinal ? `${bfFinal.toFixed(1)}` : "—";
  $("#o_bmr").textContent = bmrEst ? `${bmrEst}` : "—";
  $("#o_tdee_base").textContent = tdeeBase ? `${tdeeBase}` : "—";
  $("#o_kcal").textContent = isFinite(kcalTarget) ? `${kcalTarget}` : "—";
  $("#o_p").textContent = isFinite(protein) ? `${protein}` : "—";
  $("#o_c").textContent = isFinite(carbs) ? `${carbs}` : "—";
  $("#o_f").textContent = isFinite(fat) ? `${fat}` : "—";

  // devolve pra salvar
  return { bmrEst, tdeeBase, kcalTarget, protein, carbs, fat, bfN, bfD, bfFinal };
}

const $ = (s)=>document.querySelector(s);

export function mountProfile(supabase){
  // listeners de UI (uma única vez)
  if (!mountProfile._wired) {
    $("#btn-calc").onclick = calcAll;

    $("#btn-save-profile").onclick = async () => {
      $("#profile-msg").textContent = "Salvando...";
      try {
        const session = (await supabase.auth.getSession()).data.session;
        if (!session) throw new Error("Sem sessão");

        const user_id = session.user.id;

        const out = calcAll(); // garante cálculo antes de gravar

        const payload = {
          user_id,
          name: $("#name").value || null,
          sex: $("#sex").value || null,
          age: +$("#age").value || null,
          height_cm: +$("#height_cm").value || null,
          neck_cm: +$("#neck_cm").value || null,
          waist_cm: +$("#waist_cm").value || null,
          hip_cm: null, // não usamos agora
          activity_routine: $("#activity_routine").value || "sedentary",
          training_freq: $("#training_freq").value || "0",
          goal_type: $("#goal_type").value || "cut",
          goal_pct: +$("#goal_pct").value || 0,
          tdee_kcal: out.kcalTarget,
          bodyfat_pct: out.bfFinal,
          protein_g: out.protein,
          carbs_g: out.carbs,
          fat_g: out.fat
        };

        const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });
        if (error) throw error;

        $("#profile-msg").textContent = "Salvo!";
        setTimeout(()=> $("#profile-msg").textContent = "", 1500);
      } catch (e) {
        $("#profile-msg").textContent = `Erro: ${e.message}`;
      }
    };

    mountProfile._wired = true;
  }

  // carregar perfil do banco
  (async ()=>{
    try{
      const session = (await supabase.auth.getSession()).data.session;
      if(!session) return;
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", session.user.id).maybeSingle();
      if (error) throw error;
      if (!data) return;

      $("#name").value = data.name ?? "";
      $("#sex").value = data.sex ?? "";
      $("#age").value = data.age ?? "";
      $("#height_cm").value = data.height_cm ?? "";
      $("#neck_cm").value = data.neck_cm ?? "";
      $("#waist_cm").value = data.waist_cm ?? "";
      $("#activity_routine").value = data.activity_routine ?? "sedentary";
      $("#training_freq").value = data.training_freq ?? "0";
      $("#goal_type").value = data.goal_type ?? "cut";
      $("#goal_pct").value = data.goal_pct ?? -15;

      // re-calcula pra preencher os cards
      calcAll();
    }catch(e){
      console.error(e);
      $("#profile-msg").textContent = `Erro ao carregar: ${e.message}`;
    }
  })();
}
