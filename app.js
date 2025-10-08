// app.js (substituir tudo)

// --- UTIL ------------------------------
const $ = (sel) => document.querySelector(sel);
const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');
const setText = (el, msg = "") => (el.textContent = msg);

// views
const vAuth = $("#view-auth");
const vProfile = $("#view-profile");
const vDiary = $("#view-diary");
const nav = $("#nav");
const navUser = $("#nav-user");
const btnLogout = $("#btn-logout");
const msgAuth = $("#auth-msg");

// auth form
const inpEmail = $("#auth-email");
const inpPass = $("#auth-pass");
const btnLogin = $("#btn-login");
const btnSignup = $("#btn-signup");

// navegação
const btnNavDiario = $("#nav-diario");
const btnNavPerfil = $("#nav-perfil");

// módulos (só montamos quando logado)
import("./components/profile.js").then(m => (window._profile = m));
import("./components/diary.js").then(m => (window._diary = m));

// --- GARANTE SUPABASE CLIENT -----------
let supabase = null;

function fatalAuth(msg) {
  setText(msgAuth, msg);
  show(vAuth);
  hide(vProfile);
  hide(vDiary);
  hide(nav);
}

(function ensureSupabase() {
  try {
    const cfg = window.APP_CONFIG || {};
    const url = (cfg.SUPABASE_URL || "").trim();
    const key = (cfg.SUPABASE_ANON_KEY || "").trim();

    if (!url || !key) {
      fatalAuth("Config inválida (URL/Key vazias). Abra config.js e confira SUPABASE_URL/SUPABASE_ANON_KEY.");
      return;
    }
    if (!window.supabase || !window.supabase.createClient) {
      fatalAuth("SDK do Supabase não carregou. Verifique a ordem dos scripts no index.html (config.js → supabase-js → app.js).");
      return;
    }

    supabase = window.supabase.createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    if (!supabase || !supabase.auth) {
      fatalAuth("Falha ao criar cliente do Supabase.");
      return;
    }
  } catch (e) {
    console.error(e);
    fatalAuth("Erro criando cliente Supabase: " + (e?.message || e));
  }
})();

if (!supabase) {
  // Já mostramos erro amigável em fatalAuth
  throw new Error("Supabase client não criado.");
}

// --- NAV / VIEWS ------------------------
function goAuth() {
  show(vAuth);
  hide(vProfile);
  hide(vDiary);
  hide(nav);
  setText(navUser, "");
}

function goProfile() {
  hide(vAuth);
  show(vProfile);
  hide(vDiary);
  show(nav);
}

function goDiary() {
  hide(vAuth);
  hide(vProfile);
  show(vDiary);
  show(nav);
}

// --- LOGIN / SIGNUP ---------------------
async function doLogin() {
  setText(msgAuth, "Entrando...");
  try {
    const email = inpEmail.value.trim().toLowerCase();
    const password = inpPass.value;

    if (!email || !password) {
      setText(msgAuth, "Informe e-mail e senha.");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setText(msgAuth, "Erro ao entrar: " + error.message);
      return;
    }
    setText(msgAuth, "");
    // onAuthStateChange vai cuidar de mostrar a tela
  } catch (e) {
    console.error(e);
    setText(msgAuth, "Erro inesperado ao entrar: " + (e?.message || e));
  }
}

async function doSignup() {
  setText(msgAuth, "Criando conta...");
  try {
    const email = inpEmail.value.trim().toLowerCase();
    const password = inpPass.value;

    if (!email || !password) {
      setText(msgAuth, "Informe e-mail e senha.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setText(msgAuth, "Erro ao criar conta: " + error.message);
      return;
    }

    // Se “Confirm email” estiver OFF, já entra direto; se ON, precisa confirmar
    setText(
      msgAuth,
      "Conta criada. Se confirmação por e-mail estiver ativa, verifique sua caixa de entrada. Caso contrário, clique em Entrar."
    );
  } catch (e) {
    console.error(e);
    setText(msgAuth, "Erro inesperado ao criar conta: " + (e?.message || e));
  }
}

// --- LISTENER DE SESSÃO -----------------
try {
  supabase.auth.onAuthStateChange(async (_evt, session) => {
    // console.log("Auth evt:", _evt, session);
    if (session?.user) {
      setText(msgAuth, "");
      const user = session.user;
      navUser.textContent = user.email || user.id;
      // monta telas
      try {
        if (window._profile?.mountProfile) await window._profile.mountProfile(supabase);
        if (window._diary?.mountDiary) await window._diary.mountDiary(supabase);
      } catch (e) {
        console.error("Erro montando componentes:", e);
      }
      goDiary(); // abre Diário por padrão
    } else {
      goAuth();
    }
  });
} catch (e) {
  console.error(e);
  fatalAuth("Erro inicializando listener de auth: " + (e?.message || e));
}

// --- EVENTOS UI -------------------------
btnLogin?.addEventListener("click", (e) => {
  e.preventDefault();
  doLogin();
});

btnSignup?.addEventListener("click", (e) => {
  e.preventDefault();
  doSignup();
});

btnLogout?.addEventListener("click", async () => {
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.error(e);
    alert("Erro ao sair: " + (e?.message || e));
  }
});

btnNavDiario?.addEventListener("click", (e) => {
  e.preventDefault();
  goDiary();
});

btnNavPerfil?.addEventListener("click", (e) => {
  e.preventDefault();
  goProfile();
});
