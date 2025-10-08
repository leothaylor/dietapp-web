// utils/helpers.js

// CSS selector (use com '#id', '.classe', etc)
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Por id (NÃO passe '#'; passe só 'o_bmr', 'name', etc)
export const byId = (id) => document.getElementById(id);

// Coisinhas úteis
export const setText = (el, v) => { if (el) el.textContent = v; };
export const fmt = (n, d = 0) => Number(n ?? 0).toFixed(d);
export const toNumber = (el) => Number.parseFloat((el?.value ?? '').toString().replace(',', '.')) || 0;
