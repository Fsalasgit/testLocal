import express from 'express';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { calcularPrecio, precioPorMedio, ADMIN_PCT, PAGO_UNICO_DESCUENTO_PCT, DIAS_REFERENCIA, REDONDEO_PREDETERMINADO, validarRedondeo, calcularPlanCuotas, distribuirCuotas, CUOTAS_DISPONIBLES } from '../src/pricing.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..');
const dataPath = process.env.DATA_PATH ? path.resolve(process.env.DATA_PATH) : path.join(root, 'data', 'store.json');
const samplePath = path.join(root, 'data', 'catalogo_muestra.json');
const imageCacheDir = process.env.IMAGE_CACHE_DIR ? path.resolve(process.env.IMAGE_CACHE_DIR) : path.join(path.dirname(dataPath), 'images');
const prod = process.env.NODE_ENV === 'production';
const adminUser = process.env.ADMIN_USER || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'amin1';
const sessionSecret = process.env.SESSION_SECRET || (prod ? '' : 'solo_desarrollo_clave_temporal_no_publicar_en_internet');
if (prod && (!process.env.ADMIN_PASSWORD || ['amin1','admin1'].includes(adminPassword) || !sessionSecret || sessionSecret.length < 32)) {
  throw new Error('PRODUCCIÓN: configurá ADMIN_PASSWORD distinto de amin1 y SESSION_SECRET de 32+ caracteres.');
}
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '8mb' }));
app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); next(); });

const ensureString = (x, n = 200) => String(x ?? '').trim().slice(0, n);
// Las categorías exportadas por WooCommerce a veces incluyen entidades HTML (&amp;).
function decodeText(x) {
  return String(x ?? '').replace(/&(#(?:x[0-9a-f]+|[0-9]+)|amp|quot|apos|lt|gt|nbsp);/gi, (_, entity) => {
    const e = entity.toLowerCase();
    const lookup = { amp: '&', quot: '\"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
    if (lookup[e] !== undefined) return lookup[e];
    if (e.startsWith('#')) {
      const n = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isInteger(n) && n > 0 && n <= 0x10ffff && !(n>=0xd800 && n<=0xdfff) ? String.fromCodePoint(n) : _;
    }
    return _;
  });
}
const toNumber = (x) => { const n = Number(x); return Number.isFinite(n) ? n : null; };
function normalizeProduct(p) {
  if (!p || typeof p !== 'object') return null;
  const sku = ensureString(p.sku || p.id_origen || p.id, 100);
  const nombre = decodeText(ensureString(p.nombre || p.name, 300));
  // DAZ publica dos valores: para costos usamos el precio superior (referencia de
  // transferencia), NUNCA el inferior identificado como «Efectivo Precio web».
  // Un precio_transferencia_daz explícito, incluso null, impide recurrir al efectivo.
  const explicitTransfer = Object.hasOwn(p, 'precio_transferencia_daz') || Object.hasOwn(p, 'precio_transferencia');
  const rawTransfer = explicitTransfer ? (p.precio_transferencia_daz ?? p.precio_transferencia)
    : (p.precio_lista ?? p.precio);
  const precio_lista = toNumber(rawTransfer);
  if (!sku || !nombre || precio_lista === null || precio_lista <= 0) return null;
  const efectivoWeb = toNumber(p.precio_efectivo_web ?? p.precio_efectivo);
  const candidateCategories = p.categorias || p.categories || [];
  const categorias = (Array.isArray(candidateCategories) ? candidateCategories : [candidateCategories])
    .map((x) => decodeText(ensureString(typeof x === 'string' ? x : x?.name, 90))).filter(Boolean).slice(0, 12);
  const candidateImages = p.imagenes || p.images || [];
  const imagenes = (Array.isArray(candidateImages) ? candidateImages : [candidateImages])
    .map((x) => typeof x === 'string' ? x : (x?.src || x?.url || ''))
    .filter((url) => /^https:\/\//i.test(url)).slice(0, 8);
  const url_origen = ensureString(p.url_origen || p.permalink || '', 1000);
  let validUrl = '';
  try { const parsed = new URL(url_origen); if (parsed.protocol === 'https:' && parsed.hostname.replace(/^www\./, '') === 'dazimportadora.com.ar') validUrl = parsed.href; } catch {}
  return {
    sku, nombre, marca: decodeText(ensureString(p.marca || '', 80)), categorias,
    precio_lista, precio_transferencia_daz: precio_lista,
    precio_efectivo_web: efectivoWeb !== null && efectivoWeb > 0 ? efectivoWeb : null,
    descripcion: decodeText(ensureString(p.descripcion || '', 5000)), imagenes,
    url_origen: validUrl,
    stock_estado: ensureString(p.stock_estado || '', 100), activo: p.activo !== false
  };
}
function blank() {
  const sample = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
  return { settings: { tasaAnual: 0, diasFinanciacion: DIAS_REFERENCIA, redondeo: REDONDEO_PREDETERMINADO, tiendaNombre: 'Mi Catálogo' }, products: sample.productos.map(normalizeProduct).filter(Boolean), overrides: {}, orders: [], nextOrder: 1 };
}
let db;
try { db = JSON.parse(fs.readFileSync(dataPath, 'utf8')); }
catch (e) { if (e.code !== 'ENOENT') throw e; db = blank(); fs.mkdirSync(path.dirname(dataPath), { recursive: true }); fs.writeFileSync(dataPath, JSON.stringify(db, null, 2)); }
// Al actualizar una instalación existente, normalizamos también los productos ya importados.
if (Array.isArray(db.products)) db.products = db.products.map(p => normalizeProduct(p) || p);
// Migración no destructiva: conserva productos, pedidos y overrides anteriores.
// No convierte 1,30 en tasa anual, porque ambos conceptos son distintos.
db.settings ||= {};
if (!Number.isFinite(Number(db.settings.tasaAnual)) || Number(db.settings.tasaAnual) < 0) db.settings.tasaAnual = 0;
if (!Number.isInteger(Number(db.settings.diasFinanciacion)) || Number(db.settings.diasFinanciacion) < 1) db.settings.diasFinanciacion = DIAS_REFERENCIA;
try { db.settings.redondeo = validarRedondeo(db.settings.redondeo ?? REDONDEO_PREDETERMINADO); } catch { db.settings.redondeo = REDONDEO_PREDETERMINADO; }
db.redondeoOverrides ||= {};
// Sin cuotas habilitadas por defecto: nunca publicamos financiación sin que el administrador la active.
db.cuotasOverrides ||= {};
db.tasaOverrides ||= {};
db.orders ||= [];
db.overrides ||= {};

let pendingWrite = Promise.resolve();
async function save() {
  const snapshot = JSON.stringify(db, null, 2);
  pendingWrite = pendingWrite.catch(() => {}).then(async () => {
    const tmp = `${dataPath}.tmp`;
    await fsp.writeFile(tmp, snapshot);
    await fsp.rename(tmp, dataPath);
  });
  await pendingWrite;
}
function priced(p) {
  const tasa = db.tasaOverrides[p.sku] ?? db.settings.tasaAnual;
  const redondeo = db.redondeoOverrides[p.sku] ?? db.settings.redondeo;
  const price = { ...p, ...calcularPrecio(p.precio_lista, tasa, db.settings.diasFinanciacion, redondeo), tasa_personalizada: Object.hasOwn(db.tasaOverrides, p.sku), redondeo_personalizado: Object.hasOwn(db.redondeoOverrides, p.sku) };
  const enabled = (db.cuotasOverrides[p.sku] || []).filter(n => CUOTAS_DISPONIBLES.includes(n));
  return { ...price, cuotas_habilitadas: enabled, planes_cuotas: enabled.map(meses => calcularPlanCuotas(price, meses)) };
}
function publicProduct(p) {
  const { costo_daz, cargo_administrativo, base_financiada, interes_periodo,
    descuento_pago_unico, ganancia_regular, ganancia_pago_unico, rentabilidad_regular_pct, rentabilidad_pago_unico_pct, precio_sin_redondeo, ajuste_redondeo, incremento_redondeo, redondeo_personalizado,
    tasa_anual, dias_financiacion, tasa_personalizada, precio_lista, precio_transferencia_daz, precio_efectivo_web,
    url_origen, planes_cuotas, ...safe } = priced(p);
  // No exponer cálculos internos (costo ni ganancia) en el catálogo público.
  safe.planes_cuotas = planes_cuotas.map(({meses,total,cuotas}) => ({meses,total,cuotas}));
  safe.imagen_url = safe.imagenes?.[0]
    ? `/api/images/${encodeURIComponent(p.sku)}?v=${crypto.createHash('sha256').update(safe.imagenes[0]).digest('hex').slice(0, 12)}`
    : null;
  return safe;
}
function cookieParse(req) { const raw = req.headers.cookie || ''; const found = raw.split(';').map(s => s.trim()).find(s => s.startsWith('catalog_session=')); return found ? decodeURIComponent(found.slice(16)) : null; }
function sign(data) { return crypto.createHmac('sha256', sessionSecret).update(data).digest('base64url'); }
function checkSession(req) {
  const token = cookieParse(req);
  if (!token) return false;
  const [payload, mac] = token.split('.');
  if (!payload || !mac) return false;
  const real = sign(payload);
  const given = Buffer.from(mac); const expected = Buffer.from(real);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return false;
  try { const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()); return decoded.sub === adminUser && decoded.exp > Date.now(); } catch { return false; }
}
function setCookie(res, value, age = 43200) {
  res.setHeader('Set-Cookie', `catalog_session=${encodeURIComponent(value)}; Max-Age=${age}; HttpOnly; SameSite=Strict; Path=/${prod ? '; Secure' : ''}`);
}
function adminOnly(req, res, next) { if (!checkSession(req)) return res.status(401).json({ error: 'Sesión requerida.' }); next(); }
function sameOrigin(req, res, next) {
  if (['GET','HEAD','OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  const host = req.headers.host;
  // Proxied localhost origin differs from localhost:3001, valid for dev. Cookies SameSite Strict limit CSRF.
  if (origin && prod && (() => { try { return new URL(origin).host !== host; } catch { return true; } })()) return res.status(403).json({ error: 'Origen inválido' });
  next();
}
app.use('/api', sameOrigin);
const failedLogins = new Map();
function cleanFailed() { const now=Date.now(); for (const [ip,v] of failedLogins) if (v.reset < now) failedLogins.delete(ip); }

app.get('/api/health', (_, res) => res.json({ ok: true }));

// Caché local: descarga imágenes públicas permitidas desde el dominio conocido, nunca URLs arbitrarias.
// Los archivos se identifican por hash de URL; un cambio de foto en el JSON genera otro archivo.
const imageTypes = { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp', gif:'image/gif', avif:'image/avif' };
const inflightImages = new Map();
function permittedImage(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const ext = u.pathname.split('.').pop().toLowerCase();
    if (u.protocol !== 'https:' || !['dazimportadora.com.ar','www.dazimportadora.com.ar'].includes(u.hostname.toLowerCase())) return null;
    if (!u.pathname.startsWith('/wp-content/uploads/') || !Object.hasOwn(imageTypes, ext)) return null;
    return { url: u.href, ext, type: imageTypes[ext] };
  } catch { return null; }
}
async function downloadImage(src, target) {
  const response = await fetch(src.url, {
    headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.1' },
    redirect: 'error', signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`DAZ respondió ${response.status}`);
  const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!mime.startsWith('image/') || !Object.values(imageTypes).includes(mime)) throw new Error(`Contenido inesperado: ${mime}`);
  const stated = Number(response.headers.get('content-length'));
  if (stated > 8*1024*1024) throw new Error('Imagen demasiado grande');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > 8*1024*1024) throw new Error('Imagen vacía o demasiado grande');
  await fsp.mkdir(imageCacheDir, { recursive: true });
  const tmp = `${target}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try { await fsp.writeFile(tmp, buffer); await fsp.rename(tmp, target); }
  finally { await fsp.rm(tmp, { force: true }).catch(() => {}); }
}
app.get('/api/images/:sku', async (req, res) => {
  const product = db.products.find(p => p.sku === req.params.sku && p.activo);
  const index = Number(req.query.n ?? 0);
  const src = product && Number.isInteger(index) && index >= 0 && index < 8
    ? permittedImage(product.imagenes?.[index]) : null;
  if (!src) return res.status(404).end();
  const hash = crypto.createHash('sha256').update(src.url).digest('hex');
  const cached = path.join(imageCacheDir, `${hash}.${src.ext}`);
  try {
    if (!fs.existsSync(cached)) {
      if (!inflightImages.has(hash)) {
        const task = downloadImage(src, cached).finally(() => inflightImages.delete(hash));
        inflightImages.set(hash, task);
      }
      await inflightImages.get(hash);
    }
    res.type(src.type);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    return res.sendFile(cached);
  } catch (error) {
    console.warn(`No se pudo guardar imagen del SKU ${product.sku}: ${error.message}`);
    // Si el hosting no puede acceder a DAZ, el navegador intenta la URL original.
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, src.url);
  }
});
app.get('/api/catalog', (req, res) => res.json({ tiendaNombre: db.settings.tiendaNombre, products: db.products.filter(p => p.activo).map(publicProduct), descuentoPagoUnicoPct: PAGO_UNICO_DESCUENTO_PCT, plazoDias: db.settings.diasFinanciacion, categories: [...new Set(db.products.filter(p=>p.activo).flatMap(p=>p.categorias))].sort() }));
app.post('/api/orders', async (req, res) => {
  try {
    const telefono = ensureString(req.body.telefono, 40);
    const nombre = ensureString(req.body.nombre, 100);
    const nota = ensureString(req.body.nota, 1000);
    const medioPago = req.body.medio_pago;
    if (!['regular','pago_unico','cuotas_3','cuotas_6','cuotas_9'].includes(medioPago)) return res.status(400).json({ error: 'Seleccioná una modalidad de pago válida.' });
    const consentimiento = req.body.consentimiento === true;
    const rawItems = req.body.items;
    if (!consentimiento) return res.status(400).json({ error: 'Se requiere autorización para contactarte por este pedido.' });
    if (!/^[\d\s()+-]{8,25}$/.test(telefono) || telefono.replace(/\D/g, '').length < 8 || telefono.replace(/\D/g, '').length > 15) return res.status(400).json({ error: 'Ingresá un teléfono válido, con al menos 8 números (ej.: 381 555 1234).' });
    if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 100) return res.status(400).json({ error: 'El carrito está vacío o tiene demasiados productos.' });
    const combined = new Map();
    for (const row of rawItems) {
      const sku = ensureString(row.sku, 100); const q = Number(row.cantidad);
      if (!sku || !Number.isInteger(q) || q < 1 || q > 99) return res.status(400).json({ error: 'Hay cantidades inválidas en el pedido.' });
      combined.set(sku, (combined.get(sku) || 0) + q);
    }
    if ([...combined.values()].some(q=>q>99)) return res.status(400).json({ error: 'El máximo es 99 unidades por producto.' });
    const mesesSeleccionados = medioPago.startsWith('cuotas_') ? Number(medioPago.slice(7)) : null;
    const items = [...combined].map(([sku,cantidad]) => {
      const p = db.products.find(p=>p.sku === sku && p.activo);
      if (!p) return null;
      const precio = priced(p);
      if (mesesSeleccionados && !precio.cuotas_habilitadas.includes(mesesSeleccionados)) return null;
      const planCuotas = mesesSeleccionados ? calcularPlanCuotas(precio, mesesSeleccionados) : null;
      const precio_unitario = precioPorMedio(precio, medioPago);
      return { sku, nombre: p.nombre, cantidad, precio_unitario, subtotal: precio_unitario * cantidad,
        costo_unitario: precio.costo_daz, costo_total: precio.costo_daz * cantidad, fuente_costo: 'precio_superior_daz',
        administrativo_unitario: precio.cargo_administrativo, administrativo_total: precio.cargo_administrativo * cantidad,
        interes_unitario: precio.interes_periodo, interes_total: precio.interes_periodo * cantidad,
        interes_adicional_unitario: planCuotas?.interes_adicional || 0,
        interes_adicional_total: (planCuotas?.interes_adicional || 0) * cantidad,
        redondeo_unitario: precio.ajuste_redondeo, redondeo_total: precio.ajuste_redondeo * cantidad, incremento_redondeo: precio.incremento_redondeo,
        descuento_unitario: (medioPago === 'pago_unico' ? precio.descuento_pago_unico : 0),
        descuento_total: (medioPago === 'pago_unico' ? precio.descuento_pago_unico : 0) * cantidad,
        ganancia_bruta: (precio_unitario - precio.costo_daz) * cantidad,
        tasa_anual: precio.tasa_anual, dias_financiacion: precio.dias_financiacion, url_origen: p.url_origen };
    });
    if (items.some(x=>!x)) return res.status(400).json({ error: 'Un producto no está disponible o no tiene habilitada esa cantidad de cuotas. Revisá tu carrito.' });
    const totalServidor = items.reduce((sum, item) => sum + item.subtotal, 0);
    const totalEsperado = toNumber(req.body.total_esperado);
    if (totalEsperado === null || totalEsperado !== totalServidor) return res.status(409).json({ error: 'Los precios cambiaron desde que abriste el catálogo. Actualizá la página y revisá tu pedido antes de enviarlo.' });
    const now = new Date().toISOString();
    const id = `PED-${String(db.nextOrder++).padStart(5, '0')}`;
    const order = { id, creado_en: now, actualizado_en: now, telefono, nombre, nota,
      consentimiento_contacto: consentimiento, medio_pago: medioPago, items,
      total: totalServidor,
      total_costo: items.reduce((a,b)=>a+b.costo_total,0),
      total_administrativo: items.reduce((a,b)=>a+b.administrativo_total,0),
      total_interes: items.reduce((a,b)=>a+b.interes_total,0),
      total_interes_adicional: items.reduce((a,b)=>a+b.interes_adicional_total,0),
      plan_cuotas: mesesSeleccionados ? { meses:mesesSeleccionados, importes: distribuirCuotas(totalServidor,mesesSeleccionados), ganancia_promedio_mensual: items.reduce((a,b)=>a+b.ganancia_bruta,0)/mesesSeleccionados } : null,
      total_redondeo: items.reduce((a,b)=>a+b.redondeo_total,0),
      total_descuento: items.reduce((a,b)=>a+b.descuento_total,0),
      ganancia_ticket: items.reduce((a,b)=>a+b.ganancia_bruta,0),
      estado: 'pendiente' };
    db.orders.unshift(order);
    await save();
    res.status(201).json({ id: order.id, total: order.total, estado: order.estado });
  } catch (e) { console.error(e); res.status(500).json({ error: 'No se pudo guardar el pedido.' }); }
});
app.post('/api/admin/login', async (req, res) => {
  cleanFailed();
  const ip = req.ip || 'unknown'; const record = failedLogins.get(ip) || { count: 0, reset: Date.now()+15*60*1000 };
  if (record.count >= 8 && Date.now() < record.reset) return res.status(429).json({ error: 'Demasiados intentos. Volvé a intentar en 15 minutos.' });
  const username = ensureString(req.body.username, 100), pass = String(req.body.password ?? '');
  const passA = crypto.createHash('sha256').update(pass).digest();
  const passB = crypto.createHash('sha256').update(adminPassword).digest();
  if (username !== adminUser || !crypto.timingSafeEqual(passA, passB)) {
    failedLogins.set(ip, { count: record.count+1, reset: record.reset });
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }
  failedLogins.delete(ip);
  const payload = Buffer.from(JSON.stringify({ sub: adminUser, exp: Date.now()+12*60*60*1000 })).toString('base64url');
  setCookie(res, `${payload}.${sign(payload)}`);
  res.json({ ok: true, user: adminUser });
});
app.post('/api/admin/logout', adminOnly, (req,res) => { setCookie(res, '', 0); res.json({ ok:true }); });
app.get('/api/admin/me', (req,res) => res.json({ authenticated: checkSession(req), user: checkSession(req) ? adminUser : null }));
app.get('/api/admin/overview', adminOnly, (req,res) => res.json({ settings: db.settings, products: db.products.map(priced), orders: db.orders, tasaOverrides: db.tasaOverrides, redondeoOverrides: db.redondeoOverrides }));
app.patch('/api/admin/settings', adminOnly, async (req,res) => {
  const tasa = toNumber(req.body.tasaAnual);
  if (tasa === null || tasa < 0 || tasa > 1000) return res.status(400).json({ error: 'La TNA debe estar entre 0 y 1000%.' });
  if (Object.hasOwn(req.body, 'redondeo')) {
    try { db.settings.redondeo = validarRedondeo(req.body.redondeo); }
    catch (e) { return res.status(400).json({ error: e.message }); }
  }
  db.settings.tasaAnual = tasa;
  const name = ensureString(req.body.tiendaNombre || db.settings.tiendaNombre, 70);
  if (name) db.settings.tiendaNombre = name;
  // Plazo fijo a 90 días como referencia comercial; se publica en las condiciones.
  db.settings.diasFinanciacion = DIAS_REFERENCIA;
  await save(); res.json({ ok:true, settings: db.settings });
});
app.patch('/api/admin/products/:sku', adminOnly, async (req,res) => {
  const sku = req.params.sku;
  const p = db.products.find(x=>x.sku===sku);
  if (!p) return res.status(404).json({ error: 'No se encontró el producto.' });
  // Primero validamos TODA la solicitud; no mutamos la base si un dato es inválido.
  let nextTna, nextRound, nextCuotas;
  const changesTna = Object.hasOwn(req.body, 'tasaAnual');
  const changesRound = Object.hasOwn(req.body, 'redondeo');
  const changesCuotas = Object.hasOwn(req.body, 'cuotas');
  if (changesTna && req.body.tasaAnual !== null) {
    nextTna = toNumber(req.body.tasaAnual);
    if (nextTna === null || nextTna < 0 || nextTna > 1000) return res.status(400).json({ error: 'La TNA del producto debe estar entre 0 y 1000%.' });
  }
  if (changesRound && req.body.redondeo !== null) {
    try { nextRound = validarRedondeo(req.body.redondeo); }
    catch (e) { return res.status(400).json({ error: e.message }); }
  }
  if (changesCuotas) {
    if (!Array.isArray(req.body.cuotas) || req.body.cuotas.length > 3 || req.body.cuotas.some(n=>!CUOTAS_DISPONIBLES.includes(n)) || new Set(req.body.cuotas).size !== req.body.cuotas.length)
      return res.status(400).json({ error: 'Las cuotas deben ser una lista sin repetidos con valores 3, 6 o 9.' });
    nextCuotas = [...req.body.cuotas].sort((a,b)=>a-b);
  }
  if (changesTna) { if (req.body.tasaAnual === null) delete db.tasaOverrides[sku]; else db.tasaOverrides[sku] = nextTna; }
  if (changesRound) { if (req.body.redondeo === null) delete db.redondeoOverrides[sku]; else db.redondeoOverrides[sku] = nextRound; }
  if (changesCuotas) db.cuotasOverrides[sku] = nextCuotas;
  if (typeof req.body.activo === 'boolean') p.activo = req.body.activo;
  await save(); res.json({ ok:true, product:priced(p) });
});
app.patch('/api/admin/orders/:id', adminOnly, async (req,res) => {
  const order = db.orders.find(o=>o.id === req.params.id);
  if (!order) return res.status(404).json({error:'Pedido no encontrado.'});
  const states = ['pendiente','en_preparacion','comprado','entregado','cancelado'];
  if (!states.includes(req.body.estado)) return res.status(400).json({error:'Estado inválido.'});
  order.estado = req.body.estado; order.actualizado_en = new Date().toISOString();
  await save(); res.json({ok:true, order});
});
app.post('/api/admin/import', adminOnly, async (req,res) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : req.body.productos;
    if (!Array.isArray(payload) || !payload.length || payload.length > 10000) return res.status(400).json({error:'Esperaba productos[] (1 a 10.000 registros).'});
    const normalized = payload.map(normalizeProduct).filter(Boolean);
    if (!normalized.length) return res.status(400).json({error:'No se encontraron productos válidos con SKU, nombre y precio superior de DAZ. Verificá la extracción.'});
    const prev = new Map(db.products.map(x=>[x.sku,x]));
    const unique = new Map();
    for (const p of normalized) {
      const old = prev.get(p.sku);
      unique.set(p.sku, { ...p, activo: old ? old.activo : p.activo });
    }
    let added = 0, updated = 0, costosModificados = 0;
    for (const [sku,p] of unique) {
      if (prev.has(sku)) {
        updated++;
        if (Number(prev.get(sku).precio_lista) !== p.precio_lista) costosModificados++;
      } else added++;
      prev.set(sku,p);
    }
    db.products = [...prev.values()];
    await save(); res.json({ok:true, recibidos:payload.length, validos:unique.size, omitidos:payload.length-normalized.length, agregados:added, actualizados:updated, costos_modificados:costosModificados, total:db.products.length});
  } catch(e) { console.error(e); res.status(500).json({error:'No se pudo importar el catálogo.'}); }
});
// Para la tienda instalada en un VPS, Express también entrega los archivos estáticos de Vite.
const dist = path.join(root, 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req,res) => res.sendFile(path.join(dist,'index.html')));
}
const port = Number(process.env.PORT || 3001);
app.listen(port, prod ? '0.0.0.0' : '127.0.0.1', () => console.log(`API lista en http://localhost:${port} (${db.products.length} productos)`));
