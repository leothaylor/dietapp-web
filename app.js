// app.js  —  mínimo e estável
import { mountProfile } from "./components/profile.js";
import { mountDiary } from "./components/diary.js";

// ----------------------------------------------------
// 1) Supabase client (usa window.APP_CONFIG vindo do config.js)
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
const supabase = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// helpers DOM
const $ = (sel) => document.querySelector(sel);
const show = (id) => {
  $("#view-auth").classList.add("hidden");
  $("#view-diary").classList.add("hidden");
  $("#view-profile").classList.add("hidden");
  $(id).classList.remove("hidden");
};

// ----------------------------------------------------
// 2) Navegação (uma vez só)
function wireNav() {
  $("#nav-diario").onclick = () => {
    show("#view-diary");
    mountDiary(supabase); // garante refresh da lista
  };
  $("#nav-perfil").onclick = () => {
    show("#view-profile");
    mountProfile(supabase);
  };
  $("#btn-logout").onclick = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error(e);
    } finally {
      $("#nav").classList.add("hidden");
      $("#nav-user").textContent = "";
      show("#view-auth");
      $("#auth-msg").textContent = "";
    }
  };
}

// ----------------------------------------------------
// 3) Auth: entrar / criar
function wireAuth() {
  const email = $("#auth-email");
  const pass  = $("#auth-pass");
  const msg   = $("#auth-msg");

  $("#btn-login").onclick = async () => {
    msg.textContent = "Entrando...";
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.value.trim(),
        password: pass.value
      });
      if (error) throw error;
    } catch (e) {
      msg.textContent = `Erro ao entrar: ${e.message}`;
    }
  };

  $("#btn-signup").onclick = async () => {
    msg.textContent = "Criando conta...";
    try {
      const { error } = await supabase.auth.signUp({
        email: email.value.trim(),
        password: pass.value
      });
      if (error) throw error;
      msg.textContent = "Conta criada! Agora clique em Entrar.";
    } catch (e) {
      msg.textContent = `Erro ao criar conta: ${e.message}`;
    }
  };
}

// ----------------------------------------------------
// 4) Reagir à sessão (uma vez só)
let authHookWired = false;
function wireAuthHook() {
  if (authHookWired) return;
  authHookWired = true;

  supabase.auth.onAuthStateChange(async (_evt, session) => {
    if (session?.user) {
      // autenticado
      $("#nav").classList.remove("hidden");
      $("#nav-user").textContent = session.user.email || session.user.id;

      // monta telas
      mountDiary(supabase);
      mountProfile(supabase);

      // abre Diário por padrão
      show("#view-diary");
    } else {
      // não autenticado
      $("#nav").classList.add("hidden");
      $("#nav-user").textContent = "";
      show("#view-auth");
    }
  });
}

// ----------------------------------------------------
(function boot() {
  if (!supabase) {
    $("#auth-msg").textContent = "Supabase não carregou. Verifique config.js e script da lib.";
    return;
  }
  wireNav();
  wireAuth();
  wireAuthHook();
})();
