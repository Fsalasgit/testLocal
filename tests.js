// Pruebas de lógica de datos sin dependencias externas: node tests.js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('./server/index.js', import.meta.url), 'utf8');
const region = source.slice(source.indexOf('const ensureString ='), source.indexOf('function blank()'));
const ctx = vm.createContext({ Number, String, Object, URL, Array, RegExp });
vm.runInContext(`${region}; globalThis.normalizeProduct = normalizeProduct;`, ctx);
const p = ctx.normalizeProduct({
  sku:'01010150', nombre:'Torno profesional OM-210', precio_lista:23300,
  categorias:['Belleza &amp; Cuidado Personal'],
  imagenes:['https://dazimportadora.com.ar/wp-content/uploads/2026/09/articulos-agosto-2026-09-10T132016.703.jpg']
});
assert.equal(p.sku,'01010150');
assert.equal(p.categorias[0],'Belleza & Cuidado Personal');
assert.equal(p.imagenes.length,1);
assert.equal(p.precio_lista,23300);
const missing = ctx.normalizeProduct({sku:'X',nombre:'Sin precio'});
assert.equal(missing,null);
const phone = /^\d[\d\s()+-]{7,24}$/;
assert.equal(phone.test('381 555 1234'),true);
assert.equal(phone.test('3'),false);
const frontend = fs.readFileSync(new URL('./src/pages/Catalog.jsx', import.meta.url), 'utf8');
assert(frontend.includes('checked={form.consentimiento}'));
assert(frontend.includes('const proxy = product?.imagen_url'));
console.log('OK: JSON de DAZ, imágenes, categorías, consentimiento y teléfonos.');
