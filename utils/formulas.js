const cm2in = (cm) => cm / 2.54;

export function bfNavy({sex, height_cm, neck_cm, waist_cm, hip_cm}) {
  const h = cm2in(height_cm), n = cm2in(neck_cm), w = cm2in(waist_cm), q = hip_cm ? cm2in(hip_cm) : null;
  if (sex === 'male')  return 86.010 * Math.log10(w - n) - 70.041 * Math.log10(h) + 36.76;
  return 163.205 * Math.log10(w + q - n) - 97.684 * Math.log10(h) - 78.387;
}

export function bfDeurenberg({sex, age, height_cm, weight_kg}) {
  const h_m = height_cm / 100;
  const imc = weight_kg / (h_m*h_m);
  const sexoNum = sex === 'male' ? 1 : 0;
  return 1.20*imc + 0.23*age - 10.8*sexoNum - 5.4;
}
export const mediana = (a,b) => (a+b)/2;

export function bmr({sex, height_cm, weight_kg, age}) {
  const base = 10*weight_kg + 6.25*height_cm - 5*age;
  return sex === 'male' ? base + 5 : base - 161;
}

export function activityFactor(routine, freq) {
  const map = {
    sedentary: { "0":1.20, "1-2":1.30, "3-4":1.40, "5+":1.50 },
    light:     { "0":1.30, "1-2":1.40, "3-4":1.50, "5+":1.60 },
    moderate:  { "0":1.40, "1-2":1.50, "3-4":1.55, "5+":1.65 },
    active:    { "0":1.50, "1-2":1.55, "3-4":1.65, "5+":1.75 },
    very_active:{ "0":1.60, "1-2":1.65, "3-4":1.75, "5+":1.90 },
  };
  return map[routine]?.[freq] ?? 1.55;
}

export function macrosDefault(weight_kg, kcalTarget) {
  const prot_g = Math.round(2.0 * weight_kg);
  const gord_g = Math.round(0.6 * weight_kg);
  const kcal_prot = prot_g * 4, kcal_gord = gord_g * 9;
  const carb_kcal = Math.max(0, Math.round(kcalTarget - (kcal_prot + kcal_gord)));
  const carb_g = Math.round(carb_kcal / 4);
  return { prot_g, carb_g, gord_g };
}
