import React, {useEffect, useMemo, useRef, useState} from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, BarChart3, Check, Edit3, ExternalLink, Eye, EyeOff, Package, Save, Search, TrendingUp, UploadCloud, X } from 'lucide-react';
import { money, patch, post, searchLink } from '../lib';
import { calcularPrecio, ADMIN_PCT, PAGO_UNICO_DESCUENTO_PCT, DIAS_REFERENCIA, REDONDEO_PREDETERMINADO, REDONDEOS_SUGERIDOS, CUOTAS_DISPONIBLES, calcularPlanCuotas } from '../pricing';

const pct = value => `${new Intl.NumberFormat('es-AR',{maximumFractionDigits:2, minimumFractionDigits:1}).format(value ?? 0)}%`;
const COLUMNS = [
  ['nombre','Producto',false],
  ['costo_daz','Costo DAZ transf.',true],
  ['cargo_administrativo','Admin. 5%',true],
  ['interes_periodo','Interés',true],
  ['precio_venta','Precio lista',true],
  ['precio_pago_unico','Transferencia',true],
  ['ganancia_regular','Ganancia lista',true],
  ['rentabilidad_regular_pct','Rentab. lista',true],
  ['ganancia_pago_unico','Ganancia transf.',true],
  ['rentabilidad_pago_unico_pct','Rentab. transf.',true],
  ['tasa_anual','TNA',true],
  ['incremento_redondeo','Redondeo',true]
];
const percentages = new Set(['tasa_anual','rentabilidad_regular_pct','rentabilidad_pago_unico_pct']);
const currency = new Set(['costo_daz','cargo_administrativo','interes_periodo','precio_venta','precio_pago_unico','ganancia_regular','ganancia_pago_unico','incremento_redondeo']);
const getSort = (p, field) => field==='nombre' ? p.nombre : p[field];
const moneyOrPercent = (p,field) => percentages.has(field) ? pct(p[field]) : currency.has(field) ? money(p[field]) : p[field];

export function ProductsTable({products,onEdit,onSave,initialSort='nombre',title='Listado de productos'}) {
  const [query,setQuery]=useState('');
  const [sortKey,setSortKey]=useState(initialSort);
  const [direction,setDirection]=useState(initialSort==='nombre'?'asc':'desc');
  const [firstCustom,setFirstCustom]=useState(false);
  const [onlyCustom,setOnlyCustom]=useState(false);
  const [onlyVisible,setOnlyVisible]=useState(false);
  const [limit,setLimit]=useState(40);
  const [busySku,setBusySku]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>setLimit(40),[query,onlyCustom,onlyVisible,sortKey,direction,firstCustom]);
  const filtered=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase('es-AR');
    return products.filter(p=>(!onlyCustom||p.tasa_personalizada) && (!onlyVisible||p.activo) && (!q||`${p.nombre} ${p.sku} ${(p.categorias||[]).join(' ')} ${p.marca||''}`.toLocaleLowerCase('es-AR').includes(q)) ).sort((a,b)=>{
      if (firstCustom && a.tasa_personalizada!==b.tasa_personalizada) return a.tasa_personalizada?-1:1;
      const av=getSort(a,sortKey), bv=getSort(b,sortKey);
      const diff=typeof av==='string' ? av.localeCompare(String(bv),'es') : Number(av)-Number(bv);
      return (direction==='asc'?1:-1) * diff || a.sku.localeCompare(b.sku);
    });
  },[products,query,onlyCustom,onlyVisible,firstCustom,sortKey,direction]);
  function sortBy(key){ if(sortKey===key) setDirection(v=>v==='asc'?'desc':'asc'); else {setSortKey(key);setDirection(key==='nombre'?'asc':'desc');}}
  async function toggleTna(p) {
    setBusySku(p.sku);setError('');
    try{ await onSave(p.sku,{tasaAnual:p.tasa_personalizada?null:p.tasa_anual}); }
    catch(e){setError(e.message);}finally{setBusySku('');}
  }
  return <section className="admin-panel admin-table-panel">
    <div className="admin-section-header"><div><h2>{title}</h2><p>Ordená desde los encabezados. Tocá el nombre de un producto para modificar su TNA, su redondeo o su visibilidad.</p></div><strong className="small-count">{filtered.length} / {products.length} productos</strong></div>
    <div className="pricing-toolbar">
      <label className="admin-search wide"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar producto, código o categoría…"/></label>
      <label className="pricing-check"><input type="checkbox" checked={firstCustom} onChange={e=>setFirstCustom(e.target.checked)}/> TNA modificadas primero</label>
      <label className="pricing-check"><input type="checkbox" checked={onlyCustom} onChange={e=>setOnlyCustom(e.target.checked)}/> Solo TNA modificadas</label>
      <label className="pricing-check"><input type="checkbox" checked={onlyVisible} onChange={e=>setOnlyVisible(e.target.checked)}/> Solo visibles</label>
    </div>
    {error&&<div className="notice error">{error}</div>}
    <div className="pricing-table-scroll" role="region" aria-label="Tabla de precios ordenable" tabIndex={0}>
      <table className="pricing-data-table"><thead><tr><th scope="col" className="sticky-name">TNA propia</th>{COLUMNS.map(([key,label])=><th key={key} scope="col" aria-sort={sortKey===key?(direction==='asc'?'ascending':'descending'):'none'}><button className="table-sort-button" onClick={()=>sortBy(key)} title={`Ordenar por ${label}`}>{label} {sortKey===key?(direction==='asc'?<ArrowUp size={13}/>:<ArrowDown size={13}/>):<span className="sort-hint">↕</span>}</button></th>)}<th>Acción</th></tr></thead>
      <tbody>{filtered.slice(0,limit).map(p=><tr key={p.sku} className={p.activo?'':'inactive-product'}>
        <td className="table-tna-checkbox"><label title={p.tasa_personalizada?'Quitar TNA individual':'Usar TNA individual'}><input type="checkbox" checked={Boolean(p.tasa_personalizada)} onChange={()=>toggleTna(p)} disabled={busySku===p.sku}/></label></td>
        {COLUMNS.map(([key])=><td key={key} className={key==='nombre'?'table-product-cell':`${key.includes('rentabilidad')?'table-pct-cell':''} ${p[key]<0?'negative':''}`}>
          {key==='nombre'?<button className="table-product-link" onClick={()=>onEdit(p.sku)} title="Editar producto"><b>{p.nombre}</b><small>{p.sku} · {(p.categorias||[])[0]||'Sin categoría'}{!p.activo?' · OCULTO':''}</small></button>:<>{moneyOrPercent(p,key)}{key==='tasa_anual'&&p.tasa_personalizada&&<small className="personalized-pill">Personalizada</small>}{key==='incremento_redondeo'&&p.redondeo_personalizado&&<small className="personalized-pill">Propio</small>}</>}
        </td>)}
        <td><button className="table-edit-button" onClick={()=>onEdit(p.sku)} aria-label={`Editar ${p.nombre}`}><Edit3 size={14}/> Editar</button></td>
      </tr>)}</tbody></table>
    </div>
    {filtered.length===0&&<div className="admin-empty">No hay productos que coincidan con los filtros.</div>}
    {filtered.length>limit&&<button className="btn btn-outline more-admin" onClick={()=>setLimit(n=>n+60)}>Mostrar más ({filtered.length-limit} restantes)</button>}
    <p className="pricing-table-note">Rentabilidad = (ganancia bruta ÷ costo DAZ) × 100. No incluye flete, impuestos ni comisiones. En el celular desplazá la tabla horizontalmente.</p>
  </section>;
}

// La imagen del modal usa primero la caché/proxy del servidor y luego la URL de DAZ.
// El enlace abre la ficha del proveedor, sin efectuar una compra automática.
function SupplierProductPreview({ product }) {
  const original = product.imagenes?.[0] || '';
  const proxy = product.imagen_url || (original
    ? `/api/images/${encodeURIComponent(product.sku)}?v=${encodeURIComponent(original.split('/').pop())}`
    : '');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [proxy, original]);
  const imageSrc = attempt === 0 ? (proxy || original)
    : attempt === 1 && proxy && original && proxy !== original ? original : '';
  const direct = Boolean(product.url_origen);

  return <div className="pricing-supplier-preview">
    <div className="pricing-supplier-photo">
      {imageSrc
        ? <img src={imageSrc} alt={`Foto de ${product.nombre}`} loading="eager" decoding="async" referrerPolicy="no-referrer" onError={() => setAttempt(n => n + 1)}/>
        : <div className="pricing-supplier-no-photo"><Package size={34} strokeWidth={1.5}/><span>Sin imagen disponible</span></div>}
    </div>
    <div className="pricing-supplier-details">
      <span className="pricing-supplier-label">PRODUCTO EN DAZ IMPORTADORA</span>
      <p>Consultá la publicación original para verificar disponibilidad y comprarle al proveedor.</p>
      <div className="pricing-supplier-price-reference">
        <b>Base de cálculo: {money(product.precio_transferencia_daz ?? product.precio_lista)}</b>
        {Number(product.precio_efectivo_web)>0&&<small>Efectivo web DAZ: {money(product.precio_efectivo_web)} (solo informativo)</small>}
      </div>
      <a href={searchLink(product)} className="pricing-supplier-button" target="_blank" rel="noopener noreferrer">
        <ExternalLink size={16}/>{direct ? 'Ver y comprar en DAZ' : 'Buscar producto en DAZ'}
      </a>
      {!direct && <small className="pricing-supplier-note">No se importó un enlace directo. La búsqueda utiliza el SKU {product.sku}.</small>}
    </div>
  </div>;
}

export function ProductEditModal({p,globalTna,globalRounding,onClose,onSave}) {
  const [customTna,setCustomTna]=useState(Boolean(p.tasa_personalizada));
  const [tna,setTna]=useState(String(p.tasa_anual));
  const [customRound,setCustomRound]=useState(Boolean(p.redondeo_personalizado));
  const [rounding,setRounding]=useState(String(p.incremento_redondeo));
  const [active,setActive]=useState(Boolean(p.activo));
  const [installments,setInstallments]=useState(p.cuotas_habilitadas || []);
  const [financialOpen,setFinancialOpen]=useState(false);
  const [selectedPlan,setSelectedPlan]=useState(3);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const effectiveTna=customTna?Number(tna):Number(globalTna);
  const effectiveRounding=customRound?Number(rounding):Number(globalRounding);
  let preview=null;
  try {preview=calcularPrecio(p.precio_lista,effectiveTna,DIAS_REFERENCIA,effectiveRounding);}catch{}
  const planes = preview ? CUOTAS_DISPONIBLES.map(n=>calcularPlanCuotas(preview,n)) : [];
  const detalle = planes.find(plan=>plan.meses===selectedPlan);
  const togglePlan = n => setInstallments(prev=>prev.includes(n)?prev.filter(x=>x!==n):[...prev,n].sort((a,b)=>a-b));
  async function save(e) {
    e.preventDefault();setError('');
    if(!preview){setError('Revisá la TNA y el incremento de redondeo.');return;}
    setBusy(true);
    try {await onSave(p.sku,{tasaAnual:customTna?Number(tna):null,redondeo:customRound?Number(rounding):null,cuotas:installments,activo:active});onClose();}
    catch(err){setError(err.message);}finally{setBusy(false);}
  }
  return <div className="modal-scrim modal-center pricing-modal-shade" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <section className="pricing-edit-modal" role="dialog" aria-modal="true" aria-label={`Editar ${p.nombre}`}><div className="pricing-edit-header"><div><div className="section-kicker">EDITAR PRODUCTO</div><h2>{p.nombre}</h2><small>SKU {p.sku} · Costo DAZ (precio superior) {money(p.precio_lista)}</small></div><button aria-label="Cerrar edición" onClick={onClose} className="icon-button"><X size={19}/></button></div>
      <SupplierProductPreview product={p}/>
      <form onSubmit={save}><div className="pricing-edit-fields">
        <label className="pricing-switch"><input type="checkbox" checked={customTna} onChange={e=>setCustomTna(e.target.checked)}/><span>Definir TNA individual <small>Si no, utiliza la global ({pct(globalTna)})</small></span></label>
        {customTna&&<label>TNA del producto (%)<input autoFocus type="number" min="0" max="1000" step="0.01" required value={tna} onChange={e=>setTna(e.target.value)}/></label>}
        <label className="pricing-switch"><input type="checkbox" checked={customRound} onChange={e=>setCustomRound(e.target.checked)}/><span>Definir redondeo individual <small>Si no, utiliza el global ({money(globalRounding)})</small></span></label>
        {customRound&&<label>Redondear hacia arriba de $…<input type="number" min="1" max="100000" step="1" required value={rounding} onChange={e=>setRounding(e.target.value)}/></label>}
        <label className="pricing-switch"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/><span>Visible en la tienda</span></label>
      </div>
      <div className="pricing-finance-setup">
        <div className="pricing-installments-heading"><div><strong>Planes de cuotas para el cliente</strong><small>Activá los planes que querés ofrecer con este producto. La TNA propia o global se aplica también a las cuotas adicionales.</small></div></div>
        <div className="pricing-installment-toggles">
          {CUOTAS_DISPONIBLES.map(n=><label key={n} className={`pricing-installment-choice ${installments.includes(n)?'checked':''}`}>
            <input type="checkbox" checked={installments.includes(n)} onChange={()=>togglePlan(n)}/>
            <span><b>{n} cuotas</b><small>{n===3?'Sin interés adicional':`+ interés de ${(n-3)*30} días`}</small></span>
            {planes.length>0&&<strong>{money(planes.find(x=>x.meses===n).cuotas[0])}<small>por mes aprox.</small></strong>}
          </label>)}
        </div>
        <div className="pricing-finance-note">Las 3 cuotas no agregan interés sobre el precio de lista; ese precio ya contiene el interés TNA base de 90 días. En 6 y 9 cuotas se aplica interés simple por los meses adicionales.</div>
        <button className="pricing-finance-toggle" type="button" aria-expanded={financialOpen} onClick={()=>setFinancialOpen(v=>!v)}>{financialOpen?<EyeOff size={18}/>:<Eye size={18}/>} {financialOpen?'Ocultar información financiera':'Ver información financiera'} <span>{financialOpen?'−':'+'}</span></button>
        {financialOpen&&preview&&<div className="pricing-finance-analysis">
          <div className="pricing-plan-tabs" role="group" aria-label="Simulaciones financieras por cuotas">{CUOTAS_DISPONIBLES.map(n=><button type="button" key={n} onClick={()=>setSelectedPlan(n)} className={selectedPlan===n?'active':''}>{n} cuotas {installments.includes(n)?'· Activo':'· Inactivo'}</button>)}</div>
          <div className="pricing-finance-kpis">
            <div><small>Importe total al cliente</small><b>{money(detalle.total)}</b></div>
            <div><small>Interés adicional</small><b>{money(detalle.interes_adicional)}</b></div>
            <div><small>Ganancia bruta total</small><b className={detalle.ganancia_total<0?'negative':''}>{money(detalle.ganancia_total)}</b></div>
            <div><small>Ganancia mensual prorrateada</small><b>{money(detalle.ganancia_mensual_promedio)}</b></div>
          </div>
          <div className="pricing-flow-scroll"><table className="pricing-flow-table"><thead><tr><th>Mes</th><th>Cuota cobrada</th><th>Egreso DAZ</th><th>Flujo neto</th><th>Acumulado</th></tr></thead><tbody>{detalle.flujo_mensual.map(f=><tr key={f.mes}><td>{f.mes}</td><td>{money(f.cobro)}</td><td>{money(f.egreso_proveedor)}</td><td className={f.flujo_neto<0?'negative':''}>{money(f.flujo_neto)}</td><td className={f.acumulado<0?'negative':''}>{money(f.acumulado)}</td></tr>)}</tbody></table></div>
          <div className="pricing-finance-explainer">Ganancia mensual: total de ganancia bruta ÷ cantidad de cuotas (prorrateo, <b>no</b> ingreso mensual efectivo). El flujo supone que se paga el costo DAZ completo en el primer mes y se cobran todas las cuotas puntualmente. {detalle.mes_recuperacion?`Recuperarías ese desembolso en el mes ${detalle.mes_recuperacion}.`:'El cobro de las cuotas no recupera el costo inicial.'} No incluye comisiones, impuestos, inflación, mora ni costo real de financiación.</div>
        </div>}
      </div>
      {preview&&<div className="pricing-edit-summary">
        <div><span>Costo DAZ · transferencia</span><b>{money(preview.costo_daz)}</b></div><div><span>Administrativo 5%</span><b>{money(preview.cargo_administrativo)}</b></div><div><span>Interés 90 días</span><b>{money(preview.interes_periodo)}</b></div><div><span>Antes del redondeo</span><b>{money(preview.precio_sin_redondeo)}</b></div><div><span>Ajuste por redondeo</span><b>+{money(preview.ajuste_redondeo)}</b></div>
        <div className="pricing-highlight"><span>Precio lista</span><b>{money(preview.precio_venta)}</b></div><div><span>Transferencia (−10%)</span><b>{money(preview.precio_pago_unico)}</b></div><div><span>Ganancia / rentab. lista</span><b>{money(preview.ganancia_regular)} · {pct(preview.rentabilidad_regular_pct)}</b></div><div><span>Ganancia / rentab. transf.</span><b className={preview.ganancia_pago_unico<0?'negative':''}>{money(preview.ganancia_pago_unico)} · {pct(preview.rentabilidad_pago_unico_pct)}</b></div>
      </div>}
      {error&&<div className="notice error">{error}</div>}
      <div className="pricing-modal-actions"><button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button><button type="submit" disabled={busy||!preview} className="btn btn-primary"><Save size={16}/>{busy?'Guardando…':'Guardar producto'}</button></div>
      </form>
    </section>
  </div>;
}

export function ProductSettings({data,refresh,setToast,onEdit,onSave}) {
  const [tna,setTna]=useState(String(data.settings.tasaAnual ?? 0));
  const [rounding,setRounding]=useState(String(data.settings.redondeo ?? REDONDEO_PREDETERMINADO));
  const [shop,setShop]=useState(data.settings.tiendaNombre || 'Mi Catálogo');
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const fileRef=useRef(null);
  useEffect(()=>{setTna(String(data.settings.tasaAnual ?? 0));setRounding(String(data.settings.redondeo ?? REDONDEO_PREDETERMINADO));setShop(data.settings.tiendaNombre||'Mi Catálogo');},[data.settings]);
  let example;
  try{example=calcularPrecio(1602,Number(tna),DIAS_REFERENCIA,Number(rounding));}catch{}
  async function saveSettings(e) {
    e.preventDefault();setBusy('settings');setError('');
    try{await patch('/admin/settings',{tasaAnual:Number(tna),redondeo:Number(rounding),tiendaNombre:shop});await refresh();setToast('TNA y redondeo global guardados.');}
    catch(e){setError(e.message);}finally{setBusy('');}
  }
  async function importFile(e) {
    const file=e.target.files?.[0];if(!file)return;setBusy('import');setError('');
    try {const json=JSON.parse(await file.text());const result=await post('/admin/import',json);await refresh();setToast(`Importación: ${result.agregados} nuevos, ${result.actualizados} actualizados, ${result.costos_modificados} costos corregidos, ${result.total} en catálogo.${result.omitidos ? ` ${result.omitidos} sin precio superior: revisar; los existentes conservan su costo anterior.` : ''}`);}
    catch(err){setError(`Error al importar: ${err.message}`);}finally{setBusy('');e.target.value='';}
  }
  return <>
    <section className="admin-panel"><div className="admin-section-header"><div><h2>Reglas de precios globales</h2><p>Configurá la TNA a 90 días y el redondeo que se aplica al precio lista. Los productos con reglas personalizadas mantienen sus propios valores.</p></div></div>
      <form className="global-pricing-form" onSubmit={saveSettings}>
        <label>TNA general (%)<input type="number" min="0" max="1000" step="0.01" required value={tna} onChange={e=>setTna(e.target.value)}/></label>
        <label>Redondeo hacia arriba ($)<input type="number" min="1" max="100000" step="1" required value={rounding} onChange={e=>setRounding(e.target.value)}/></label>
        <label>Nombre de la tienda<input maxLength={70} required value={shop} onChange={e=>setShop(e.target.value)}/></label>
        <button className="btn btn-primary" disabled={busy==='settings'} type="submit"><Save size={16}/> Guardar reglas</button>
      </form>
      <div className="rounding-choices"><span>Incrementos rápidos:</span>{REDONDEOS_SUGERIDOS.map(v=><button key={v} className={Number(rounding)===v?'chosen':''} onClick={()=>setRounding(String(v))} type="button">{money(v)}</button>)}</div>
      <div className="admin-fixed-rules"><span>Administrativo <b>{ADMIN_PCT}%</b></span><span>Interés <b>{DIAS_REFERENCIA} días / 365</b></span><span>Transferencia <b>{PAGO_UNICO_DESCUENTO_PCT}% de descuento</b></span></div>
      {example&&<div className="example-pricing"><TrendingUp size={19}/><p>Ejemplo con costo DAZ de <b>$1.602</b> y TNA del <b>{pct(Number(tna))}</b>: precio antes de redondear <b>{money(example.precio_sin_redondeo)}</b> → precio lista <b>{money(example.precio_venta)}</b> → transferencia <b>{money(example.precio_pago_unico)}</b>. El descuento se aplica después del redondeo.</p></div>}
      {error&&<div className="notice error">{error}</div>}
    </section>
    <section className="admin-panel"><div className="admin-section-header"><div><h2>Actualizar catálogo DAZ</h2><p>Importá el JSON nuevo para actualizar el costo según el precio superior publicado por DAZ. «Efectivo web» no se utiliza. No borra TNA individuales, redondeos ni pedidos.</p></div><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importFile}/><button className="btn btn-outline" disabled={busy==='import'} onClick={()=>fileRef.current?.click()}><UploadCloud size={17}/>{busy==='import'?'Importando…':'Importar JSON'}</button></div></section>
    <ProductsTable products={data.products} onEdit={onEdit} onSave={onSave} title="Productos y precios · tabla editable"/>
  </>;
}

function Ranking({title,description,products,metric,onEdit}) {
  return <div className="pricing-ranking"><h3>{title}</h3><p>{description}</p><div>{products.slice(0,10).map((p,i)=><button onClick={()=>onEdit(p.sku)} key={p.sku} className="ranking-row"><span className="ranking-number">{i+1}</span><span className="ranking-name"><b>{p.nombre}</b><small>SKU {p.sku}</small></span><strong className={p[metric]<0?'negative':''}>{percentages.has(metric)?pct(p[metric]):money(p[metric])}</strong><Edit3 size={15}/></button>)}</div></div>;
}
export function ProfitAnalysis({data,onEdit,onSave}) {
  const [mode,setMode]=useState('regular');
  const active=data.products.filter(p=>p.activo);
  const suffix=mode==='regular'?'regular':'pago_unico';
  const gainKey=`ganancia_${suffix}`;
  const roiKey=`rentabilidad_${suffix}_pct`;
  const topGain=useMemo(()=>[...active].sort((a,b)=>b[gainKey]-a[gainKey]),[data.products,mode]);
  const topPct=useMemo(()=>[...active].sort((a,b)=>b[roiKey]-a[roiKey]),[data.products,mode]);
  const negatives=active.filter(p=>p.ganancia_pago_unico<0).length;
  const adjusted=active.filter(p=>p.tasa_personalizada).length;
  return <>
    <section className="admin-panel"><div className="admin-section-header"><div><h2>Análisis de rentabilidad por artículo</h2><p>Simulación de una unidad por producto. No son ventas registradas: la ganancia real de un pedido está en la sección Pedidos.</p></div></div>
      <div className="pricing-mode-selector"><button className={mode==='regular'?'active':''} onClick={()=>setMode('regular')}>Precio lista</button><button className={mode==='pago_unico'?'active':''} onClick={()=>setMode('pago_unico')}>Transferencia (−10%)</button></div>
      <div className="pricing-stats"><div><small>Productos visibles</small><strong>{active.length}</strong></div><div><small>TNA individuales</small><strong>{adjusted}</strong></div><div><small>Transferencia con pérdida</small><strong className={negatives?'negative':''}>{negatives}</strong></div></div>
      <div className="pricing-ranking-grid"><Ranking title="Mayor ganancia en pesos" description="Diferencia entre el precio de venta y el costo DAZ por unidad" products={topGain} metric={gainKey} onEdit={onEdit}/><Ranking title="Mayor rentabilidad porcentual" description="Ganancia por unidad dividida por costo DAZ" products={topPct} metric={roiKey} onEdit={onEdit}/></div>
    </section>
    <ProductsTable products={data.products} onEdit={onEdit} onSave={onSave} title="Explorar y ordenar rentabilidad" initialSort={mode==='regular'?'rentabilidad_regular_pct':'rentabilidad_pago_unico_pct'} key={mode}/>
  </>;
}
