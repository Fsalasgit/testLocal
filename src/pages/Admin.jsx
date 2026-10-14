import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LockKeyhole, ShoppingBag, ArrowLeft, LayoutDashboard, Package, Settings2, LogOut, ExternalLink, Phone, UserRound, Clock3, CheckCircle2, UploadCloud, Search, TrendingUp, Copy, X, RotateCcw, SlidersHorizontal, Save, ChevronDown, ClipboardList, Menu, XCircle, Download, AlertCircle, Boxes, CalendarClock, RefreshCw } from 'lucide-react';
import { api, post, patch, money, when, searchLink, statusName } from '../lib';

const statusClass={pendiente:'status-pending',en_preparacion:'status-working',comprado:'status-purchased',entregado:'status-delivered',cancelado:'status-cancelled'};

function Login({onSuccess}) {
  const [username,setUsername]=useState('admin');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false); const [err,setErr]=useState('');
  async function onSubmit(e) {e.preventDefault(); setBusy(true);setErr('');try {await post('/admin/login',{username,password});onSuccess();}catch(e){setErr(e.message);}finally{setBusy(false);}}
  return <main className="login-page"><div className="login-panel"><Link to="/" className="back-store"><ArrowLeft size={16}/> Volver a la tienda</Link><div className="login-icon"><LockKeyhole size={30}/></div><div className="section-kicker">ACCESO PRIVADO</div><h1>Panel de administración</h1><p>Ingresá tus credenciales para gestionar pedidos, productos y precios.</p><form onSubmit={onSubmit}><label>Usuario<input autoFocus autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required/></label><label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Ingresá tu contraseña"/></label>{err&&<div className="notice error">{err}</div>}<button disabled={busy} className="btn btn-primary btn-full" type="submit">{busy?'Validando…':'Ingresar al panel'} <ArrowLeft className="flip-icon" size={17}/></button></form><small>Acceso exclusivo para personal autorizado.</small></div></main>;
}
function Summary({orders,products}) {
  const pending=orders.filter(o=>o.estado==='pendiente').length;
  const working=orders.filter(o=>o.estado==='en_preparacion').length;
  const completed=orders.filter(o=>o.estado==='entregado').length;
  const total=orders.filter(o=>o.estado!=='cancelado').reduce((x,o)=>x+o.total,0);
  const cards=[['Pedidos recibidos',orders.length,ClipboardList,'violet'],['Por atender',pending,Clock3,'orange'],['En preparación',working,Boxes,'blue'],['Entregados',completed,CheckCircle2,'green']];
  return <><div className="stats-grid">{cards.map(([label,num,Icon,color])=><div className="stat-card" key={label}><div className={`stat-icon ${color}`}><Icon size={22}/></div><div className="stat-value">{num}</div><div className="stat-label">{label}</div></div>)}</div><div className="stat-note"><TrendingUp size={18}/> {products.length} productos cargados <span>·</span> {money(total)} en pedidos no cancelados (no equivale a ventas cobradas)</div></>;
}
function OrderCard({order,onUpdate,updating}) {
  const [expanded,setExpanded]=useState(false);
  const digits=order.telefono.replace(/\D/g,'');
  const [copied,setCopied]=useState(false);
  async function copy(t) {try {await navigator.clipboard.writeText(t);setCopied(true);setTimeout(()=>setCopied(false),1200);}catch{}}
  return <article className={'admin-order '+(expanded?'open':'')}><button className="order-summary" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}>
    <div className="order-id-area"><span className="order-icon"><ShoppingBag size={20}/></span><div><strong>{order.id}</strong><small><Clock3 size={13}/> {when(order.creado_en)}</small></div></div>
    <div className="order-client"><b>{order.nombre||'Cliente sin nombre'}</b><small><Phone size={13}/>{order.telefono}</small></div>
    <div className="order-total"><b>{money(order.total)}</b><small>{order.items.reduce((x,i)=>x+i.cantidad,0)} unidades</small></div>
    <span className={`status-chip ${statusClass[order.estado]||''}`}>{statusName[order.estado]||order.estado}</span><ChevronDown className="order-chevron" size={18}/>
  </button>{expanded&&<div className="order-detail"><div className="order-top-actions"><span>DETALLE DEL PEDIDO</span><div><a href={`tel:${digits}`} className="tiny-action"><Phone size={14}/> Llamar</a><button className="tiny-action" onClick={()=>copy(order.telefono)}><Copy size={14}/>{copied?'Copiado':'Copiar teléfono'}</button></div></div>
    <div className="order-items">{order.items.map(i=><div className="order-item" key={i.sku}><div><b>{i.nombre}</b><small>SKU: {i.sku} · Cantidad: <strong>{i.cantidad}</strong></small></div><div className="order-item-right"><b>{money(i.subtotal)}</b><small>{money(i.precio_unitario)} c/u</small><a href={searchLink(i)} target="_blank" rel="noreferrer" className="supplier-link"><ExternalLink size={14}/>{i.url_origen?'Abrir producto DAZ':'Buscar en DAZ'}</a></div></div>)}</div>
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
function ProductEditor({p,globalFactor,override,onSave,busy}) {
  const [factor,setFactor]=useState(override==null?'':String(override));
  const [error,setError]=useState('');
  const [editing,setEditing]=useState(false);
  useEffect(()=>setFactor(override==null?'':String(override)),[override]);
  const effective=factor.trim()===''?globalFactor:Number(factor);
  const preview=Number.isFinite(effective)&&effective>=1&&effective<=10?Math.round(p.precio_lista*effective):null;
  async function save(e) {e.preventDefault();setError('');try {const value=factor.trim()===''?null:Number(factor);if(value!==null&&(!Number.isFinite(value)||value<1||value>10))throw Error('Entre 1 y 10');await onSave(p.sku,{factor:value});setEditing(false);}catch(e){setError(e.message);}}
  return <div className="product-admin-line"><div className="admin-product-title"><div className="admin-product-icon"><Package size={21}/></div><div><b>{p.nombre}</b><small>{p.sku} · {p.categorias[0]||'Sin categoría'}</small></div></div><div className="admin-base"><small>Precio lista DAZ</small><b>{money(p.precio_lista)}</b></div><div className="admin-factor"><small>Multiplicador</small>{editing?<form onSubmit={save} className="inline-factor"><input autoFocus inputMode="decimal" type="number" min="1" max="10" step="0.01" value={factor} placeholder={String(globalFactor)} onChange={e=>setFactor(e.target.value)}/><button title="Guardar" disabled={busy}><Save size={17}/></button><button type="button" title="Cancelar" onClick={()=>{setEditing(false);setFactor(override==null?'':String(override))}}><X size={17}/></button></form>:<button className="factor-chip" onClick={()=>setEditing(true)}>{override==null?`${globalFactor}x · global`:`${override}x · personalizado`} <SlidersHorizontal size={13}/></button>}{error&&<small className="error-label">{error}</small>}</div><div className="admin-final"><small>Precio cliente</small><b>{money(preview??p.precio_venta)}</b></div><button title={p.activo?'Ocultar de la tienda':'Activar en la tienda'} className={'product-visibility '+(p.activo?'visible':'hidden')} onClick={()=>onSave(p.sku,{activo:!p.activo})} disabled={busy}>{p.activo?'Visible':'Oculto'}</button></div>;
}
function ProductSettings({data,refresh,setToast}) {
  const [query,setQuery]=useState('');const [factor,setFactor]=useState(String(data.settings.globalFactor));const [shop,setShop]=useState(data.settings.tiendaNombre);
  const [busy,setBusy]=useState('');const [error,setError]=useState('');const fileRef=useRef(null);
  useEffect(()=>{setFactor(String(data.settings.globalFactor));setShop(data.settings.tiendaNombre)},[data.settings]);
  const list=useMemo(()=>data.products.filter(p=>`${p.nombre} ${p.sku} ${p.categorias.join(' ')}`.toLowerCase().includes(query.toLowerCase())),[data.products,query]);
  const [limit,setLimit]=useState(30);
  useEffect(()=>setLimit(30),[query]);
  async function settingsSubmit(e){e.preventDefault();setBusy('settings');setError('');try {await patch('/admin/settings',{globalFactor:Number(factor),tiendaNombre:shop});await refresh();setToast('Configuración guardada');}catch(e){setError(e.message)}finally{setBusy('')}}
  async function saveProduct(sku,payload) {setBusy(sku);try{await patch(`/admin/products/${encodeURIComponent(sku)}`,payload);await refresh();}catch(e){setToast(e.message);throw e;}finally{setBusy('')}}
  async function importFile(event) {
    const file=event.target.files?.[0];if(!file)return;
    setBusy('import');setError('');
    try{const json=JSON.parse(await file.text());const result=await post('/admin/import',json);await refresh();setToast(`Importación lista: ${result.agregados} nuevos, ${result.actualizados} actualizados, ${result.total} en catálogo.`);}catch(e){setError(`Error de importación: ${e.message}`)}finally{setBusy('');event.target.value='';}
  }
  return <><section className="admin-panel"><div className="admin-section-header"><div><h2>Configuración de precios</h2><p>El precio que ve el cliente se calcula automáticamente sobre el precio de lista de DAZ.</p></div></div>
    <form onSubmit={settingsSubmit} className="settings-grid"><label>Multiplicador global <span>Ej.: 1,30 significa 30% adicional</span><div className="input-prefix"><span>×</span><input required type="number" inputMode="decimal" min="1" max="10" step="0.01" value={factor} onChange={e=>setFactor(e.target.value)}/></div></label><label>Nombre de tu tienda <span>Se muestra en el catálogo público</span><input maxLength={70} value={shop} onChange={e=>setShop(e.target.value)} required/></label><div className="settings-actions"><button disabled={busy==='settings'} type="submit" className="btn btn-primary"><Save size={16}/> Guardar cambios</button></div></form>
    <div className="example-pricing"><TrendingUp size={20}/><p>Ejemplo: un producto de <b>$10.000</b> con factor <b>1,30</b> se publica a <b>$13.000</b>. El margen sobre costo sería 23,08% (recargo sobre costo: 30%).</p></div>
  </section>
  <section className="admin-panel"><div className="admin-section-header"><div><h2>Importar productos</h2><p>Actualizá el catálogo con el JSON exportado desde DAZ. Conservamos las rentabilidades personalizadas por SKU.</p></div><input accept="application/json,.json" type="file" hidden ref={fileRef} onChange={importFile}/><button className="btn btn-outline" onClick={()=>fileRef.current?.click()} disabled={busy==='import'}><UploadCloud size={18}/>{busy==='import'?'Importando...':'Cargar archivo JSON'}</button></div><p className="import-note">Admite <code>{'{"productos":[...]}'}</code> o una lista JSON. Actualiza SKUs existentes y agrega nuevos; no borra productos anteriores automáticamente.</p>{error&&<div className="notice error">{error}</div>}</section>
  <section className="admin-panel"><div className="admin-section-header"><div><h2>Rentabilidad por producto</h2><p>Opcionalmente aplicá un multiplicador diferente a cada artículo.</p></div><span className="small-count">{data.products.length} productos</span></div><label className="admin-search wide"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Filtrar por nombre, SKU o categoría"/></label>
    <div className="admin-products"><div className="products-header"><span>Producto</span><span>Precio lista</span><span>Multiplicador</span><span>Precio cliente</span><span>En tienda</span></div>{list.slice(0,limit).map(p=><ProductEditor key={p.sku} p={p} globalFactor={data.settings.globalFactor} override={data.overrides[p.sku]} onSave={saveProduct} busy={busy===p.sku}/>)}</div>
    {list.length===0&&<div className="admin-empty">No encontramos productos.</div>}{limit<list.length&&<button className="btn btn-outline more-admin" onClick={()=>setLimit(limit+50)}>Mostrar más ({list.length-limit} restantes)</button>}
  </section></>;
}

export default function Admin() {
  const [authed,setAuthed]=useState(null);const [data,setData]=useState(null);const [active,setActive]=useState('orders');const [busyOrder,setBusyOrder]=useState('');const [toast,setToast]=useState('');const [error,setError]=useState('');
  async function refresh() {const d=await api('/admin/overview');setData(d);return d;}
  useEffect(()=> {api('/admin/me').then(r=>{setAuthed(r.authenticated);if(r.authenticated)refresh().catch(e=>setError(e.message))}).catch(()=>setAuthed(false));},[]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(timer);},[toast]);
  async function onLoggedIn(){setAuthed(true);try{await refresh();}catch(e){setError(e.message)}}
  async function logout(){try{await post('/admin/logout',{});}catch{}setAuthed(false);setData(null)}
  async function updateOrder(id,estado){setBusyOrder(id);try{await patch(`/admin/orders/${encodeURIComponent(id)}`,{estado});await refresh();setToast('Estado del pedido actualizado')}catch(e){setToast(e.message)}finally{setBusyOrder('')}}
  if (authed===null) return <div className="loading-state fill-screen">Verificando acceso...</div>;
  if(!authed) return <Login onSuccess={onLoggedIn}/>;
  return <div className="admin-layout"><aside className="admin-sidebar"><div className="sidebar-brand"><span className="brand-mark"><ShoppingBag size={22}/></span><span>Mi Catálogo<small>PANEL INTERNO</small></span></div><div className="sidebar-group-label">MENÚ PRINCIPAL</div><nav className="admin-nav"><button className={active==='orders'?'active':''} onClick={()=>setActive('orders')}><ClipboardList size={19}/> Pedidos {data&&<span className="nav-notification">{data.orders.filter(o=>o.estado==='pendiente').length}</span>}</button><button className={active==='products'?'active':''} onClick={()=>setActive('products')}><Package size={19}/> Productos y precios</button></nav><div className="sidebar-bottom"><Link to="/" target="_blank"><ExternalLink size={18}/> Ver tienda</Link><button onClick={logout}><LogOut size={18}/> Cerrar sesión</button></div></aside>
    <div className="admin-main"><header className="admin-topbar"><div className="admin-mobile-brand"><ShoppingBag size={18}/> Panel</div><span className="breadcrumb">Administración <span>/</span> {active==='orders'?'Pedidos':'Productos y precios'}</span><div className="admin-profile"><span className="online-dot"/> admin <span className="profile-avatar"><UserRound size={18}/></span></div></header>
      <div className="admin-mobile-tabs"><button className={active==='orders'?'active':''} onClick={()=>setActive('orders')}><ClipboardList size={16}/> Pedidos</button><button className={active==='products'?'active':''} onClick={()=>setActive('products')}><Package size={16}/> Productos y precios</button><button onClick={logout} aria-label="Cerrar sesión"><LogOut size={17}/></button></div>
      <div className="admin-content"><div className="page-heading"><div><div className="section-kicker">GESTIÓN COMERCIAL</div><h1>{active==='orders'?'Panel de pedidos':'Catálogo y rentabilidad'}</h1><p>{active==='orders'?'Controlá las solicitudes de tus clientes y las compras en DAZ.':'Definí cómo se calculan los precios que ven tus clientes.'}</p></div><button onClick={()=>refresh().then(()=>setToast('Datos actualizados')).catch(e=>setToast(e.message))} className="btn btn-outline refresh-btn"><RefreshCw size={17}/> Actualizar</button></div>
      {error&&<div className="notice error">{error}</div>}
      {!data?<div className="loading-state">Cargando información...</div>:active==='orders'?<><Summary orders={data.orders} products={data.products}/><Orders orders={data.orders} onUpdate={updateOrder} updating={busyOrder}/></>:<ProductSettings data={data} refresh={refresh} setToast={setToast}/>}</div></div>
    {toast&&<div className="toast"><CheckCircle2 size={19}/>{toast}<button onClick={()=>setToast('')} aria-label="Cerrar notificación"><X size={16}/></button></div>}
  </div>;
}
