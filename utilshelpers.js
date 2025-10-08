window.$ = (sel) => document.querySelector(sel);
window.$$ = (sel) => Array.from(document.querySelectorAll(sel));
export const fmt = (n, d=0) => (n ?? 0).toFixed(d);
export const toNumber = (v) => (v === "" || v == null) ? null : Number(v);
export const todayISO = () => new Date().toISOString().slice(0,10);
export const show = (id) => { $("#"+id).classList.remove("hidden"); };
export const hide = (id) => { $("#"+id).classList.add("hidden"); };
export const setText = (id, v) => { $("#"+id).textContent = v; };
