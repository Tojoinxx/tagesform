// Open Food Facts – freie Produktdatenbank (Barcode + Textsuche)
import { num } from './util.js';

const FIELDS = 'code,product_name,product_name_de,generic_name_de,brands,nutriments,serving_quantity,serving_size,product_quantity,quantity,categories_tags,image_front_small_url';

const FV_CATS = ['en:fresh-fruits', 'en:fresh-vegetables', 'en:fruits', 'en:vegetables', 'en:frozen-vegetables', 'en:berries'];
const NOT_FV = ['en:fruit-juices', 'en:juices', 'en:jams', 'en:fruit-yogurts', 'en:snacks', 'en:dried-fruits'];

export function mapProduct(p) {
  if (!p) return null;
  const n = p.nutriments || {};
  let kcal = num(n['energy-kcal_100g']);
  if (!kcal && n['energy_100g']) kcal = num(n['energy_100g']) / 4.184;
  const name = (p.product_name_de || p.product_name || p.generic_name_de || '').trim();
  if (!name) return null;
  const brands = Array.isArray(p.brands) ? p.brands.join(', ') : String(p.brands || '');
  const cats = Array.isArray(p.categories_tags) ? p.categories_tags : [];
  const fv = cats.some((c) => FV_CATS.includes(c)) && !cats.some((c) => NOT_FV.includes(c));
  const isDrink = cats.some((c) => /beverages|drinks|getraenke|milks/.test(c)) || /\bml\b|\bl\b|cl\b/i.test(String(p.quantity || ''));
  const portions = [];
  const sq = num(p.serving_quantity);
  if (sq > 0) portions.push({ label: `1 Portion${p.serving_size ? ' (' + p.serving_size + ')' : ''}`, g: Math.round(sq) });
  const pq = num(p.product_quantity);
  if (pq > 0 && pq <= 3000 && pq !== sq) portions.push({ label: `Ganze Packung (${p.quantity || pq + ' g'})`, g: Math.round(pq) });
  return {
    id: 'off:' + p.code,
    barcode: String(p.code || ''),
    name,
    brand: brands.split(',')[0].trim(),
    source: 'off',
    per100: {
      kcal: Math.round(kcal),
      p: num(n.proteins_100g),
      c: num(n.carbohydrates_100g),
      f: num(n.fat_100g),
      fiber: num(n.fiber_100g),
      sugar: num(n.sugars_100g),
    },
    portions,
    fv,
    unit: isDrink ? 'ml' : 'g',
    hasNutrition: kcal > 0 || num(n.proteins_100g) + num(n.carbohydrates_100g) + num(n.fat_100g) > 0,
    image: p.image_front_small_url || null,
  };
}

async function getJson(url, ms = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (r.status === 404) return { __notFound: true };
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

/** Produkt per Barcode. Gibt null zurück, wenn unbekannt. */
export async function byBarcode(code) {
  const c = String(code).replace(/\D/g, '');
  if (!c) return null;
  const j = await getJson(`https://world.openfoodfacts.org/api/v2/product/${c}.json?fields=${FIELDS}`);
  if (!j || j.__notFound || j.status === 0 || !j.product) return null;
  const m = mapProduct({ code: c, ...j.product });
  return m && m.hasNutrition ? m : m ? { ...m, incomplete: true } : null;
}

const normq = (t) =>
  String(t || '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');

/** Treffer sortieren: alle Suchwörter im Namen/Marke > einige > keins (dann raus); deutsche Produkte zuerst */
function rank(list, term) {
  const toks = normq(term).split(/\s+/).filter((t) => t.length > 1);
  const seen = new Set();
  return list
    .filter((p) => p && p.hasNutrition && !seen.has(p.id) && seen.add(p.id))
    .map((p) => {
      const h = normq(`${p.name} ${p.brand}`);
      const hit = toks.filter((t) => h.includes(t)).length;
      return [hit / Math.max(1, toks.length) + (p.de ? 0.3 : 0) - p.name.length / 400, hit, p];
    })
    .filter(([, hit]) => hit > 0)
    .sort((a, b) => b[0] - a[0])
    .map(([, , p]) => p);
}

const sal = (q) => getJson(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&langs=de,en&page_size=40&fields=${FIELDS},countries_tags`);

/** Textsuche: deutsche Produkte und weltweit parallel, dazu klassische Suche als Ausweichlösung */
export async function search(q) {
  const term = q.trim();
  if (term.length < 2) return [];
  const map = (j, de) => ((j && (j.hits || j.products)) || []).map((p) => {
    const m = mapProduct(p);
    if (m) m.de = de || (Array.isArray(p.countries_tags) && p.countries_tags.includes('en:germany'));
    return m;
  });
  const tries = await Promise.allSettled([sal(`${term} countries_tags:"en:germany"`), sal(term)]);
  let list = [];
  tries.forEach((t, i) => t.status === 'fulfilled' && (list = list.concat(map(t.value, i === 0))));
  let ranked = rank(list, term);
  if (ranked.length >= 3) return ranked.slice(0, 30);
  // klassische Suche (Deutschland), falls die neue wenig liefert
  try {
    const j = await getJson(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&page_size=40&lc=de&cc=de&fields=${FIELDS},countries_tags`,
      15000,
    );
    ranked = rank(list.concat(map(j, false)), term);
  } catch (e) {
    if (!ranked.length && tries.every((t) => t.status === 'rejected')) throw e;
  }
  return ranked.slice(0, 30);
}
