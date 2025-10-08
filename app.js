// app.js – foco: autenticação estável e troca de telas

// ===== Supabase =====
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,       // guarda sessão no localStorage
    autoRefreshToken: true,
    detectSessionInUrl: false,  // não usamos magic link na UI
  },
});

// ===== Util =====
const $ = (sel) => document.querySelector(sel);
const setText = (sel, txt = "") => { const el = $(sel); if (el) el.textContent = txt; };

// Regiões/telas
const nav = $("#nav");
const viewAuth   = $("#view-auth");
const viewDiary  = $("#view-diary");
const viewProfil = $("#view-profile");

// Campos e botões de auth
const emailEl = $("#auth-email");
const passEl  = $("#auth-pass");
const msgEl   = $("#auth-msg");
const btnLogin = $("#btn-login");    // <button id="btn-login">Entrar</button>
const btnSign  = $("#btn-signup");   // <button id="btn-signup">Criar conta</button>
const btnLogout = $("#btn-logout");

// ===== Render UI por sessão =====
function render(session) {
  if (session && session.user) {
    // logado
    nav.classList.remove("hidden");
    viewAuth.classList.add("hidden");
    // escolha a tela inicial que quer mostrar:
    viewDiary.classList.remove("hidden");
    viewProfil.classList.add("hidden");
    setText("#nav-user", session.user.email || "");
    setText("#auth-msg", "");
  } else {
    // deslogado
    nav.classList.add("hidden");
    viewAuth.classList.remove("hidden");
    viewDiary.classList.add("hidden");
    viewProfil.classList.add("hidden");
    setText("#nav-user", "");
  }
}

// ===== Eventos Auth =====
async function doLogin() {
  try {
    setText("#auth-msg", "Entrando...");
    const email = (emailEl.value || "").trim();
    const password = passEl.value || "";

    if (!email || !password) {
      setText("#auth-msg", "Preencha e-mail e senha.");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setText("#auth-msg", "Erro ao entrar: " + (error.message || error));
      return;
    }

    // sessão aplicada pelo SDK; garantimos render imediatamente
    const { data: { session } } = await supabase.auth.getSession();
    render(session);
    setText("#auth-msg", "");
  } catch (err) {
    setText("#auth-msg", "Falha inesperada ao entrar: " + err.message);
  }
}

async function doSignup() {
  try {
    setText("#auth-msg", "Criando conta...");
    const email = (emailEl.value || "").trim();
    const password = passEl.value || "";

    if (!email || !password) {
      setText("#auth-msg", "Preencha e-mail e senha.");
      return;
    }

    // cria conta (com Confirm Email DESLIGADO no Supabase)
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      // Se usuário já existe, tentamos login direto
      if (String(error.message || "").toLowerCase().includes("already registered")) {
        return doLogin();
      }
      setText("#auth-msg", "Erro ao criar conta: " + error.message);
      return;
    }

    // Em alguns workspaces o signUp já devolve sessão; garantimos com getSession
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // Se confirm e-mail estivesse ON, cairia aqui — mas no seu projeto está OFF
      setText("#auth-msg", "Conta criada. Tente entrar com seu e-mail/senha.");
      return;
    }
    render(session);
    setText("#auth-msg", "");
  } catch (err) {
    setText("#auth-msg", "Falha inesperada ao criar conta: " + err.message);
  }
}

async function doLogout() {
  try {
    await supabase.auth.signOut();
  } catch {}
  // limpamos mensagens/inputs e render deslogado
  if (emailEl) emailEl.value = "";
  if (passEl)  passEl.value  = "";
  setText("#auth-msg", "");
  render(null);
}

// ===== Navegação topo =====
$("#nav-diario")?.addEventListener("click", () => {
  viewDiary.classList.remove("hidden");
  viewProfil.classList.add("hidden");
});
$("#nav-perfil")?.addEventListener("click", () => {
  viewDiary.classList.add("hidden");
  viewProfil.classList.remove("hidden");
});

// Botões
btnLogin?.addEventListener("click", (e) => { e.preventDefault(); doLogin(); });
btnSign ?.addEventListener("click", (e) => { e.preventDefault(); doSignup(); });
btnLogout?.addEventListener("click", (e) => { e.preventDefault(); doLogout(); });

// ===== Boot =====
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  render(session);

  supabase.auth.onAuthStateChange((_event, newSession) => {
    render(newSession);
  });
})();
