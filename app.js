// app.js
import { mountAuth } from "./components/auth.js";
import { mountProfile } from "./components/profile.js";
import { mountDiary } from "./components/diary.js";

window.$ = (sel) => document.querySelector(sel);

const supabase = window.supabase.createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_ANON_KEY
);

function show(viewId){
  ["view-auth","view-profile","view-diary"].forEach(id=>{
    document.getElementById(id).classList.add("hidden");
  });
  document.getElementById(viewId).classList.remove("hidden");
  document.getElementById("nav").classList.toggle("hidden", viewId==="view-auth");
}

mountAuth({ supabase, onLogin: () => { show("view-diary"); } });
mountProfile({ supabase });
mountDiary({ supabase });

// Nav
$("#
