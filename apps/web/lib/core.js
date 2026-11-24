// Pure helpers (no DOM, no Leaflet): unit-tested in Node (tests/core.test.mjs).
import {TRUCK_LIMITS,validTruckValue} from './contracts/validate.mjs';

/** Next unique id: prefix + (max numeric suffix among existing ids with that prefix) + 1. Independent of array length. */
export function nextId(prefix, existingIds) {
  const taken = new Set(existingIds);
  let max = 0;
  for (const id of taken) {
    if (typeof id === 'string' && id.startsWith(prefix)) {
      const n = Number(id.slice(prefix.length));
      if (Number.isSafeInteger(n) && n > max) max = n;
    }
  }
  if (max < Number.MAX_SAFE_INTEGER) return prefix + (max + 1);
  // At the numeric limit, pigeonhole: N+1 candidates for at most N occupied
  // strings. Never increment an unsafe Number or loop indefinitely.
  for (let n = 1; n <= taken.size + 1; n++) if (!taken.has(prefix + n)) return prefix + n;
  throw Error('Не удалось создать уникальный ID');
}

/** Guards against stale async results: every scenario change bumps the revision; a result is accepted only if
 * it belongs to the latest request AND the revision it was started with is still current. */
export function createRequestGate() {
  let revision = 0, requestId = 0, controller = null;
  return {
    get revision() { return revision; },
    /** Call on ANY scenario change. Aborts the in-flight request. */
    changed() { revision++; controller?.abort(); controller = null; return revision; },
    /** Start a new request: aborts the previous one. */
    begin() {
      controller?.abort();
      controller = new AbortController();
      return { id: ++requestId, revision, signal: controller.signal };
    },
    isCurrent(token) { return token.id === requestId && token.revision === revision; },
    get busy() { return controller !== null; },
    finish(token) { if (token.id === requestId) controller = null; },
  };
}

const TRUCK_LABELS = {bodyM3:'Объём кузова',payloadKg:'Грузоподъёмность',snowDensityKgM3:'Плотность',driveKmh:'Скорость',rateRubPerHour:'Тариф'};
/** Validate one raw form value. Returns {ok, value} or {ok:false, error}. Empty optional field -> value null. */
export function validateTruckField(field, raw) {
  const rule = TRUCK_LIMITS[field], label = TRUCK_LABELS[field];
  if (!rule) return { ok: false, error: 'Неизвестное поле' };
  const text = String(raw ?? '').trim();
  if (text === '') return rule.required ? { ok: false, error: label + ': укажите значение' } : { ok: true, value: null };
  const value = Number(text.replace(',', '.'));
  if (!Number.isFinite(value)) return { ok: false, error: label + ': нужно число' };
  if (value < rule.min) return { ok: false, error: label + ': не меньше ' + rule.min };
  if (value > rule.max) return { ok: false, error: label + ': не больше ' + rule.max };
  if (rule.integer && !Number.isSafeInteger(value)) return { ok: false, error: label + ': нужно целое число' };
  return validTruckValue(field,value) ? { ok: true, value } : { ok: false, error: label + ': недопустимое значение' };
}

/** "8 ч 21 мин" / "45 мин" */
export function fmtDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes < 0) return 'не указано';
  const total = Math.round(minutes), h = Math.floor(total / 60), m = total % 60;
  return h ? `${h} ч ${m} мин` : `${m} мин`;
}

/** Group trips by (source, site): one line per pair instead of dozens of identical ones. */
export function aggregateTrips(assignments) {
  const map = new Map();
  for (const a of assignments) {
    const key = JSON.stringify([a.demandId,a.siteId]);
    const g = map.get(key) || { demandId: a.demandId, siteId: a.siteId, trips: 0, volumeM3: 0, kmPerTrip: a.km, outward: a.outward, home: a.home, outwardKm: a.outward.km, homeKm: a.home.km };
    g.trips++; g.volumeM3 += a.volumeM3;
    map.set(key, g);
  }
  return [...map.values()].sort((x, y) => x.demandId.localeCompare(y.demandId) || x.siteId.localeCompare(y.siteId));
}

/** Variant is comparable with the base by km only when the same volume was served. */
export function isComparable(base, variant) {
  return base.servedM3 === variant.servedM3;
}

export const fmtKm = n => Number.isFinite(n) ? n.toLocaleString('ru-RU', { maximumFractionDigits: 1 }) : 'не указано';
export const fmtRub = n => Number.isFinite(n) ? Math.round(n).toLocaleString('ru-RU') + ' ₽' : 'не указано';

/** "Базовая площадка A — сценарий" -> "A"; "Кандидат C — сценарий" -> "C" */
export function shortSiteName(site) {
  const s = String(site?.name ?? '').split(' — ')[0].replace(/^(Базовая площадка|Кандидат|Площадка)\s*/i, '').trim();
  return s || String(site?.id ?? '?');
}

/** Plain-language reason for unserved snow, from solver reason codes. */
export function reasonsSummary(reasons = []) {
  const codes = new Set(reasons.map(r => r.code));
  if (codes.has('no_round_trip_route') && codes.has('capacity_exhausted')) return 'вместимости площадок недостаточно, а до части источников нет маршрута туда и обратно';
  if (codes.has('no_round_trip_route')) return 'до части источников нет маршрута туда и обратно';
  return 'вместимости доступных площадок недостаточно';
}

/** Main one-sentence conclusion for the selected variant. tone: ok | warn | info */
export function headline(total, base, v, isBase) {
  const served = v.servedM3, un = v.unservedM3;
  if (un > 0) return { tone: 'warn', text: `Из ${total} м³ вывезено ${served} м³. Осталось ${un} м³: ${reasonsSummary(v.unservedReasons)}.` };
  if (isBase) return { tone: 'ok', text: `Базовый вариант вывозит весь снег (${total} м³): ${fmtKm(v.transportKm)} км туда и обратно, ${v.trips} рейсов.` };
  if (!isComparable(base, v)) {
    return { tone: 'info', text: `Вариант вывозит весь снег (${total} м³), а базовый — только ${base.servedM3} м³. Километры напрямую не сравниваются: объём вывоза разный.` };
  }
  const d = v.transportKm - base.transportKm;
  if (Math.abs(d) < 0.0005) return { tone: 'info', text: `Вывозится весь снег (${total} м³). Пробег такой же, как в базовом варианте: ${fmtKm(v.transportKm)} км.` };
  const pct = base.transportKm > 0 ? ` (${d < 0 ? '−' : '+'}${Math.abs(d / base.transportKm * 100).toFixed(1).replace('.', ',')}%)` : ' (процент не определяется: базовый пробег равен нулю)';
  return { tone: d < 0 ? 'ok' : 'info', text: `Вывозится весь снег (${total} м³). Пробег ${d < 0 ? 'меньше' : 'больше'} базового на ${fmtKm(Math.abs(d))} км: ${fmtKm(base.transportKm)} → ${fmtKm(v.transportKm)} км${pct}. Это модельная оценка, не фактическая экономия.` };
}
