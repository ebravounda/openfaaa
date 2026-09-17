import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import api, { API, eur, formatApiErrorDetail } from "@/lib/api";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ShoppingCart, Plus, Minus, Trash2, Utensils, Coins, Receipt, Settings2,
  Printer, RotateCcw, Wallet, Store, Tag, CreditCard, Banknote, Check, X, LayoutGrid,
} from "lucide-react";

const money = (v) => eur(v || 0);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));

export default function Pos() {
  const [tab, setTab] = useState("vender");
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [tables, setTables] = useState([]);
  const [session, setSession] = useState(null); // summary object or null
  const [tickets, setTickets] = useState([]);

  const isHost = settings?.pos_type === "hosteleria";

  const loadCore = async () => {
    const [s, c, p] = await Promise.all([
      api.get("/pos/settings"), api.get("/pos/categories"), api.get("/pos/products"),
    ]);
    setSettings(s.data); setCategories(c.data); setProducts(p.data);
  };
  const loadSession = async () => {
    const r = await api.get("/pos/session/current");
    setSession(r.data);
  };
  const loadTables = async () => {
    const r = await api.get("/pos/tables");
    setTables(r.data);
  };
  const loadTickets = async () => {
    const r = await api.get("/pos/tickets?limit=100");
    setTickets(r.data);
  };

  useEffect(() => {
    (async () => {
      try {
        await loadCore();
        await Promise.all([loadSession(), loadTables(), loadTickets()]);
      } catch (e) {
        toast.error(formatApiErrorDetail(e.response?.data?.detail));
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) {
    return <Layout><div className="space-y-4" data-testid="pos-loading"><Skeleton className="h-10 w-64" /><Skeleton className="h-96 w-full" /></div></Layout>;
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-[28px] font-semibold text-slate-900 flex items-center gap-2" data-testid="pos-title">
            <Store className="w-6 h-6 text-[#0052FF]" strokeWidth={1.5} /> TPV
          </h1>
          <p className="text-sm text-slate-500">Punto de venta {isHost ? "· Hostelería" : "· Retail"}</p>
        </div>
        <Badge className={`rounded-full ${session ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`} data-testid="pos-session-badge">
          {session ? "Caja abierta" : "Caja cerrada"}
        </Badge>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="vender" data-testid="pos-tab-vender"><ShoppingCart className="w-4 h-4 mr-1.5" />Vender</TabsTrigger>
          {isHost && <TabsTrigger value="mesas" data-testid="pos-tab-mesas"><Utensils className="w-4 h-4 mr-1.5" />Mesas</TabsTrigger>}
          <TabsTrigger value="productos" data-testid="pos-tab-productos"><Tag className="w-4 h-4 mr-1.5" />Productos</TabsTrigger>
          <TabsTrigger value="categorias" data-testid="pos-tab-categorias"><LayoutGrid className="w-4 h-4 mr-1.5" />Categorías</TabsTrigger>
          <TabsTrigger value="caja" data-testid="pos-tab-caja"><Coins className="w-4 h-4 mr-1.5" />Caja</TabsTrigger>
          <TabsTrigger value="ventas" data-testid="pos-tab-ventas"><Receipt className="w-4 h-4 mr-1.5" />Ventas</TabsTrigger>
          <TabsTrigger value="ajustes" data-testid="pos-tab-ajustes"><Settings2 className="w-4 h-4 mr-1.5" />Ajustes</TabsTrigger>
        </TabsList>

        <div className="mt-5">
          {tab === "vender" && <SellScreen settings={settings} categories={categories} products={products} tables={tables} session={session} isHost={isHost} reloadSession={loadSession} reloadTables={loadTables} reloadTickets={loadTickets} reloadProducts={loadCore} />}
          {tab === "mesas" && isHost && <TablesTab tables={tables} reload={loadTables} />}
          {tab === "productos" && <ProductsTab products={products} categories={categories} reload={loadCore} />}
          {tab === "categorias" && <CategoriesTab categories={categories} reload={loadCore} />}
          {tab === "caja" && <CashTab session={session} reload={loadSession} />}
          {tab === "ventas" && <SalesTab tickets={tickets} settings={settings} reload={() => { loadTickets(); loadSession(); loadCore(); }} />}
          {tab === "ajustes" && <SettingsTab settings={settings} onSaved={(s) => { setSettings(s); loadTables(); }} />}
        </div>
      </Tabs>
    </Layout>
  );
}

function openReceipt(ticketId, width) {
  window.open(`${API}/pos/tickets/${ticketId}/receipt?width=${width || "80"}`, "_blank");
}

/* ---------------- Sell screen ---------------- */
function SellScreen({ settings, categories, products, tables, session, isHost, reloadSession, reloadTables, reloadTickets, reloadProducts }) {
  const [cart, setCart] = useState([]);
  const [tip, setTip] = useState(0);
  const [catFilter, setCatFilter] = useState("all");
  const [resumeId, setResumeId] = useState(null);
  const [tableId, setTableId] = useState(null);
  const [tableName, setTableName] = useState("");
  const [variantPick, setVariantPick] = useState(null); // product with variants
  const [checkout, setCheckout] = useState(false);
  const [done, setDone] = useState(null); // last ticket

  const activeProducts = products.filter((p) => p.active !== false && (catFilter === "all" || p.category_id === catFilter));
  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.unit_price * i.qty * (1 - (i.discount || 0) / 100), 0) + (Number(tip) || 0), [cart, tip]);

  const addItem = (prod, variant) => {
    const price = prod.price + (variant?.price_delta || 0);
    const key = prod.id + (variant?.id || "");
    setCart((c) => {
      const ex = c.find((i) => i.key === key);
      if (ex) return c.map((i) => (i.key === key ? { ...i, qty: i.qty + 1 } : i));
      return [...c, { key, product_id: prod.id, variant_id: variant?.id || null, name: prod.name + (variant ? ` (${variant.name})` : ""), unit_price: price, tax_rate: prod.tax_rate, qty: 1, discount: 0, notes: "" }];
    });
  };
  const onProductClick = (p) => {
    if ((p.variants || []).length > 0) setVariantPick(p);
    else addItem(p);
  };
  const setQty = (key, delta) => setCart((c) => c.map((i) => (i.key === key ? { ...i, qty: Math.max(1, i.qty + delta) } : i)));
  const removeItem = (key) => setCart((c) => c.filter((i) => i.key !== key));
  const setNote = (key, notes) => setCart((c) => c.map((i) => (i.key === key ? { ...i, notes } : i)));
  const clearCart = () => { setCart([]); setTip(0); setResumeId(null); setTableId(null); setTableName(""); };

  const resumeTable = async (t) => {
    if (!t.open_ticket_id) { setTableId(t.id); setTableName(t.name); return; }
    try {
      const { data } = await api.get(`/pos/tickets/${t.open_ticket_id}`);
      setCart((data.items || []).map((i) => ({ key: (i.product_id || "") + (i.variant_id || "") + uid(), product_id: i.product_id, variant_id: i.variant_id, name: i.name, unit_price: i.unit_price, tax_rate: i.tax_rate, qty: i.qty, discount: i.discount || 0, notes: i.notes || "" })));
      setTip(data.tip || 0); setResumeId(data.id); setTableId(t.id); setTableName(t.name);
      toast.success(`Comanda de ${t.name} cargada`);
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const payload = () => ({ items: cart.map(({ product_id, variant_id, name, unit_price, tax_rate, qty, discount, notes }) => ({ product_id, variant_id, name, unit_price, tax_rate, qty, discount, notes })), tip: Number(tip) || 0, table_id: tableId, table_name: tableName });

  const saveComanda = async () => {
    if (!cart.length) return toast.error("La comanda está vacía");
    try {
      if (resumeId) await api.put(`/pos/tickets/${resumeId}`, payload());
      else await api.post("/pos/tickets", { ...payload(), status: "open" });
      toast.success("Comanda guardada");
      clearCart(); reloadTables();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const finishSale = async ({ method, cash }) => {
    try {
      let data;
      if (resumeId) ({ data } = await api.post(`/pos/tickets/${resumeId}/pay`, { ...payload(), payment_method: method, payment_cash: cash }));
      else ({ data } = await api.post("/pos/tickets", { ...payload(), status: "paid", payment_method: method, payment_cash: cash }));
      setCheckout(false); setDone(data); clearCart();
      reloadSession(); reloadTickets(); reloadTables(); reloadProducts();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  if (!session) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center" data-testid="pos-no-session">
      <Coins className="w-10 h-10 text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
      <p className="text-slate-600 mb-1 font-medium">No hay caja abierta</p>
      <p className="text-sm text-slate-400">Abre la caja en la pestaña <b>Caja</b> para empezar a vender.</p>
    </div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Products */}
      <div className="lg:col-span-2 space-y-4">
        {isHost && (
          <div className="flex items-center gap-2 flex-wrap" data-testid="pos-tables-strip">
            {tables.map((t) => (
              <button key={t.id} onClick={() => resumeTable(t)} data-testid={`pos-table-${t.name}`}
                className={`px-3 py-2 rounded-xl text-sm border transition-colors ${tableId === t.id ? "bg-[#0052FF] text-white border-[#0052FF]" : t.open_ticket_id ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                {t.name}{t.open_ticket_id ? ` · ${money(t.open_total)}` : ""}
              </button>
            ))}
            {tables.length === 0 && <span className="text-sm text-slate-400">Crea mesas en la pestaña Mesas.</span>}
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setCatFilter("all")} className={`px-3 py-1.5 rounded-full text-sm ${catFilter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`} data-testid="pos-cat-all">Todo</button>
          {categories.map((c) => (
            <button key={c.id} onClick={() => setCatFilter(c.id)} data-testid={`pos-cat-${c.name}`}
              className={`px-3 py-1.5 rounded-full text-sm ${catFilter === c.id ? "text-white" : "text-slate-600 bg-slate-100"}`}
              style={catFilter === c.id ? { backgroundColor: c.color || "#0052FF" } : {}}>{c.name}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {activeProducts.map((p) => (
            <button key={p.id} onClick={() => onProductClick(p)} data-testid={`pos-product-${p.name}`}
              className="rounded-2xl border border-slate-200 bg-white p-3 text-left hover:border-[#0052FF] hover:shadow-sm transition-all">
              <div className="text-sm font-medium text-slate-900 line-clamp-2 min-h-[40px]">{p.name}</div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[#0052FF] font-semibold">{money(p.price)}</span>
                {p.track_stock && p.stock != null && <span className="text-[11px] text-slate-400">{p.stock} ud</span>}
              </div>
            </button>
          ))}
          {activeProducts.length === 0 && <p className="text-sm text-slate-400 col-span-full">No hay productos. Créalos en la pestaña Productos.</p>}
        </div>
      </div>

      {/* Cart */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 h-fit lg:sticky lg:top-4" data-testid="pos-cart">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2"><ShoppingCart className="w-4 h-4" />{isHost && tableName ? tableName : "Ticket"}</h3>
          {cart.length > 0 && <button onClick={clearCart} className="text-xs text-slate-400 hover:text-red-500" data-testid="pos-cart-clear">Vaciar</button>}
        </div>
        <div className="space-y-2 max-h-[46vh] overflow-y-auto">
          {cart.length === 0 && <p className="text-sm text-slate-400 py-6 text-center">Añade productos</p>}
          {cart.map((i) => (
            <div key={i.key} className="border-b border-slate-100 pb-2" data-testid={`pos-cart-item-${i.name}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-slate-800 flex-1">{i.name}</span>
                <span className="text-sm font-medium">{money(i.unit_price * i.qty)}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <button onClick={() => setQty(i.key, -1)} className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center" data-testid={`pos-qty-minus-${i.name}`}><Minus className="w-3 h-3" /></button>
                <span className="text-sm w-6 text-center">{i.qty}</span>
                <button onClick={() => setQty(i.key, 1)} className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center" data-testid={`pos-qty-plus-${i.name}`}><Plus className="w-3 h-3" /></button>
                {isHost && <input value={i.notes} onChange={(e) => setNote(i.key, e.target.value)} placeholder="Nota (ej. sin hielo)" className="flex-1 text-xs border border-slate-200 rounded px-2 py-1" data-testid={`pos-note-${i.name}`} />}
                <button onClick={() => removeItem(i.key)} className="ml-auto text-slate-300 hover:text-red-500" data-testid={`pos-remove-${i.name}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
        {settings?.tip_enabled && (
          <div className="flex items-center justify-between mt-3">
            <Label className="text-sm text-slate-500">Propina</Label>
            <div className="flex items-center gap-1">
              <Input type="number" step="0.5" min="0" value={tip} onChange={(e) => setTip(e.target.value)} className="w-24 h-8 text-right" data-testid="pos-tip-input" />
              <span className="text-sm text-slate-400">€</span>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200">
          <span className="font-semibold text-slate-900">Total</span>
          <span className="text-xl font-bold text-[#0052FF]" data-testid="pos-cart-total">{money(cartTotal)}</span>
        </div>
        <div className="mt-3 space-y-2">
          <Button className="w-full h-11 bg-[#0052FF] hover:bg-[#0043cc]" disabled={!cart.length} onClick={() => setCheckout(true)} data-testid="pos-checkout-btn">
            <CreditCard className="w-4 h-4 mr-2" /> Cobrar {money(cartTotal)}
          </Button>
          {isHost && <Button variant="outline" className="w-full" disabled={!cart.length} onClick={saveComanda} data-testid="pos-save-comanda-btn"><Utensils className="w-4 h-4 mr-2" />Guardar comanda</Button>}
        </div>
      </div>

      {variantPick && <VariantDialog product={variantPick} onPick={(v) => { addItem(variantPick, v); setVariantPick(null); }} onClose={() => setVariantPick(null)} />}
      {checkout && <CheckoutDialog total={cartTotal} onConfirm={finishSale} onClose={() => setCheckout(false)} />}
      {done && <SaleDoneDialog ticket={done} width={settings?.ticket_width} onClose={() => setDone(null)} />}
    </div>
  );
}

function VariantDialog({ product, onPick, onClose }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent data-testid="pos-variant-dialog">
        <DialogHeader><DialogTitle>{product.name} — elige variante</DialogTitle><DialogDescription className="sr-only">Ventana del TPV</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {(product.variants || []).map((v) => (
            <button key={v.id} onClick={() => onPick(v)} data-testid={`pos-variant-${v.name}`} className="rounded-xl border border-slate-200 p-3 text-left hover:border-[#0052FF]">
              <div className="text-sm font-medium">{v.name}</div>
              <div className="text-[#0052FF] text-sm">{money(product.price + (v.price_delta || 0))}</div>
              {v.stock != null && <div className="text-[11px] text-slate-400">{v.stock} ud</div>}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CheckoutDialog({ total, onConfirm, onClose }) {
  const [method, setMethod] = useState("efectivo");
  const [given, setGiven] = useState("");
  const [cashPart, setCashPart] = useState("");
  const change = method === "efectivo" && given ? Number(given) - total : null;
  const submit = () => {
    if (method === "mixto") onConfirm({ method, cash: Number(cashPart) || 0 });
    else onConfirm({ method, cash: method === "efectivo" ? total : 0 });
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent data-testid="pos-checkout-dialog">
        <DialogHeader><DialogTitle>Cobrar {money(total)}</DialogTitle><DialogDescription className="sr-only">Ventana del TPV</DialogDescription></DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          {[["efectivo", "Efectivo", Banknote], ["tarjeta", "Tarjeta", CreditCard], ["mixto", "Mixto", Coins]].map(([k, l, Icon]) => (
            <button key={k} onClick={() => setMethod(k)} data-testid={`pos-method-${k}`}
              className={`rounded-xl border p-3 flex flex-col items-center gap-1 text-sm ${method === k ? "border-[#0052FF] bg-blue-50 text-[#0052FF]" : "border-slate-200 text-slate-600"}`}>
              <Icon className="w-5 h-5" /> {l}
            </button>
          ))}
        </div>
        {method === "efectivo" && (
          <div className="mt-2">
            <Label className="text-sm">Entregado</Label>
            <Input type="number" step="0.5" value={given} onChange={(e) => setGiven(e.target.value)} placeholder={total.toFixed(2)} className="mt-1" data-testid="pos-cash-given" />
            {change != null && change >= 0 && <p className="text-sm text-emerald-600 mt-1" data-testid="pos-change">Cambio: {money(change)}</p>}
          </div>
        )}
        {method === "mixto" && (
          <div className="mt-2">
            <Label className="text-sm">Parte en efectivo</Label>
            <Input type="number" step="0.5" value={cashPart} onChange={(e) => setCashPart(e.target.value)} className="mt-1" data-testid="pos-cash-part" />
            <p className="text-xs text-slate-400 mt-1">Resto en tarjeta: {money(Math.max(0, total - (Number(cashPart) || 0)))}</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-[#0052FF] hover:bg-[#0043cc]" onClick={submit} data-testid="pos-confirm-pay"><Check className="w-4 h-4 mr-2" />Confirmar cobro</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SaleDoneDialog({ ticket, width, onClose }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent data-testid="pos-sale-done">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Check className="w-5 h-5 text-emerald-500" />Venta {ticket.number} cobrada</DialogTitle><DialogDescription className="sr-only">Ventana del TPV</DialogDescription></DialogHeader>
        <p className="text-2xl font-bold text-slate-900">{money(ticket.total)}</p>
        <p className="text-sm text-slate-500">Método: {ticket.payment_method}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="pos-new-sale">Nueva venta</Button>
          <Button className="bg-[#0052FF] hover:bg-[#0043cc]" onClick={() => openReceipt(ticket.id, width)} data-testid="pos-print-receipt"><Printer className="w-4 h-4 mr-2" />Imprimir ticket</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Tables tab ---------------- */
function TablesTab({ tables, reload }) {
  const [edit, setEdit] = useState(null);
  const save = async () => {
    try {
      if (edit.id) await api.put(`/pos/tables/${edit.id}`, edit);
      else await api.post("/pos/tables", edit);
      toast.success("Mesa guardada"); setEdit(null); reload();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const remove = async (t) => { if (!window.confirm(`¿Eliminar ${t.name}?`)) return; await api.delete(`/pos/tables/${t.id}`); reload(); };
  return (
    <div>
      <div className="flex justify-end mb-3"><Button onClick={() => setEdit({ name: "", room: "", sort: 0 })} data-testid="pos-add-table"><Plus className="w-4 h-4 mr-1" />Nueva mesa</Button></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tables.map((t) => (
          <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4" data-testid={`pos-table-card-${t.name}`}>
            <div className="font-semibold text-slate-900">{t.name}</div>
            <div className="text-xs text-slate-400">{t.room || "Sala principal"}</div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="ghost" onClick={() => setEdit(t)} data-testid={`pos-edit-table-${t.name}`}>Editar</Button>
              <Button size="sm" variant="ghost" className="text-red-500" onClick={() => remove(t)}>Eliminar</Button>
            </div>
          </div>
        ))}
      </div>
      {edit && (
        <Dialog open onOpenChange={() => setEdit(null)}>
          <DialogContent data-testid="pos-table-dialog">
            <DialogHeader><DialogTitle>{edit.id ? "Editar mesa" : "Nueva mesa"}</DialogTitle><DialogDescription className="sr-only">Ventana del TPV</DialogDescription></DialogHeader>
            <Label>Nombre</Label>
            <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} data-testid="pos-table-name" />
            <Label>Sala</Label>
            <Input value={edit.room} onChange={(e) => setEdit({ ...edit, room: e.target.value })} placeholder="Terraza, Salón..." data-testid="pos-table-room" />
            <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={save} data-testid="pos-table-save">Guardar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* ---------------- Products tab ---------------- */
function ProductsTab({ products, categories, reload }) {
  const [edit, setEdit] = useState(null);
  const blank = { name: "", category_id: null, price: 0, tax_rate: 21, sku: "", barcode: "", track_stock: false, stock: "", variants: [], active: true };
  const save = async () => {
    try {
      const body = { ...edit, price: Number(edit.price) || 0, tax_rate: Number(edit.tax_rate) };
      if (edit.id) await api.put(`/pos/products/${edit.id}`, body);
      else await api.post("/pos/products", body);
      toast.success("Producto guardado"); setEdit(null); reload();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const remove = async (p) => { if (!window.confirm(`¿Eliminar ${p.name}?`)) return; await api.delete(`/pos/products/${p.id}`); reload(); };
  const catName = (id) => categories.find((c) => c.id === id)?.name || "—";
  return (
    <div>
      <div className="flex justify-end mb-3"><Button onClick={() => setEdit({ ...blank })} data-testid="pos-add-product"><Plus className="w-4 h-4 mr-1" />Nuevo producto</Button></div>
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="p-3">Producto</th><th className="p-3">Categoría</th><th className="p-3 text-right">Precio</th><th className="p-3 text-right">IVA</th><th className="p-3 text-right">Stock</th><th className="p-3"></th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-slate-100" data-testid={`pos-product-row-${p.name}`}>
                <td className="p-3 font-medium text-slate-800">{p.name}{(p.variants || []).length > 0 && <span className="text-xs text-slate-400"> · {p.variants.length} variantes</span>}</td>
                <td className="p-3 text-slate-500">{catName(p.category_id)}</td>
                <td className="p-3 text-right">{money(p.price)}</td>
                <td className="p-3 text-right">{p.tax_rate}%</td>
                <td className="p-3 text-right">{p.track_stock ? (p.stock ?? "—") : "—"}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => setEdit({ ...blank, ...p, stock: p.stock ?? "" })} data-testid={`pos-edit-product-${p.name}`}>Editar</Button>
                  <Button size="sm" variant="ghost" className="text-red-500" onClick={() => remove(p)}>Eliminar</Button>
                </td>
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan="6" className="p-6 text-center text-slate-400">Sin productos aún.</td></tr>}
          </tbody>
        </table>
      </div>
      {edit && <ProductDialog edit={edit} setEdit={setEdit} categories={categories} onSave={save} />}
    </div>
  );
}

function ProductDialog({ edit, setEdit, categories, onSave }) {
  const addVariant = () => setEdit({ ...edit, variants: [...(edit.variants || []), { id: uid(), name: "", price_delta: 0, sku: "", barcode: "", stock: "" }] });
  const setVariant = (i, k, v) => setEdit({ ...edit, variants: edit.variants.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)) });
  const delVariant = (i) => setEdit({ ...edit, variants: edit.variants.filter((_, idx) => idx !== i) });
  return (
    <Dialog open onOpenChange={() => setEdit(null)}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" data-testid="pos-product-dialog">
        <DialogHeader><DialogTitle>{edit.id ? "Editar producto" : "Nuevo producto"}</DialogTitle><DialogDescription className="sr-only">Ventana del TPV</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Nombre</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} data-testid="pos-product-name" /></div>
          <div><Label>Precio (con IVA)</Label><Input type="number" step="0.01" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} data-testid="pos-product-price" /></div>
          <div><Label>IVA %</Label>
            <Select value={String(edit.tax_rate)} onValueChange={(v) => setEdit({ ...edit, tax_rate: Number(v) })}>
              <SelectTrigger data-testid="pos-product-tax"><SelectValue /></SelectTrigger>
              <SelectContent>{[21, 10, 4, 0].map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Categoría</Label>
            <Select value={edit.category_id || "none"} onValueChange={(v) => setEdit({ ...edit, category_id: v === "none" ? null : v })}>
              <SelectTrigger data-testid="pos-product-category"><SelectValue placeholder="Sin categoría" /></SelectTrigger>
              <SelectContent><SelectItem value="none">Sin categoría</SelectItem>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>SKU</Label><Input value={edit.sku} onChange={(e) => setEdit({ ...edit, sku: e.target.value })} data-testid="pos-product-sku" /></div>
          <div><Label>Código de barras</Label><Input value={edit.barcode} onChange={(e) => setEdit({ ...edit, barcode: e.target.value })} data-testid="pos-product-barcode" /></div>
          <div className="col-span-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
            <Label className="mb-0">Controlar stock</Label>
            <Switch checked={edit.track_stock} onCheckedChange={(v) => setEdit({ ...edit, track_stock: v })} data-testid="pos-product-track-stock" />
          </div>
          {edit.track_stock && <div className="col-span-2"><Label>Stock actual</Label><Input type="number" value={edit.stock} onChange={(e) => setEdit({ ...edit, stock: e.target.value })} data-testid="pos-product-stock" /></div>}
          <div className="col-span-2">
            <div className="flex items-center justify-between"><Label>Variantes (talla/color)</Label><Button size="sm" variant="ghost" onClick={addVariant} data-testid="pos-add-variant"><Plus className="w-4 h-4 mr-1" />Añadir</Button></div>
            {(edit.variants || []).map((v, i) => (
              <div key={v.id} className="grid grid-cols-12 gap-1 mt-2 items-center">
                <Input className="col-span-4" placeholder="Nombre" value={v.name} onChange={(e) => setVariant(i, "name", e.target.value)} data-testid={`pos-variant-name-${i}`} />
                <Input className="col-span-3" type="number" step="0.01" placeholder="+/- €" value={v.price_delta} onChange={(e) => setVariant(i, "price_delta", e.target.value)} />
                <Input className="col-span-4" type="number" placeholder="Stock" value={v.stock} onChange={(e) => setVariant(i, "stock", e.target.value)} />
                <button className="col-span-1 text-red-400" onClick={() => delVariant(i)}><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={onSave} data-testid="pos-product-save">Guardar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Categories tab ---------------- */
function CategoriesTab({ categories, reload }) {
  const [edit, setEdit] = useState(null);
  const save = async () => {
    try {
      if (edit.id) await api.put(`/pos/categories/${edit.id}`, edit);
      else await api.post("/pos/categories", edit);
      toast.success("Categoría guardada"); setEdit(null); reload();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const remove = async (c) => { if (!window.confirm(`¿Eliminar ${c.name}?`)) return; await api.delete(`/pos/categories/${c.id}`); reload(); };
  return (
    <div>
      <div className="flex justify-end mb-3"><Button onClick={() => setEdit({ name: "", color: "#0052FF", sort: 0 })} data-testid="pos-add-category"><Plus className="w-4 h-4 mr-1" />Nueva categoría</Button></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {categories.map((c) => (
          <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between" data-testid={`pos-category-card-${c.name}`}>
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full" style={{ backgroundColor: c.color }} /><span className="font-medium text-slate-800">{c.name}</span></div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setEdit(c)} data-testid={`pos-edit-category-${c.name}`}>Editar</Button>
              <Button size="sm" variant="ghost" className="text-red-500" onClick={() => remove(c)}>×</Button>
            </div>
          </div>
        ))}
        {categories.length === 0 && <p className="text-sm text-slate-400 col-span-full">Sin categorías aún.</p>}
      </div>
      {edit && (
        <Dialog open onOpenChange={() => setEdit(null)}>
          <DialogContent data-testid="pos-category-dialog">
            <DialogHeader><DialogTitle>{edit.id ? "Editar categoría" : "Nueva categoría"}</DialogTitle><DialogDescription className="sr-only">Ventana del TPV</DialogDescription></DialogHeader>
            <Label>Nombre</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} data-testid="pos-category-name" />
            <Label>Color</Label><input type="color" value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} className="h-10 w-20 rounded border" data-testid="pos-category-color" />
            <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={save} data-testid="pos-category-save">Guardar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* ---------------- Cash tab ---------------- */
function CashTab({ session, reload }) {
  const [opening, setOpening] = useState("");
  const [mv, setMv] = useState(null); // {type}
  const [mvAmount, setMvAmount] = useState("");
  const [mvReason, setMvReason] = useState("");
  const [closing, setClosing] = useState(null); // bool dialog
  const [closeCash, setCloseCash] = useState("");

  const open = async () => {
    try { await api.post("/pos/session/open", { opening_cash: Number(opening) || 0 }); toast.success("Caja abierta"); setOpening(""); reload(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const doMovement = async () => {
    try { await api.post("/pos/session/movement", { type: mv.type, amount: Number(mvAmount) || 0, reason: mvReason }); toast.success("Movimiento registrado"); setMv(null); setMvAmount(""); setMvReason(""); reload(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const doClose = async () => {
    try { const { data } = await api.post("/pos/session/close", { closing_cash: Number(closeCash) || 0 }); toast.success(`Caja cerrada · descuadre ${money(data.difference)}`); setClosing(null); setCloseCash(""); reload(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  if (!session) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 max-w-md" data-testid="pos-open-session">
        <h3 className="font-semibold text-slate-900 mb-1">Abrir caja</h3>
        <p className="text-sm text-slate-500 mb-4">Introduce el efectivo inicial del cajón.</p>
        <Label>Efectivo inicial (€)</Label>
        <Input type="number" step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} className="mt-1" data-testid="pos-opening-cash" />
        <Button className="mt-4 w-full bg-[#0052FF] hover:bg-[#0043cc]" onClick={open} data-testid="pos-open-session-btn"><Wallet className="w-4 h-4 mr-2" />Abrir caja</Button>
      </div>
    );
  }
  const s = session;
  const rows = [
    ["Efectivo inicial", s.session.opening_cash], ["Ventas totales", s.sales_total],
    ["· En efectivo", s.cash_sales], ["· En tarjeta", s.card_sales], ["Propinas", s.tips],
    ["Ingresos de caja", s.deposits], ["Retiros de caja", -s.withdrawals],
  ];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="pos-cash-summary">
        <h3 className="font-semibold text-slate-900 mb-3">Arqueo de caja</h3>
        <div className="space-y-1.5 text-sm">
          {rows.map(([l, v]) => <div key={l} className="flex justify-between"><span className="text-slate-500">{l}</span><span className="font-medium">{money(v)}</span></div>)}
          <div className="flex justify-between pt-2 mt-2 border-t border-slate-200"><span className="font-semibold">Efectivo esperado en cajón</span><span className="font-bold text-[#0052FF]" data-testid="pos-expected-cash">{money(s.expected_cash)}</span></div>
          <div className="text-xs text-slate-400 pt-1">{s.tickets_count} tickets · abierta por {s.session.opened_by}</div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => setMv({ type: "withdrawal" })} data-testid="pos-withdraw-btn"><Minus className="w-4 h-4 mr-1" />Retirar</Button>
          <Button variant="outline" size="sm" onClick={() => setMv({ type: "deposit" })} data-testid="pos-deposit-btn"><Plus className="w-4 h-4 mr-1" />Ingresar</Button>
          <Button size="sm" className="ml-auto bg-slate-900 hover:bg-slate-800" onClick={() => { setClosing(true); setCloseCash(String(s.expected_cash)); }} data-testid="pos-close-session-btn">Cerrar caja</Button>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900 mb-3">Movimientos de efectivo</h3>
        <div className="space-y-2 text-sm max-h-80 overflow-y-auto">
          {(s.movements || []).length === 0 && <p className="text-slate-400">Sin movimientos.</p>}
          {(s.movements || []).map((m) => (
            <div key={m.id} className="flex justify-between border-b border-slate-100 pb-1">
              <span className={m.type === "withdrawal" ? "text-red-500" : "text-emerald-600"}>{m.type === "withdrawal" ? "Retiro" : "Ingreso"} {m.reason ? `· ${m.reason}` : ""}</span>
              <span className="font-medium">{m.type === "withdrawal" ? "-" : "+"}{money(m.amount)}</span>
            </div>
          ))}
        </div>
      </div>

      {mv && (
        <Dialog open onOpenChange={() => setMv(null)}>
          <DialogContent data-testid="pos-movement-dialog">
            <DialogHeader><DialogTitle>{mv.type === "withdrawal" ? "Retirar efectivo" : "Ingresar efectivo"}</DialogTitle><DialogDescription className="sr-only">Ventana del TPV</DialogDescription></DialogHeader>
            <Label>Importe (€)</Label><Input type="number" step="0.01" value={mvAmount} onChange={(e) => setMvAmount(e.target.value)} data-testid="pos-movement-amount" />
            <Label>Motivo</Label><Input value={mvReason} onChange={(e) => setMvReason(e.target.value)} placeholder="Pago proveedor, cambio..." data-testid="pos-movement-reason" />
            <DialogFooter><Button variant="outline" onClick={() => setMv(null)}>Cancelar</Button><Button onClick={doMovement} data-testid="pos-movement-save">Registrar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {closing && (
        <Dialog open onOpenChange={() => setClosing(null)}>
          <DialogContent data-testid="pos-close-dialog">
            <DialogHeader><DialogTitle>Cerrar caja</DialogTitle><DialogDescription className="sr-only">Ventana del TPV</DialogDescription></DialogHeader>
            <p className="text-sm text-slate-500">Esperado en cajón: <b>{money(s.expected_cash)}</b></p>
            <Label>Efectivo contado (€)</Label><Input type="number" step="0.01" value={closeCash} onChange={(e) => setCloseCash(e.target.value)} data-testid="pos-close-cash" />
            <p className="text-sm">Descuadre: <b className={Number(closeCash) - s.expected_cash === 0 ? "text-emerald-600" : "text-amber-600"}>{money((Number(closeCash) || 0) - s.expected_cash)}</b></p>
            <DialogFooter><Button variant="outline" onClick={() => setClosing(null)}>Cancelar</Button><Button className="bg-slate-900 hover:bg-slate-800" onClick={doClose} data-testid="pos-close-confirm">Cerrar caja</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* ---------------- Sales tab ---------------- */
function SalesTab({ tickets, settings, reload }) {
  const refund = async (t) => { if (!window.confirm(`¿Devolver ticket ${t.number}?`)) return; try { await api.post(`/pos/tickets/${t.id}/refund`); toast.success("Ticket devuelto"); reload(); } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); } };
  const STATUS = { paid: ["Cobrado", "bg-emerald-100 text-emerald-700"], open: ["Comanda", "bg-amber-100 text-amber-700"], refunded: ["Devuelto", "bg-red-100 text-red-700"] };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="p-3">Ticket</th><th className="p-3">Fecha</th><th className="p-3">Estado</th><th className="p-3">Pago</th><th className="p-3 text-right">Total</th><th className="p-3"></th></tr></thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t.id} className="border-t border-slate-100" data-testid={`pos-ticket-row-${t.id}`}>
              <td className="p-3 font-medium">{t.number || "—"}{t.table_name ? ` · ${t.table_name}` : ""}</td>
              <td className="p-3 text-slate-500">{(t.created_at || "").slice(0, 16).replace("T", " ")}</td>
              <td className="p-3"><Badge className={`rounded-full ${STATUS[t.status]?.[1] || ""}`}>{STATUS[t.status]?.[0] || t.status}</Badge></td>
              <td className="p-3 text-slate-500">{t.payment_method || "—"}</td>
              <td className="p-3 text-right font-medium">{money(t.total)}</td>
              <td className="p-3 text-right whitespace-nowrap">
                {t.status !== "open" && <Button size="sm" variant="ghost" onClick={() => openReceipt(t.id, settings?.ticket_width)} data-testid={`pos-print-${t.id}`}><Printer className="w-4 h-4" /></Button>}
                {t.status === "paid" && <Button size="sm" variant="ghost" className="text-red-500" onClick={() => refund(t)} data-testid={`pos-refund-${t.id}`}><RotateCcw className="w-4 h-4" /></Button>}
              </td>
            </tr>
          ))}
          {tickets.length === 0 && <tr><td colSpan="6" className="p-6 text-center text-slate-400">Sin ventas aún.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Settings tab ---------------- */
function SettingsTab({ settings, onSaved }) {
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { const { data } = await api.put("/pos/settings", form); toast.success("Ajustes guardados"); onSaved(data); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 max-w-lg space-y-4" data-testid="pos-settings">
      <div>
        <Label>Tipo de TPV</Label>
        <Select value={form.pos_type} onValueChange={(v) => setForm({ ...form, pos_type: v })}>
          <SelectTrigger data-testid="pos-settings-type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="retail">Retail (tienda, ropa, electrónica)</SelectItem>
            <SelectItem value="hosteleria">Hostelería (bar, restaurante)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-400 mt-1">Hostelería activa mesas, comandas y notas por producto.</p>
      </div>
      <div>
        <Label>Ancho de ticket</Label>
        <Select value={form.ticket_width} onValueChange={(v) => setForm({ ...form, ticket_width: v })}>
          <SelectTrigger data-testid="pos-settings-width"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="80">80 mm</SelectItem><SelectItem value="58">58 mm</SelectItem></SelectContent>
        </Select>
      </div>
      <div><Label>Nombre en el ticket</Label><Input value={form.business_name || ""} onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder="Tu negocio" data-testid="pos-settings-bizname" /></div>
      <div><Label>Mensaje al pie del ticket</Label><Textarea value={form.footer_note || ""} onChange={(e) => setForm({ ...form, footer_note: e.target.value })} placeholder="¡Gracias por su visita!" data-testid="pos-settings-footer" /></div>
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
        <div><Label className="mb-0">Propinas</Label><p className="text-xs text-slate-400">Muestra el campo propina al cobrar</p></div>
        <Switch checked={!!form.tip_enabled} onCheckedChange={(v) => setForm({ ...form, tip_enabled: v })} data-testid="pos-settings-tip" />
      </div>
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
        <div><Label className="mb-0">Tickets a VeriFactu (AEAT)</Label><p className="text-xs text-slate-400">Enviar los tickets como facturas simplificadas (próximamente)</p></div>
        <Switch checked={!!form.verifactu_tickets} onCheckedChange={(v) => setForm({ ...form, verifactu_tickets: v })} data-testid="pos-settings-verifactu" />
      </div>
      <Button className="w-full bg-[#0052FF] hover:bg-[#0043cc]" onClick={save} disabled={saving} data-testid="pos-settings-save">{saving ? "Guardando..." : "Guardar ajustes"}</Button>
    </div>
  );
}
