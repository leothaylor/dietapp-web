// app.js
import { mountProfile } from "./components/profile.js";
import { mountDiary } from "./components/diary.js";

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  }
});

// -------- util de navegação
function show(viewId) {
  const views = ["view-auth", "view-profile", "view-diary"];
  views.forEach(id => document.getElementById(id).classList.add("hidden"));
  document.getElementById(viewId).classList.remove("hidden");

  const nav = document.getElementById("nav");
  nav.classList.toggle("hidden", viewId === "view-auth");
}

function setUserEmail(email) {
  document.getElementById("nav-user").textContent = email || "";
}

// -------- Auth form
const authForm = document.getElementById("form-auth");
const authMsg  = document.getElementById("auth-msg");

authForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  authMsg.textContent = "Entrando...";
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-pass").value;

  try {
    // tenta login
    let { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error && error.message?.includes("Invalid login")) {
      // cria conta se não existir
      ({ data, error } = await supabase.auth.signUp({ email, password }));
      if (error) throw error;
    }
    if (!data?.session) {
      // força recuperar sessão logo em seguida
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session) throw new Error("Falha ao criar/obter sessão.");
    }
    authMsg.textContent = "";
    // navega – deixa o listener decidir a tela
  } catch (err) {
    authMsg.textContent = err.message || "Erro ao autenticar.";
  } finally {
    // limpa campos por segurança
    authForm.reset();
  }
});

// -------- Logout
document.getElementById("btn-logout")?.addEventListener("click", async () => {
  try {
    await supabase.auth.signOut();
  } finally {
    // garante limpeza local e volta ao login
    try { localStorage.removeItem("sb-" + SUPABASE_URL + "-auth-token"); } catch {}
    try { sessionStorage.clear(); } catch {}
    setUserEmail("");
    show("view-auth");
    // Em GH Pages, recarregar ajuda a limpar o estado
    location.replace("https://leothaylor.github.io/dietapp-web/");
  }
});

// -------- Tabs
document.getElementById("nav-perfil")?.addEventListener("click", () => show("view-profile"));
document.getElementById("nav-diario")?.addEventListener("click", () => show("view-diary"));

// -------- Session listener
supabase.auth.onAuthStateChange(async (_event, session) => {
  const user = session?.user || null;
  if (!user) {
    setUserEmail("");
    show("view-auth");
    return;
  }
  setUserEmail(user.email || "");
  // monta telas uma única vez
  if (!window._profileMounted) { await mountProfile(supabase); window._profileMounted = true; }
  if (!window._diaryMounted)   { await mountDiary(supabase);   window._diaryMounted   = true; }

  // abre Diário por padrão
  show("view-diary");
});

// -------- boot inicial: respeita sessão já existente
(async () => {
  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) {
    setUserEmail(data.session.user.email || "");
    if (!window._profileMounted) { await mountProfile(supabase); window._profileMounted = true; }
    if (!window._diaryMounted)   { await mountDiary(supabase);   window._diaryMounted   = true; }
    show("view-diary");
  } else {
    show("view-auth");
  }
})();
