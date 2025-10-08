diff --git a/app.js b/app.js
index 19cc111b76073dea4e813e6db7160ff91a1d6c8f..550fad371773785a822ac54df0836aa35a3791a5 100644
--- a/app.js
+++ b/app.js
@@ -1,42 +1,69 @@
 // app.js
-import { mountProfile } from "./components/profile.js";
-import { mountDiary }   from "./components/diary.js";
-
-// 1) Supabase client único, exposto em window para os componentes
-const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG || {};
-if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
-  alert("Configuração Supabase ausente. Verifique config.js");
-}
-export const supabase = window.supabase = window.supabase ??
-  window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_ANON_KEY) ??
-  window.createClient?.(SUPABASE_URL, SUPABASE_ANON_KEY) ??
-  (window.supabase = window.Supabase?.createClient?.(SUPABASE_URL, SUPABASE_ANON_KEY));
+import { mountProfile } from "./components/profile.js";
+import { mountDiary } from "./components/diary.js";
+
+// 1) Supabase client único, exposto globalmente para inspeção/debug
+const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG ?? {};
+
+function ensureSupabaseClient() {
+  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
+    throw new Error("Configuração Supabase ausente. Verifique config.js");
+  }
+
+  if (window.__supabaseClient) {
+    return window.__supabaseClient;
+  }
+
+  const supabaseModule = window.supabase ?? window.Supabase ?? null;
+  const createClient = supabaseModule?.createClient ?? window.createClient;
+
+  if (typeof createClient !== "function") {
+    throw new Error("Biblioteca supabase-js não carregada. Verifique a tag <script>.");
+  }
+
+  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
+  window.__supabaseClient = client;
+  return client;
+}
+
+let supabase;
+try {
+  supabase = ensureSupabaseClient();
+} catch (err) {
+  console.error(err);
+  alert(err.message);
+}
+
+if (!supabase) {
+  throw new Error("Não foi possível iniciar o cliente Supabase.");
+}
+
+export { supabase };
 
 // 2) atalhos DOM
-const $  = (sel) => document.querySelector(sel);
-const $$ = (sel) => document.querySelectorAll(sel);
+const $ = (sel) => document.querySelector(sel);
 
 // 3) navegação simples
 function show(viewId) {
   ["#view-auth", "#view-profile", "#view-diary"].forEach((id) => {
     const el = $(id);
     if (!el) return;
     if (id === viewId) el.classList.remove("hidden");
     else el.classList.add("hidden");
   });
   $("#nav")?.classList.toggle("hidden", viewId === "#view-auth");
 }
 
 // 4) auth UI
 async function doLogin() {
   const email = $("#auth-email").value.trim();
   const pass  = $("#auth-pass").value.trim();
   if (!email || !pass) return msgAuth("Informe e-mail e senha.");
   msgAuth("Entrando...");
   const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
   if (error) return msgAuth("Erro ao entrar: " + error.message);
   msgAuth("");
 }
 
 async function doSignup() {
   const email = $("#auth-email").value.trim();
