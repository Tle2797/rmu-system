// แปลง Date → "YYYY-MM-DD" (ใช้ส่งให้ API / input[type=date])
export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// แปลง "YYYY-MM-DD" → "DD/MM/YYYY" (โชว์ให้คนอ่าน)
export function toThaiDisplay(iso: string | undefined) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

export function firstDayOfMonthISO(date = new Date()) {
  return toISODate(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function firstDayOfQuarterISO(date = new Date()) {
  const month = date.getMonth();
  const qStartMonth = Math.floor(month / 3) * 3; // 0,3,6,9
  return toISODate(new Date(date.getFullYear(), qStartMonth, 1));
}

export function addDaysISO(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m - 1), d);
  dt.setDate(dt.getDate() + n);
  return toISODate(dt);
}
