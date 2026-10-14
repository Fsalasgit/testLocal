import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Search, SlidersHorizontal, PackageCheck, ArrowRight, Plus, Minus, X, ChevronDown, ShieldCheck, MessageCircle, ArrowUpRight, Box, CheckCircle2, Tag, Layers3, ShoppingCart, Menu, Truck, Store, ClipboardList } from 'lucide-react';
import { api, money } from '../lib';

const CART_KEY='mi_catalogo_carrito_v1';
function initialCart() { try { const x=JSON.parse(localStorage.getItem(CART_KEY)||'{}'); return x && typeof x==='object' && !Array.isArray(x) ? x : {}; } catch { return {}; } }
function Cover({ product, className = '' }) {
  const original = product?.imagenes?.[0] || '';
  const proxy = product?.imagen_url || '';
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [proxy, original]);
  const src = attempt === 0 ? (proxy || original) : attempt === 1 && proxy && original ? original : null;
  return <div className={'product-cover '+className}>
    {src ? <img src={src} alt={product.nombre} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setAttempt(n => n + 1)} /> : <div className="product-placeholder"><ShoppingBag size={42} strokeWidth={1.3}/><span>IMAGEN NO DISPONIBLE</span></div>}
  </div>;
}

export default function Catalog() {
  const [catalog,setCatalog]=useState({products:[],categories:[],tiendaNombre:'Mi Catálogo'});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('Todos');
  const [sort,setSort]=useState('featured');
  const [cart,setCart]=useState(initialCart);
  const [drawer,setDrawer]=useState(false);
  const [checkout,setCheckout]=useState(false);
  const [detail,setDetail]=useState(null);
  const [showAll,setShowAll]=useState(false);
  const [done,setDone]=useState(null);
  const [form,setForm]=useState({telefono:'',nombre:'',nota:'',consentimiento:false});
  const [saving,setSaving]=useState(false);
  const [formError,setFormError]=useState('');
  useEffect(()=> { api('/catalog').then(setCatalog).catch(e=>setError(e.message)).finally(()=>setLoading(false)); },[]);
  useEffect(()=> { localStorage.setItem(CART_KEY,JSON.stringify(cart)); },[cart]);
  const productMap=useMemo(()=>new Map(catalog.products.map(p=>[p.sku,p])),[catalog.products]);
  const cartItems=useMemo(()=>Object.entries(cart).map(([sku,cantidad])=>({p:productMap.get(sku),cantidad})).filter(i=>i.p && i.cantidad>0),[cart,productMap]);
  const count=cartItems.reduce((n,i)=>n+i.cantidad,0);
  const total=cartItems.reduce((n,i)=>n+i.cantidad*i.p.precio_venta,0);
  const filtered=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase('es-AR');
    const list=catalog.products.filter(p=>(category==='Todos'||p.categorias.includes(category)) && (!q||`${p.nombre} ${p.sku} ${p.marca||''} ${p.categorias.join(' ')}`.toLocaleLowerCase('es-AR').includes(q)));
    if(sort==='priceUp') list.sort((a,b)=>a.precio_venta-b.precio_venta);
    if(sort==='priceDown') list.sort((a,b)=>b.precio_venta-a.precio_venta);
    if(sort==='name') list.sort((a,b)=>a.nombre.localeCompare(b.nombre));
    return list;
  },[catalog,query,category,sort]);
  const shown=showAll ? filtered : filtered.slice(0,24);
  function quantity(sku, diff) { setCart(prev=>{ const next={...prev}; const n=Math.min(99,Math.max(0,(Number(next[sku])||0)+diff)); if(n) next[sku]=n; else delete next[sku]; return next; }); }
  function add(sku) {quantity(sku,1);}
  function clearFilters() {setCategory('Todos');setQuery('');setSort('featured');setShowAll(false);}
  async function submitOrder(e) {
    e.preventDefault();
    setFormError('');
    const numero = form.telefono.trim();
    if (!/^[\d\s()+-]{8,25}$/.test(numero) || numero.replace(/\D/g, '').length < 8 || numero.replace(/\D/g, '').length > 15) {
      setFormError('Ingresá un teléfono válido, por ejemplo 381 555 1234.');
      return;
    }
    if (!form.consentimiento) {
      setFormError('Autorizá que te contactemos para gestionar el pedido.');
      return;
    }
    setSaving(true);
    try {
      const response=await api('/orders',{method:'POST',body:JSON.stringify({...form,items:cartItems.map(i=>({sku:i.p.sku,cantidad:i.cantidad}))})});
      setDone(response);setCheckout(false);setDrawer(false);setCart({});setForm({telefono:'',nombre:'',nota:'',consentimiento:false});
    } catch(e) {setFormError(e.message);} finally {setSaving(false);}
  }
  return <div className="storefront">
    <div className="mini-banner"> <span className="banner-dot" /> PEDIDOS ONLINE · ATENCIÓN PERSONALIZADA <span className="banner-optional">— Elegí tus productos y enviá tu solicitud en minutos</span> </div>
    <header className="site-header"><div className="container header-inner">
      <Link className="brand" to="/"><span className="brand-mark"><ShoppingBag size={22} /></span><span>{catalog.tiendaNombre}<small>TIENDA ONLINE</small></span></Link>
      <div className="header-center"><span><ShieldCheck size={16} /> Pedidos simples y seguros</span><span><PackageCheck size={16}/> Gran variedad de productos</span></div>
      <div className="header-actions"><Link to="/admin" className="header-admin">Acceso interno</Link><button className="cart-trigger" onClick={()=>setDrawer(true)} aria-label={`Abrir carrito, ${count} productos`}><ShoppingCart size={20}/><span>Mi pedido</span>{count>0&&<b>{count}</b>}</button></div>
    </div></header>
    <main>
      <section className="hero"><div className="container hero-grid"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/> TU TIENDA, TODO EN UN LUGAR</div>
        <h1>Lo que buscás,<br/><em>a un clic.</em></h1>
        <p>Explorá nuestro catálogo, elegí tus favoritos y armá tu pedido. Nosotros nos encargamos del resto.</p>
        <button className="btn btn-white hero-cta" onClick={()=>document.getElementById('catalogo')?.scrollIntoView({behavior:'smooth'})}>Explorar productos <ArrowRight size={18}/></button>
        <div className="hero-trust"><span><CheckCircle2 size={16}/> Precios publicados</span><span><CheckCircle2 size={16}/> Compra asistida</span></div>
      </div><div className="hero-visual" aria-hidden="true"><div className="visual-sun"/><div className="visual-tile tile-one"><ShoppingBag size={51} strokeWidth={1.1}/><span>ENCONTRÁ</span></div><div className="visual-tile tile-two"><Box size={55} strokeWidth={1.1}/><span>ELEGÍ</span></div><div className="visual-tile tile-three"><Truck size={43} strokeWidth={1.2}/><span>PEDÍ</span></div><div className="floating-pill">+ {catalog.products.length} PRODUCTOS</div></div>
      </div></section>
      <section className="features"><div className="container feature-inner"><div><Search size={23}/><p><b>01. Elegí</b><span>Buscá entre nuestros productos</span></p></div><div><ShoppingBag size={23}/><p><b>02. Armá tu pedido</b><span>Agregá lo que necesites al carrito</span></p></div><div><MessageCircle size={23}/><p><b>03. Te contactamos</b><span>Dejanos tu número y coordinamos</span></p></div></div></section>
      <section className="catalog-section" id="catalogo"><div className="container">
        <div className="section-heading"><div><span className="section-kicker">EXPLORÁ EL CATÁLOGO</span><h2>Encontrá tu próximo favorito<span className="heading-dot">.</span></h2><p>Productos para cada momento, todo en un solo lugar.</p></div><div className="catalog-count"><Layers3 size={17}/> {catalog.products.length} productos</div></div>
        <div className="toolbar"><label className="search-field"><Search size={19}/><input value={query} onChange={e=>{setQuery(e.target.value);setShowAll(false);}} placeholder="Buscar productos, marcas o códigos..." aria-label="Buscar productos"/>{query&&<button onClick={()=>setQuery('')} aria-label="Borrar búsqueda"><X size={16}/></button>}</label>
          <label className="sort-field"><SlidersHorizontal size={18}/><select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Ordenar productos"><option value="featured">Destacados</option><option value="priceUp">Menor precio</option><option value="priceDown">Mayor precio</option><option value="name">Nombre A–Z</option></select><ChevronDown size={14}/></label></div>
        <div className="category-scroll"><button className={`category-pill ${category==='Todos'?'active':''}`} onClick={()=>{setCategory('Todos');setShowAll(false);}}>Todos los productos</button>{catalog.categories.map(c=><button key={c} className={`category-pill ${category===c?'active':''}`} onClick={()=>{setCategory(c);setShowAll(false);}}>{c}</button>)}</div>
        <div className="catalog-subheading"><p>Mostrando <b>{shown.length}</b> de <b>{filtered.length}</b> resultados</p>{(query||category!=='Todos')&&<button className="clear-filters" onClick={clearFilters}>Limpiar filtros <X size={15}/></button>}</div>
        {loading && <div className="loading-state">Cargando productos...</div>}
        {error && <div className="notice error">{error}<button onClick={()=>window.location.reload()}>Reintentar</button></div>}
        {!loading&&!error&&filtered.length===0&&<div className="empty-result"><Search size={36}/><h3>No encontramos resultados</h3><p>Probá con otra palabra o categoría.</p><button className="btn btn-primary" onClick={clearFilters}>Ver todos los productos</button></div>}
        <div className="products-grid">{shown.map(p=><article className="product-card" key={p.sku}><button className="cover-button" onClick={()=>setDetail(p)} aria-label={`Ver detalles de ${p.nombre}`}><Cover product={p}/></button><div className="product-body"><div className="product-cat">{p.categorias[0]||'Producto'}</div><button className="product-name" title={p.nombre} onClick={()=>setDetail(p)}>{p.nombre}</button><div className="product-sku">Código: {p.sku}</div><div className="product-bottom"><div className="price-block"><span>Precio final</span><strong>{money(p.precio_venta)}</strong></div><button className="add-btn" title="Agregar al pedido" aria-label={`Agregar ${p.nombre}`} onClick={()=>add(p.sku)}><Plus size={20}/></button></div>{cart[p.sku]>0&&<div className="in-cart"><CheckCircle2 size={14}/> {cart[p.sku]} en tu pedido</div>}</div></article>)}</div>
        {!showAll&&filtered.length>24&&<div className="load-more"><button className="btn btn-outline" onClick={()=>setShowAll(true)}>Ver los {filtered.length-24} productos restantes <ArrowRight size={17}/></button></div>}
      </div></section>
      <section className="bottom-cta"><div className="container bottom-cta-inner"><div><div className="section-kicker">¿LISTO PARA PEDIR?</div><h2>Tu próximo pedido empieza acá.</h2><p>Elegí productos, completá tu teléfono y nuestro equipo se comunica con vos.</p></div><button className="btn btn-white" onClick={()=>setDrawer(true)}>Ver mi pedido <ShoppingCart size={18}/>{count>0&&<span>({count})</span>}</button></div></section>
    </main>
    <footer className="site-footer"><div className="container footer-inner"><div className="footer-logo"><ShoppingBag size={19}/><b>{catalog.tiendaNombre}</b></div><span>Catálogo sujeto a disponibilidad y confirmación.</span><span>© {new Date().getFullYear()} Todos los derechos reservados.</span></div></footer>
    {count>0&&!drawer&&!checkout&&<button className="mobile-cart-pill" onClick={()=>setDrawer(true)}><ShoppingCart size={19}/> Ver mi pedido <span>{money(total)} · {count}</span></button>}
    {drawer&&<div className="modal-scrim" onMouseDown={()=>setDrawer(false)}><aside className="cart-drawer" onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Mi pedido"><div className="drawer-head"><div><span className="section-kicker">TU SELECCIÓN</span><h2>Mi pedido <span className="count-bubble">{count}</span></h2></div><button className="icon-button" onClick={()=>setDrawer(false)} aria-label="Cerrar carrito"><X size={21}/></button></div>
      <div className="drawer-body">{!cartItems.length?<div className="empty-cart"><ShoppingBag size={48}/><h3>Tu pedido está vacío</h3><p>Explorá el catálogo y agregá los productos que más te gusten.</p><button className="btn btn-outline" onClick={()=>setDrawer(false)}>Seguir explorando</button></div>:cartItems.map(({p,cantidad})=><div className="cart-line" key={p.sku}><Cover product={p}/><div><h4>{p.nombre}</h4><small>{p.sku}</small><b>{money(p.precio_venta*cantidad)}</b><div className="stepper"><button onClick={()=>quantity(p.sku,-1)} aria-label="Quitar una unidad"><Minus size={14}/></button><span>{cantidad}</span><button onClick={()=>quantity(p.sku,1)} aria-label="Agregar una unidad"><Plus size={14}/></button></div></div><button className="remove-line" onClick={()=>quantity(p.sku,-cantidad)} aria-label="Quitar producto"><X size={16}/></button></div>)}</div>
      {cartItems.length>0&&<div className="drawer-footer"><div className="drawer-total"><span>Total estimado</span><strong>{money(total)}</strong></div><small>Importe sujeto a confirmación del pedido y disponibilidad.</small><button className="btn btn-primary btn-full" onClick={()=>{setDrawer(false);setCheckout(true);}}>Continuar pedido <ArrowRight size={18}/></button></div>}
    </aside></div>}
    {detail&&<div className="modal-scrim modal-center" onMouseDown={()=>setDetail(null)}><div className="product-dialog" onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Detalle del producto"><button className="modal-close" onClick={()=>setDetail(null)} aria-label="Cerrar"><X size={22}/></button><Cover product={detail}/><div className="detail-content"><div className="product-cat">{detail.categorias.join(' · ')||'Producto'}</div><h2>{detail.nombre}</h2><span className="product-sku">SKU: {detail.sku}</span>{detail.descripcion&&<p className="detail-description">{detail.descripcion}</p>}{detail.stock_estado&&<div className="stock-text"><CheckCircle2 size={16}/> {detail.stock_estado} (según fuente)</div>}<div className="detail-price"><span>Precio de venta</span><strong>{money(detail.precio_venta)}</strong></div><button className="btn btn-primary btn-full" onClick={()=>{add(detail.sku);setDetail(null);setDrawer(true);}}>Agregar a mi pedido <Plus size={18}/></button></div></div></div>}
    {checkout&&<div className="modal-scrim modal-center" onMouseDown={()=>!saving&&setCheckout(false)}><div className="checkout-modal" onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Confirmar pedido"><button className="modal-close" disabled={saving} onClick={()=>setCheckout(false)} aria-label="Cerrar"><X size={22}/></button><span className="section-kicker">ÚLTIMO PASO</span><h2>¡Casi listo!</h2><p>Dejanos tus datos y te contactaremos para coordinar tu pedido.</p><div className="checkout-total"><span>{count} producto{count!==1?'s':''} en tu pedido</span><strong>{money(total)}</strong></div><form onSubmit={submitOrder}><label>Tu nombre <span>(opcional)</span><input value={form.nombre} maxLength={100} onChange={e=>setForm({...form,nombre:e.target.value})} placeholder="¿Cómo te llamás?"/></label><label>Tu teléfono <span className="required">*</span><input autoFocus value={form.telefono} onChange={e=>setForm({...form,telefono:e.target.value})} maxLength={25} inputMode="tel" type="tel" required placeholder="Ej.: 381 555 1234"/></label><label>Comentario <span>(opcional)</span><textarea value={form.nota} onChange={e=>setForm({...form,nota:e.target.value})} maxLength={1000} rows={3} placeholder="Indicaciones adicionales..."/></label><label className="consent-row"><input type="checkbox" checked={form.consentimiento} onChange={e=>setForm({...form,consentimiento:e.target.checked})} required/><span>Autorizo que me contacten por teléfono o WhatsApp <b>únicamente para gestionar este pedido</b>.</span></label>{formError&&<div className="notice error">{formError}</div>}<button className="btn btn-primary btn-full" type="submit" disabled={saving}>{saving?'Registrando...':'Enviar pedido'} {!saving&&<ArrowRight size={18}/>}</button></form><small>Un asesor confirmará los productos, el precio final y su disponibilidad.</small></div></div>}
    {done&&<div className="modal-scrim modal-center"><div className="success-modal" role="alertdialog" aria-modal="true"><span className="success-check"><CheckCircle2 size={43}/></span><span className="section-kicker">PEDIDO RECIBIDO</span><h2>¡Gracias por tu pedido!</h2><p>Registramos tu solicitud y nos comunicaremos al número que indicaste.</p><div className="success-code">N.º de pedido <strong>{done.id}</strong></div><button className="btn btn-primary btn-full" onClick={()=>setDone(null)}>Volver a la tienda <ArrowRight size={17}/></button></div></div>}
  </div>;
}
