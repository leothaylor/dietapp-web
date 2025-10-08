// app.js
import { $, $$, byId, setText } from "./utils/helpers.js";
import mountDiary from "./components/diary.js";
import mountProfile from "./components/profile.js";

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

// ----------------- navegação/troca de views -----------------
function show(view) {
  // views: auth, profile, diary
  byId("view-auth")?.classList.toggle("hidden", view !== "auth");
  byId("view-profile")?.classList.toggle("hidden", view !== "profile");
  byId("view-diary")?.classList.toggle("hidden", view !== "diary");
  byId("nav")?.classList.toggle("hidden", view === "auth");
}

function wireNav() {
  byId("nav-diario")?.addEventListener("click", () => show("diary"));
  byId("nav-perfil")?.addEventListener("click", () => show("profile"));
  byId("btn-logout")?.addEventListener("click", async () => {
    try {
      await supabase.auth.signOut();
      currentUser = null;
      setText(byId("nav-user"), "");
      show("auth");
    } catch (e) {
      console.error(e);
      alert("Erro ao sair");
    }
  });
}

// ----------------- autenticação -----------------
function wireAuth() {
  const form = byId("form-auth");
  const emailEl = byId("auth-email");
  const passEl  = byId("auth-pass");
  const msgEl   = byId("auth-msg");

  const setMsg = (s) => setText(msgEl, s ?? "");

  form?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    setMsg("Entrando...");

    const email = (emailEl?.value || "").trim().toLowerCase();
    const password = passEl?.value || "";

    try {
      // 1) tenta login
      let { data, error } = await supabase.auth.signInWithPassword({ email, password });

      // 2) se falhar por credenciais, cria conta e entra
      if (error && /invalid|credentials|not found/i.test(error.message)) {
        const { error: e2 } = await supabase.auth.signUp({ email, password });
        if (e2) {
          setMsg("Erro ao criar conta: " + e2.message);
          return;
        }
        setMsg("Conta criada. Entrando...");
        // onAuthStateChange vai cuidar do resto
        return;
      }

      if (error) {
        setMsg("Erro: " + error.message);
        return;
      }

      setMsg(""); // ok; onAuthStateChange assumirá
    } catch (err) {
      console.error(err);
      setMsg("Erro inesperado. Tente novamente.");
    }
  });
}

// ----------------- ciclo de vida pós-login -----------------
async function enterApp(session) {
  currentUser = session?.user ?? null;

  setText(byId("nav-user"), currentUser?.email || "");

  // Só monta os módulos quando as views existem
  // (evita querySelector falhar na tela de login)
  mountProfile({ supabase, user: currentUser });
  mountDiary({ supabase, user: currentUser });

  show("diary"); // ou "profile", como preferir
}

function leaveApp() {
  currentUser = null;
  show("auth");
}

// ----------------- bootstrap -----------------
document.addEventListener("DOMContentLoaded", async () => {
  wireNav();
  wireAuth();

  // Estado inicial
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      await enterApp(data.session);
    } else {
      show("auth");
    }
  } catch {
    show("auth");
  }

  // Sessões posteriores
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) enterApp(session);
    else leaveApp();
  });
});
