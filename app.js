import { mountAuth } from "./components/auth.js";
import { mountProfile } from "./components/profile.js";
import { mountDiary } from "./components/diary.js";

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

mountAuth({ supabase });
mountProfile({ supabase });
mountDiary({ supabase });

// Restaurar sessão e mostrar view correta
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    document.getElementById("nav").classList.remove("hidden");
    document.getElementById("view-auth").classList.add("hidden");
    document.getElementById("view-diary").classList.remove("hidden");
    document.getElementById("nav-user").textContent = session.user.email;
  }
})();
