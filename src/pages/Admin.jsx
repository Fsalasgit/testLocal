import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LockKeyhole, ShoppingBag, ArrowLeft, LayoutDashboard, Package, Settings2, LogOut, ExternalLink, Phone, UserRound, Clock3, CheckCircle2, UploadCloud, Search, TrendingUp, Copy, X, RotateCcw, SlidersHorizontal, Save, ChevronDown, ClipboardList, Menu, XCircle, Download, AlertCircle, Boxes, CalendarClock, RefreshCw, BarChart3 } from 'lucide-react';
import { api, post, patch, money, when, searchLink, statusName } from '../lib';
import { ProductSettings, ProfitAnalysis, ProductEditModal } from '../components/PricingAdmin';

const statusClass={pendiente:'status-pending',en_preparacion:'status-working',comprado:'status-purchased',entregado:'status-delivered',cancelado:'status-cancelled'};

function Login({onSuccess}) {
  const [username,setUsername]=useState('admin');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false); const [err,setErr]=useState('');
  async function onSubmit(e) {e.preventDefault(); setBusy(true);setErr('');try {await post('/admin/login',{username,password});onSuccess();}catch(e){setErr(e.message);}finally{setBusy(false);}}
  return <main className="login-page"><div className="login-panel"><Link to="/" className="back-store"><ArrowLeft size={16}/> Volver a la tienda</Link><div className="login-icon"><LockKeyhole size={30}/></div><div className="section-kicker">ACCESO PRIVADO</div><h1>Panel de administración</h1><p>Ingresá tus credenciales para gestionar pedidos, productos y precios.</p><form onSubmit={onSubmit}><label>Usuario<input autoFocus autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required/></label><label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Ingresá tu contraseña"/></label>{err&&<div className="notice error">{err}</div>}<button disabled={busy} className="btn btn-primary btn-full" type="submit">{busy?'Validando…':'Ingresar al panel'} <ArrowLeft className="flip-icon" size={17}/></button></form><small>Acceso exclusivo para personal autorizado.</small></div></main>;
}
function Summary({orders,products}) {
  const active = orders.filter(o => o.estado !== 'cancelado');
  const completed = orders.filter(o => o.estado === 'entregado').length;
  const total = active.reduce((x,o) => x+o.total,0);
  const calculables = active.filter(o => Number.isFinite(o.ganancia_ticket));
  const ganancia = calculables.reduce((x,o)=>x+o.ganancia_ticket,0);
  const administrativos = calculables.reduce((x,o)=>x+o.total_administrativo,0);
  const cards = [
    ['Pedidos recibidos',orders.length,ClipboardList,'violet'],
    ['Pendientes',orders.filter(o=>o.estado==='pendiente').length,Clock3,'orange'],
    ['Entregados',completed,CheckCircle2,'green'],
    ['Total solicitado',money(total),TrendingUp,'blue']
  ];
  return <><div className="stats-grid">{cards.map(([label,num,Icon,color])=><div className="stat-card" key={label}><div className={`stat-icon ${color}`}><Icon size={22}/></div><div className="stat-value admin-stat-money">{num}</div><div className="stat-label">{label}</div></div>)}</div>
    <div className="admin-finance-summary"><div><small>Cargos administrativos · pedidos activos</small><strong>{money(administrativos)}</strong></div><div><small>Ganancia bruta estimada · pedidos activos</small><strong>{money(ganancia)}</strong></div></div>
    <div className="stat-note"><TrendingUp size={18}/>{products.length} productos · {calculables.length} pedidos con desglose de costos. Los importes son estimaciones de pedidos, no pagos recibidos ni beneficio neto.</div>
  </>;
}
function OrderCard({order,onUpdate,updating}) {
  const [expanded,setExpanded]=useState(false);
  const digits=order.telefono.replace(/\D/g,'');
  const [copied,setCopied]=useState(false);
  async function copy(t) {try {await navigator.clipboard.writeText(t);setCopied(true);setTimeout(()=>setCopied(false),1200);}catch{}}
  return <article className={'admin-order '+(expanded?'open':'')}><button className="order-summary" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}>
    <div className="order-id-area"><span className="order-icon"><ShoppingBag size={20}/></span><div><strong>{order.id}</strong><small><Clock3 size={13}/> {when(order.creado_en)}</small></div></div>
    <div className="order-client"><b>{order.nombre||'Cliente sin nombre'}</b><small><Phone size={13}/>{order.telefono}</small></div>
    <div className="order-total"><b>{money(order.total)}</b><small>{order.items.reduce((x,i)=>x+i.cantidad,0)} unidades · {order.medio_pago === 'pago_unico' ? 'Pago único / transferencia' : order.medio_pago === 'regular' ? 'Precio regular' : /^cuotas_(3|6|9)$/.test(order.medio_pago) ? `${order.plan_cuotas?.meses||order.medio_pago.split('_')[1]} cuotas` : 'Pedido anterior'}</small></div>
    <span className={`status-chip ${statusClass[order.estado]||''}`}>{statusName[order.estado]||order.estado}</span><ChevronDown className="order-chevron" size={18}/>
  </button>{expanded&&<div className="order-detail"><div className="order-top-actions"><span>DETALLE DEL PEDIDO</span><div><a href={`tel:${digits}`} className="tiny-action"><Phone size={14}/> Llamar</a><button className="tiny-action" onClick={()=>copy(order.telefono)}><Copy size={14}/>{copied?'Copiado':'Copiar teléfono'}</button></div></div>
    {order.plan_cuotas&&<div className="order-installment-summary"><b>Plan de {order.plan_cuotas.meses} cuotas</b><span>Importes mensuales: {order.plan_cuotas.importes.map(money).join(' · ')}</span><small>Ganancia bruta mensual prorrateada: {money(order.plan_cuotas.ganancia_promedio_mensual)}. No indica efectivo recibido.</small></div>}
    <div className="order-items">{order.items.map(i=><div className="order-item" key={i.sku}><div><b>{i.nombre}</b><small>SKU: {i.sku} · Cantidad: <strong>{i.cantidad}</strong></small></div><div className="order-item-right"><b>{money(i.subtotal)}</b><small>{money(i.precio_unitario)} c/u</small>{Number.isFinite(i.costo_unitario)&&<small>Costo DAZ: {money(i.costo_unitario)} c/u</small>}<a href={searchLink(i)} target="_blank" rel="noreferrer" className="supplier-link"><ExternalLink size={14}/>{i.url_origen?'Abrir producto DAZ':'Buscar en DAZ'}</a></div></div>)}</div>
    {Number.isFinite(order.total_costo) ? <div className="order-profit-breakdown"><div><span>Costo de compra DAZ</span><b>{money(order.total_costo)}</b></div><div><span>Cargo administrativo (5%)</span><b>{money(order.total_administrativo)}</b></div><div><span>Interés TNA base (90 días)</span><b>{money(order.total_interes)}</b></div>{Number.isFinite(order.total_interes_adicional)&&order.total_interes_adicional>0&&<div><span>Interés adicional por cuotas</span><b>{money(order.total_interes_adicional)}</b></div>}{Number.isFinite(order.total_redondeo)&&<div><span>Ajuste por redondeo</span><b>{money(order.total_redondeo)}</b></div>}<div><span>Descuento pago único / transferencia</span><b>- {money(order.total_descuento)}</b></div><div className="profit-strong"><span>Ganancia bruta estimada del ticket</span><strong>{money(order.ganancia_ticket)}</strong></div><small>Es venta menos costo DAZ. No incluye impuestos, envíos, comisiones, costos financieros reales ni otros gastos.</small></div> : <div className="order-observation">Pedido anterior: no tenemos costo histórico guardado; no se calcula una ganancia retroactiva.</div>}
    {order.nota&&<div className="order-observation"><b>Comentario del cliente:</b> {order.nota}</div>}
    <div className="order-bottom"><div><span>Total del pedido</span><strong>{money(order.total)}</strong></div><label>Estado<select disabled={updating} value={order.estado} onChange={e=>onUpdate(order.id,e.target.value)}>{Object.entries(statusName).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div>
    <div className="supplier-help"><AlertCircle size={15}/> Abrí cada enlace, agregá los artículos al carrito de DAZ y marcá «Comprado en DAZ». La compra al proveedor es manual.</div>
  </div>}</article>;
}
function Orders({orders,onUpdate,updating}) {
  const [filter,setFilter]=useState('todos'); const [query,setQuery]=useState('');
  const list=orders.filter(o=>(filter==='todos'||o.estado===filter) && (!query||`${o.id} ${o.nombre} ${o.telefono} ${o.items.map(i=>i.nombre).join(' ')}`.toLowerCase().includes(query.toLowerCase())));
  const counts={todos:orders.length,...Object.fromEntries(Object.keys(statusName).map(s=>[s,orders.filter(o=>o.estado===s).length]))};
  return <section className="admin-panel"><div className="admin-section-header"><div><h2>Gestión de pedidos</h2><p>Revisá los pedidos y realizá la compra al proveedor.</p></div><span className="small-count">{orders.length} pedidos</span></div>
    <div className="order-filters"><div className="filter-buttons">{[['todos','Todos'],['pendiente','Pendientes'],['en_preparacion','En preparación'],['comprado','Comprados'],['entregado','Entregados'],['cancelado','Cancelados']].map(([k,label])=><button key={k} className={filter===k?'selected':''} onClick={()=>setFilter(k)}>{label} <span>{counts[k]}</span></button>)}</div><label className="admin-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar pedido, cliente o teléfono"/></label></div>
    <div className="orders-list">{list.length===0?<div className="admin-empty"><ClipboardList size={34}/><h3>No hay pedidos para mostrar</h3><p>Cuando los clientes envíen pedidos, aparecerán aquí.</p></div>:list.map(o=><OrderCard key={o.id} order={o} onUpdate={onUpdate} updating={updating===o.id}/>)}</div>
  </section>;
}
export default function Admin() {
  const [authed,setAuthed]=useState(null);const [data,setData]=useState(null);const [active,setActive]=useState('orders');const [editingSku,setEditingSku]=useState(null);const [busyOrder,setBusyOrder]=useState('');const [toast,setToast]=useState('');const [error,setError]=useState('');
  async function refresh() {const d=await api('/admin/overview');setData(d);return d;}
  useEffect(()=> {api('/admin/me').then(r=>{setAuthed(r.authenticated);if(r.authenticated)refresh().catch(e=>setError(e.message))}).catch(()=>setAuthed(false));},[]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(timer);},[toast]);
  async function onLoggedIn(){setAuthed(true);try{await refresh();}catch(e){setError(e.message)}}
  async function logout(){try{await post('/admin/logout',{});}catch{}setAuthed(false);setData(null)}
  async function updateOrder(id,estado){setBusyOrder(id);try{await patch(`/admin/orders/${encodeURIComponent(id)}`,{estado});await refresh();setToast('Estado del pedido actualizado')}catch(e){setToast(e.message)}finally{setBusyOrder('')}}
  async function saveProduct(sku,payload){await patch(`/admin/products/${encodeURIComponent(sku)}`,payload);await refresh();setToast('Producto actualizado.');}
  const editingProduct=data?.products.find(p=>p.sku===editingSku);
  if (authed===null) return <div className="loading-state fill-screen">Verificando acceso...</div>;
  if(!authed) return <Login onSuccess={onLoggedIn}/>;
  return <div className="admin-layout"><aside className="admin-sidebar"><div className="sidebar-brand"><span className="brand-mark"><ShoppingBag size={22}/></span><span>Mi Catálogo<small>PANEL INTERNO</small></span></div><div className="sidebar-group-label">MENÚ PRINCIPAL</div><nav className="admin-nav"><button className={active==='orders'?'active':''} onClick={()=>setActive('orders')}><ClipboardList size={19}/> Pedidos {data&&<span className="nav-notification">{data.orders.filter(o=>o.estado==='pendiente').length}</span>}</button><button className={active==='products'?'active':''} onClick={()=>setActive('products')}><Package size={19}/> Productos y precios</button><button className={active==='analysis'?'active':''} onClick={()=>setActive('analysis')}><BarChart3 size={19}/> Rentabilidad</button></nav><div className="sidebar-bottom"><Link to="/" target="_blank"><ExternalLink size={18}/> Ver tienda</Link><button onClick={logout}><LogOut size={18}/> Cerrar sesión</button></div></aside>
    <div className="admin-main"><header className="admin-topbar"><div className="admin-mobile-brand"><ShoppingBag size={18}/> Panel</div><span className="breadcrumb">Administración <span>/</span> {active==='orders'?'Pedidos':active==='analysis'?'Rentabilidad':'Productos y precios'}</span><div className="admin-profile"><span className="online-dot"/> admin <span className="profile-avatar"><UserRound size={18}/></span></div></header>
      <div className="admin-mobile-tabs"><button className={active==='orders'?'active':''} onClick={()=>setActive('orders')}><ClipboardList size={16}/> Pedidos</button><button className={active==='products'?'active':''} onClick={()=>setActive('products')}><Package size={16}/> Productos</button><button className={active==='analysis'?'active':''} onClick={()=>setActive('analysis')}><BarChart3 size={16}/> Rentabilidad</button><button onClick={logout} aria-label="Cerrar sesión"><LogOut size={17}/></button></div>
      <div className="admin-content"><div className="page-heading"><div><div className="section-kicker">GESTIÓN COMERCIAL</div><h1>{active==='orders'?'Panel de pedidos':active==='analysis'?'Análisis de rentabilidad':'Catálogo y precios'}</h1><p>{active==='orders'?'Controlá las solicitudes de tus clientes y las compras en DAZ.':active==='analysis'?'Compará la ganancia por artículo y editá los destacados.':'Ordená toda la tabla y ajustá las reglas de cada producto.'}</p></div><button onClick={()=>refresh().then(()=>setToast('Datos actualizados')).catch(e=>setToast(e.message))} className="btn btn-outline refresh-btn"><RefreshCw size={17}/> Actualizar</button></div>
      {error&&<div className="notice error">{error}</div>}
      {!data?<div className="loading-state">Cargando información...</div>:active==='orders'?<><Summary orders={data.orders} products={data.products}/><Orders orders={data.orders} onUpdate={updateOrder} updating={busyOrder}/></>:active==='analysis'?<ProfitAnalysis data={data} onEdit={setEditingSku} onSave={saveProduct}/>:<ProductSettings data={data} refresh={refresh} setToast={setToast} onEdit={setEditingSku} onSave={saveProduct}/>}</div></div>
    {editingProduct&&<ProductEditModal key={editingProduct.sku} p={editingProduct} globalTna={data.settings.tasaAnual} globalRounding={data.settings.redondeo} onClose={()=>setEditingSku(null)} onSave={saveProduct}/>}
    {toast&&<div className="toast"><CheckCircle2 size={19}/>{toast}<button onClick={()=>setToast('')} aria-label="Cerrar notificación"><X size={16}/></button></div>}
  </div>;
}
