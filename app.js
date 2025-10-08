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

  let { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error && error.status === 400) {
    const signup = await supabase.auth.signUp({ email, password });
    if (signup.error) { msg.textContent = "Erro: " + signup.error.message; return; }
    ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
  }
  msg.textContent = error ? ("Erro: " + error.message) : "Pronto!";
});

// --- LOGOUT ROBUSTO ---
function clearSupabaseStorage() {
  const prefix = "sb-ttchylymyftizjsqbngp";
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) {
      try { localStorage.removeItem(k); } catch {}
    }
  }
}

document.getElementById("btn-logout").addEventListener("click", async () => {
  try {
    await supabase.auth.signOut();
  } finally {
    clearSupabaseStorage();
    document.getElementById("nav").classList.add("hidden");
    document.getElementById("nav-user").textContent = "";
    show("view-auth"); hide("view-diary"); hide("view-profile");
    // força o client a reavaliar sessão
    setTimeout(() => location.href = location.href.split("#")[0], 50);
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
    document.getElementById("nav").classList.remove("hidden");
    mountScreensOnce();
    show("view-diary"); hide("view-auth"); hide("view-profile");
    document.getElementById("nav-user").textContent = session.user.email;

    // alvo kcal no resumo, se existir no perfil
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
    document.getElementById("nav").classList.add("hidden");
    show("view-auth"); hide("view-diary"); hide("view-profile");
  }
});
