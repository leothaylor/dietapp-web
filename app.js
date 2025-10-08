// app.js
import { mountProfile } from "./components/profile.js";
import { mountDiary } from "./components/diary.js";

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true }
});

// helpers de UI
function show(id) { document.getElementById(id).classList.remove("hidden"); }
function hide(id) { document.getElementById(id).classList.add("hidden"); }

// navegação top
document.getElementById("nav-diario").addEventListener("click", () => {
  show("view-diary"); hide("view-profile"); hide("view-auth");
});
document.getElementById("nav-perfil").addEventListener("click", () => {
  show("view-profile"); hide("view-diary"); hide("view-auth");
});

// auth: login / signup
document.getElementById("form-auth").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-pass").value;

  const msg = document.getElementById("auth-msg");
  msg.textContent = "Autenticando...";

  // tenta login
  let { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error && error.status === 400) {
    // cria conta
    const signup = await supabase.auth.signUp({ email, password });
    if (signup.error) { msg.textContent = "Erro: " + signup.error.message; return; }
    // tenta login novamente
    ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
  }
  msg.textContent = error ? ("Erro: " + error.message) : "Pronto!";
});

// logout
document.getElementById("btn-logout").addEventListener("click", async () => {
  try {
    await supabase.auth.signOut();
  } finally {
    document.getElementById("nav").classList.add("hidden");
    show("view-auth"); hide("view-diary"); hide("view-profile");
    // limpa email do topo
    document.getElementById("nav-user").textContent = "";
  }
});

// monta telas (uma vez)
let mounted = false;
function mountScreensOnce() {
  if (mounted) return;
  mountProfile({ supabase });
  mountDiary({ supabase });
  mounted = true;
}

// reação a login/logout
supabase.auth.onAuthStateChange(async (_evt, session) => {
  if (session) {
    // logado
    document.getElementById("nav").classList.remove("hidden");
    mountScreensOnce();
    show("view-diary"); hide("view-auth"); hide("view-profile");

    // opcional: preencher alvo kcal no resumo com tdee do perfil
    const { data } = await supabase
      .from("profiles")
      .select("tdee_kcal")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (data?.tdee_kcal) {
      const el = document.getElementById("sum-target");
      if (el) el.textContent = Math.round(data.tdee_kcal);
    }
  } else {
    // deslogado
    document.getElementById("nav").classList.add("hidden");
    show("view-auth"); hide("view-diary"); hide("view-profile");
  }
});
