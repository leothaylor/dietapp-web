// utils/helpers.js
// helpers DOM sem duplicar '#', e utilitários simples

export const $id = (id) => document.getElementById(id);

// seta texto de um elemento por id
export const setText = (id, txt) => {
  const el = typeof id === 'string' ? $id(id) : id;
  if (el) el.textContent = txt ?? '';
};

// número bonitinho
export const fmt = (n, digits = 0) =>
  (n ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits });

// força número
export const toNumber = (v) => {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
