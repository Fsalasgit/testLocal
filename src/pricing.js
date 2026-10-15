// Reglas compartidas por servidor y tienda. TNA simple a 90 días / 365.
// La ganancia estimada no descuenta impuestos, logística, comisiones ni gastos financieros reales.
export const ADMIN_PCT = 5;
export const PAGO_UNICO_DESCUENTO_PCT = 10;
export const DIAS_REFERENCIA = 90;
export const FINANCIACION_DIAS_ANIO = 365;
export const REDONDEO_PREDETERMINADO = 1000;
export const REDONDEOS_SUGERIDOS = [10, 100, 500, 1000];
export const precioARS = value => Math.round(value);
export const CUOTAS_DISPONIBLES = [3, 6, 9];

// Divide el total sin crear diferencias de redondeo: la suma de cuotas coincide con el precio.
export function distribuirCuotas(total, meses) {
  if (!Number.isSafeInteger(total) || total < 0 || !CUOTAS_DISPONIBLES.includes(meses)) throw new Error('Total o número de cuotas inválido.');
  const base = Math.floor(total / meses), extra = total % meses;
  return Array.from({ length: meses }, (_, i) => base + (i < extra ? 1 : 0));
}

// La cuota sin interés ADICIONAL es la de 3 meses: el precio lista ya incluye 90 días de TNA.
// Para 6 y 9 cuotas, sumamos interés simple sobre el precio lista por los 90/180 días extra.
export function calcularPlanCuotas(precio, meses) {
  if (!CUOTAS_DISPONIBLES.includes(meses)) throw new Error('Solo se admiten planes de 3, 6 o 9 cuotas.');
  const importe = Number(precio.precio_venta), costo = Number(precio.costo_daz), tna = Number(precio.tasa_anual);
  if (![importe, costo, tna].every(Number.isFinite) || importe <= 0 || costo <= 0 || tna < 0 || tna > 1000) throw new Error('Datos inválidos para calcular financiación.');
  const mesesExtra = Math.max(0, meses - 3);
  const diasExtra = mesesExtra * 30;
  const interesAdicional = precioARS(importe * (tna / 100) * (diasExtra / FINANCIACION_DIAS_ANIO));
  const total = importe + interesAdicional;
  const cuotas = distribuirCuotas(total, meses);
  const gananciaTotal = total - costo;
  let acumulado = -costo;
  const flujoMensual = cuotas.map((cobro, i) => {
    acumulado += cobro;
    return { mes: i + 1, cobro, egreso_proveedor: i === 0 ? costo : 0, flujo_neto: cobro - (i === 0 ? costo : 0), acumulado };
  });
  return { meses, meses_extra: mesesExtra, dias_extra: diasExtra, interes_adicional: interesAdicional, total, cuotas, valor_cuota_desde: Math.min(...cuotas), valor_cuota_hasta: Math.max(...cuotas), ganancia_total: gananciaTotal, ganancia_mensual_promedio: gananciaTotal / meses, rentabilidad_pct: gananciaTotal / costo * 100, flujo_mensual: flujoMensual, mes_recuperacion: flujoMensual.find(f => f.acumulado >= 0)?.mes ?? null };
}


export function validarRedondeo(value) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > 100000) throw new Error('El incremento de redondeo debe ser un entero entre $1 y $100.000.');
  return n;
}

export function redondearHaciaArriba(importe, incremento = REDONDEO_PREDETERMINADO) {
  const step = validarRedondeo(incremento);
  if (!Number.isFinite(importe) || importe < 0) throw new Error('Importe inválido para redondear.');
  return Math.ceil(importe / step) * step;
}

export function calcularPrecio(precioLista, tasaAnual = 0, dias = DIAS_REFERENCIA, incremento = REDONDEO_PREDETERMINADO) {
  const costo = Number(precioLista);
  const tasa = Number(tasaAnual);
  const plazo = Number(dias);
  const redondeo = validarRedondeo(incremento);
  if (!Number.isFinite(costo) || costo <= 0 || !Number.isFinite(tasa) || tasa < 0 || tasa > 1000 || !Number.isInteger(plazo) || plazo < 1 || plazo > 365) {
    throw new Error('Datos de precio, tasa anual o plazo inválidos.');
  }
  const cargoAdministrativo = precioARS(costo * ADMIN_PCT / 100);
  const baseFinanciada = precioARS(costo + cargoAdministrativo);
  const interesPeriodo = precioARS(baseFinanciada * (tasa / 100) * (plazo / FINANCIACION_DIAS_ANIO));
  const precioSinRedondeo = baseFinanciada + interesPeriodo;
  const precioRegular = redondearHaciaArriba(precioSinRedondeo, redondeo);
  const precioTransferencia = precioARS(precioRegular * (1 - PAGO_UNICO_DESCUENTO_PCT / 100));
  const gananciaRegular = precioRegular - costo;
  const gananciaTransferencia = precioTransferencia - costo;
  return {
    costo_daz: costo,
    cargo_administrativo: cargoAdministrativo,
    base_financiada: baseFinanciada,
    interes_periodo: interesPeriodo,
    precio_sin_redondeo: precioSinRedondeo,
    ajuste_redondeo: precioRegular - precioSinRedondeo,
    incremento_redondeo: redondeo,
    precio_venta: precioRegular,
    precio_pago_unico: precioTransferencia,
    descuento_pago_unico: precioRegular - precioTransferencia,
    ganancia_regular: gananciaRegular,
    ganancia_pago_unico: gananciaTransferencia,
    // Rentabilidad = ganancia / costo DAZ × 100. No es margen sobre ventas.
    rentabilidad_regular_pct: (gananciaRegular / costo) * 100,
    rentabilidad_pago_unico_pct: (gananciaTransferencia / costo) * 100,
    tasa_anual: tasa,
    dias_financiacion: plazo
  };
}

export function precioPorMedio(precio, medioPago) {
  if (medioPago === 'pago_unico') return precio.precio_pago_unico;
  if (medioPago === 'regular') return precio.precio_venta;
  const match = /^cuotas_(3|6|9)$/.exec(String(medioPago));
  if (match) return calcularPlanCuotas(precio, Number(match[1])).total;
  throw new Error('Medio de pago no reconocido.');
}
