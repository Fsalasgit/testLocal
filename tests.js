import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { calcularPrecio, precioPorMedio, redondearHaciaArriba, validarRedondeo, calcularPlanCuotas, distribuirCuotas, CUOTAS_DISPONIBLES } from './src/pricing.js';
const source=fs.readFileSync(new URL('./server/index.js', import.meta.url),'utf8');
const region=source.slice(source.indexOf('const ensureString ='),source.indexOf('function blank()'));
const ctx=vm.createContext({Number,String,Object,URL,Array,RegExp});
vm.runInContext(`${region}; globalThis.normalizeProduct=normalizeProduct;`,ctx);
const p=ctx.normalizeProduct({sku:'01010150',nombre:'Torno profesional OM-210',precio_lista:23300,categorias:['Belleza &amp; Cuidado Personal'],imagenes:['https://dazimportadora.com.ar/wp-content/uploads/2026/09/articulos-agosto-2026-09-10T132016.703.jpg']});
assert.equal(p.sku,'01010150');assert.equal(p.categorias[0],'Belleza & Cuidado Personal');assert.equal(p.imagenes.length,1);
assert.equal(ctx.normalizeProduct({sku:'X',nombre:'Sin precio'}),null);
const superiores=ctx.normalizeProduct({sku:'DAZ-SUONO',nombre:'Lavarropas SUONO',precio_lista:760000,precio_transferencia_daz:813200,precio_efectivo:760000});
assert.equal(superiores.precio_lista,813200);
assert.equal(superiores.precio_transferencia_daz,813200);
assert.equal(superiores.precio_efectivo_web,760000);
const soloEfectivo=ctx.normalizeProduct({sku:'CASH',nombre:'No usar efectivo',precio_lista:760000,precio_transferencia_daz:null,precio_efectivo_web:760000});
assert.equal(soloEfectivo,null);
assert.equal(ctx.normalizeProduct({sku:'SOLO-EFECTIVO',nombre:'Sin precio superior',precio_efectivo:760000}),null);
const pSuono=calcularPrecio(superiores.precio_lista,10,90,1000);
assert.equal(pSuono.costo_daz,813200);
assert.equal(pSuono.cargo_administrativo,40660);
assert(pSuono.precio_venta>superiores.precio_lista);

// Nunca redondear hacia abajo, independientemente del incremento.
assert.equal(redondearHaciaArriba(1602,1000),2000);
assert.equal(redondearHaciaArriba(1602,100),1700);
assert.equal(redondearHaciaArriba(1602,10),1610);
assert.equal(redondearHaciaArriba(1600,100),1600);
assert.equal(redondearHaciaArriba(1602,500),2000);
assert.equal(validarRedondeo(50),50);
assert.throws(()=>validarRedondeo(0));assert.throws(()=>validarRedondeo(-10));assert.throws(()=>validarRedondeo(1.5));
const ej=calcularPrecio(10000,60,90,1000);
assert.equal(ej.costo_daz,10000);assert.equal(ej.cargo_administrativo,500);assert.equal(ej.base_financiada,10500);assert.equal(ej.interes_periodo,1553);
assert.equal(ej.precio_sin_redondeo,12053);assert.equal(ej.ajuste_redondeo,947);
assert.equal(ej.precio_venta,13000);assert.equal(ej.precio_pago_unico,11700);assert.equal(ej.descuento_pago_unico,1300);
assert.equal(ej.ganancia_regular,3000);assert.equal(ej.ganancia_pago_unico,1700);
assert.equal(ej.rentabilidad_regular_pct,30);assert.equal(ej.rentabilidad_pago_unico_pct,17);
assert.equal(precioPorMedio(ej,'regular'),13000);assert.equal(precioPorMedio(ej,'pago_unico'),11700);
const demo=calcularPrecio(1602,0,90,1000);
assert.equal(demo.cargo_administrativo,80);assert.equal(demo.precio_sin_redondeo,1682);assert.equal(demo.precio_venta,2000);assert.equal(demo.precio_pago_unico,1800);
const cart=[{precio:calcularPrecio(10000,60,90,100),q:2},{precio:calcularPrecio(23300,60,90,1000),q:1}];
for (const medio of ['regular','pago_unico']) {
 const costo=cart.reduce((x,i)=>x+i.precio.costo_daz*i.q,0);
 const total=cart.reduce((x,i)=>x+precioPorMedio(i.precio,medio)*i.q,0);
 const gain=cart.reduce((x,i)=>x+(precioPorMedio(i.precio,medio)-i.precio.costo_daz)*i.q,0);
 assert.equal(gain,total-costo);
}
assert.throws(()=>calcularPrecio(1000,-1));assert.throws(()=>calcularPrecio(1000,50,0));
const frontend=fs.readFileSync(new URL('./src/pages/Catalog.jsx',import.meta.url),'utf8');
assert(frontend.includes('checked={form.consentimiento}'));
assert(frontend.includes('const proxy = product?.imagen_url'));
assert(frontend.includes('transferencia (10% de descuento)'));
const adminUI = fs.readFileSync(new URL('./src/components/PricingAdmin.jsx', import.meta.url), 'utf8');
assert(adminUI.includes('<SupplierProductPreview product={p}/>'));
assert(adminUI.includes('Ver y comprar en DAZ'));
assert(adminUI.includes('searchLink(product)'));
assert(adminUI.includes('referrerPolicy="no-referrer"'));
assert(adminUI.includes('/api/images/'));
assert(source.includes('total_redondeo:'));
assert(source.includes('db.redondeoOverrides'));
assert(source.includes('redondeo: REDONDEO_PREDETERMINADO'));

// 3 cuotas sobre lista; 6 y 9 cobran solamente los meses adicionales (TNA simple).
const financingBase=calcularPrecio(10000,60,90,1000);
const pl3=calcularPlanCuotas(financingBase,3);
const pl6=calcularPlanCuotas(financingBase,6);
const pl9=calcularPlanCuotas(financingBase,9);
assert.deepEqual(CUOTAS_DISPONIBLES,[3,6,9]);
assert.equal(pl3.total,13000);assert.equal(pl3.interes_adicional,0);
assert.equal(pl6.interes_adicional,Math.round(13000*0.6*90/365));
assert.equal(pl9.interes_adicional,Math.round(13000*0.6*180/365));
for(const plan of [pl3,pl6,pl9]) {
  assert.equal(plan.cuotas.length,plan.meses);
  assert.equal(plan.cuotas.reduce((a,b)=>a+b,0),plan.total);
  assert.equal(plan.ganancia_total,plan.total-financingBase.costo_daz);
  assert.equal(plan.ganancia_mensual_promedio * plan.meses,plan.ganancia_total);
  assert.equal(plan.flujo_mensual[0].egreso_proveedor,financingBase.costo_daz);
  assert.equal(plan.flujo_mensual.at(-1).acumulado,plan.ganancia_total);
  assert.equal(precioPorMedio(financingBase,`cuotas_${plan.meses}`),plan.total);
}
assert.deepEqual(distribuirCuotas(2000,3),[667,667,666]);
assert.throws(()=>calcularPlanCuotas(financingBase,12));
assert.throws(()=>precioPorMedio(financingBase,'cuotas_12'));
assert.throws(()=>distribuirCuotas(-2,3));
const cuotasCart=[{precio:calcularPrecio(10000,60,90,100),q:2},{precio:calcularPrecio(23300,45,90,1000),q:1}];
for (const n of [3,6,9]) {
  const total=cuotasCart.reduce((a,c)=>a+c.q*calcularPlanCuotas(c.precio,n).total,0);
  assert.equal(distribuirCuotas(total,n).reduce((a,b)=>a+b,0),total);
}
assert(source.includes('db.cuotasOverrides ||= {}'));
assert(source.includes('!precio.cuotas_habilitadas.includes(mesesSeleccionados)'));
assert(source.includes('total_interes_adicional:'));
assert(source.includes('plan_cuotas: mesesSeleccionados ?'));
const catalogUI=fs.readFileSync(new URL('./src/pages/Catalog.jsx',import.meta.url),'utf8');
assert(catalogUI.includes('cuotasComunes'));
assert(catalogUI.includes('medio_pago:medioEfectivo'));
const modalUI=fs.readFileSync(new URL('./src/components/PricingAdmin.jsx',import.meta.url),'utf8');
assert(modalUI.includes('Ver información financiera'));
assert(modalUI.includes('cuotas:installments'));

console.log('OK: normalización DAZ, redondeos 10/100/500/1000, 5% administrativo, TNA, transferencia -10%, rentabilidad, tickets y simulaciones de 3/6/9 cuotas.');

assert(source.includes('precio_transferencia_daz: precio_lista'));
assert(source.includes('precio_efectivo_web'));
