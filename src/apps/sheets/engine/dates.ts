// Excel-style date serials: day 0 = 1899-12-30 (matches SheetJS's convention,
// which sidesteps the historical 1900 leap-year bug for dates we actually use).

const EPOCH_MS = Date.UTC(1899, 11, 30)
const MS_PER_DAY = 86400000

export function dateToSerial(y: number, m: number, d: number, h = 0, mi = 0, s = 0): number {
  const ms = Date.UTC(y, m - 1, d, h, mi, s)
  return (ms - EPOCH_MS) / MS_PER_DAY
}

export function jsDateToSerial(dt: Date): number {
  return (dt.getTime() - EPOCH_MS) / MS_PER_DAY
}

export function serialToDate(serial: number): Date {
  return new Date(EPOCH_MS + Math.round(serial * MS_PER_DAY))
}

export function serialParts(serial: number) {
  const dt = serialToDate(serial)
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
    hour: dt.getUTCHours(),
    minute: dt.getUTCMinutes(),
    second: dt.getUTCSeconds(),
    weekday: dt.getUTCDay(), // 0=Sunday..6=Saturday
  }
}
