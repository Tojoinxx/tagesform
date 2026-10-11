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

/** Textsuche (erst neue Suche, dann klassische als Ausweichlösung) */
export async function search(q) {
  const term = q.trim();
  if (term.length < 2) return [];
  try {
    const j = await getJson(
      `https://search.openfoodfacts.org/search?q=${encodeURIComponent(term)}&langs=de,en&page_size=25&fields=${FIELDS}`,
    );
    const hits = (j && (j.hits || j.products)) || [];
    const list = hits.map(mapProduct).filter((p) => p && p.hasNutrition);
    if (list.length) return list;
  } catch (e) {
    /* weiter mit klassischer Suche */
  }
  const j = await getJson(
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&page_size=25&lc=de&fields=${FIELDS}`,
    15000,
  );
  return ((j && j.products) || []).map(mapProduct).filter((p) => p && p.hasNutrition);
}
