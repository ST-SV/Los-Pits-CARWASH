// El Salvador es UTC-6 todo el año (sin horario de verano). El servidor puede
// correr en cualquier timezone (Railway suele usar UTC), así que estas
// funciones calculan el "día calendario" salvadoreño de forma explícita en
// vez de depender de Date.setHours/getHours (que usan el timezone del proceso).
const ES_OFFSET_MS = 6 * 60 * 60 * 1000

// Dado un instante (por defecto ahora), devuelve la medianoche UTC que
// representa el inicio de ese día calendario en El Salvador.
export const esDayBucket = (date: Date = new Date()): Date => {
  const shifted = new Date(date.getTime() - ES_OFFSET_MS)
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()))
}

export const addDays = (date: Date, days: number): Date => {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

// Construye un bucket de día (medianoche UTC) para una fecha calendario dada,
// usando la misma convención que esDayBucket (mes 0-indexed, como Date nativo).
export const esDate = (year: number, monthIndex0: number, day: number): Date =>
  new Date(Date.UTC(year, monthIndex0, day))
