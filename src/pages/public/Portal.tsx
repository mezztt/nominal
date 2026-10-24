import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { API_URL } from "../../config";
import PublicShell from "../../components/public/Shell";
import "../../g3.css";

const PORTAL_KEY = "nominal_portal_token";
const PORTAL_SLUG = "nominal_portal_slug";

function getTok(): string { try { return sessionStorage.getItem(PORTAL_KEY) || ""; } catch { return ""; } }

/** fetch del portal: usa el token del empleado (scope portal), nunca el del sistema. */
async function portalApi<T = any>(path: string, options: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method || "GET",
      headers: { ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}), ...((options.token ?? getTok()) ? { Authorization: `Bearer ${options.token ?? getTok()}` } : {}) },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch { throw new Error("No se pudo conectar. Probá de nuevo en un momento."); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && getTok()) { try { sessionStorage.removeItem(PORTAL_KEY); } catch { /* sin almacenamiento */ } }
    const d = (data as { detail?: unknown }).detail;
    throw new Error(typeof d === "string" ? d : Array.isArray(d) ? d.map((x: { msg?: string }) => x.msg).join(". ") : "No se pudo completar la acción");
  }
  return data as T;
}

interface Yo { nombre: string; legajo: string; empresa: string; secciones: { f572: boolean; vacaciones: boolean; recibos: boolean } }
interface Recibo { id: number; numero: string; periodo: string; estado: string; emitido_en: string | null; visto_en: string | null; conformidad: string; conformidad_en: string | null; reserva: string | null }
interface ReciboDet extends Recibo { html: string | null; texto_conformidad: string | null; puede_dar_conformidad: boolean }
type Tab = "recibos" | "vacaciones" | "f572" | "clave";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-AR") : "—");
const CONF: Record<string, [string, string]> = { pendiente: ["Sin conformidad", "warn"], conforme: ["Conforme", "ok"], con_reserva: ["Conforme con reserva", "warn"], firmado_papel: ["Firmado en papel", "ok"], firmado_digital: ["Firmado", "ok"] };

export default function Portal() {
  const [logged, setLogged] = useState(!!getTok());
  const [yo, setYo] = useState<Yo | null>(null);
  const [tab, setTab] = useState<Tab>("recibos");
  const [forzarClave, setForzarClave] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!logged) { setYo(null); return; }
    portalApi<Yo>("/portal/yo").then(setYo).catch((e) => { setError(e.message); setLogged(!!getTok()); });
  }, [logged]);

  function salir() { try { sessionStorage.removeItem(PORTAL_KEY); } catch { /* sin almacenamiento */ } setLogged(false); setYo(null); setError(""); }

  if (!logged || (!yo && !error)) {
    if (logged) return <PublicShell title="Portal del empleado" heading="Tus recibos de sueldo"><div className="pb-card"><p>Cargando...</p></div></PublicShell>;
    return <Ingreso onOk={(debe) => { setForzarClave(debe); if (debe) setTab("clave"); setError(""); setLogged(true); }} />;
  }
  if (!yo) return <PublicShell title="Portal del empleado" heading="Tus recibos de sueldo" error={error}><button className="pb-btn" onClick={salir}>Volver a ingresar</button></PublicShell>;

  const tabs: [Tab, string][] = [["recibos", "Recibos"], ["vacaciones", "Vacaciones y licencias"]];
  if (yo.secciones.f572) tabs.push(["f572", "Ganancias F.572"]);
  tabs.push(["clave", "Mi clave"]);
  return (
    <PublicShell title="Portal del empleado" heading={`Hola, ${yo.nombre}`} intro={`${yo.empresa} · legajo ${yo.legajo}`}>
      <div className="g3-portal-tabs" role="tablist">
        {tabs.map(([k, v]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "is-on" : ""} onClick={() => setTab(k)}>{v}</button>)}
        <button onClick={salir}>Salir</button>
      </div>
      {tab === "recibos" && <Recibos />}
      {tab === "vacaciones" && <Vacaciones />}
      {tab === "f572" && <F572 />}
      {tab === "clave" && <Clave primera={forzarClave} onDone={() => setForzarClave(false)} />}
      <p className="pb-consent" style={{ marginTop: 16 }}>Documento no válido como factura.</p>
    </PublicShell>
  );
}

function Ingreso({ onOk }: { onOk: (debeCambiarClave: boolean) => void }) {
  const [slug, setSlug] = useState(() => new URLSearchParams(window.location.search).get("e") || (() => { try { return localStorage.getItem(PORTAL_SLUG) || ""; } catch { return ""; } })());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(ev: FormEvent) {
    ev.preventDefault(); setError(""); setBusy(true);
    try {
      const r = await portalApi<{ access_token: string; debe_cambiar_clave: boolean }>("/portal/login", { method: "POST", body: { slug, email, password }, token: "" });
      try { sessionStorage.setItem(PORTAL_KEY, r.access_token); localStorage.setItem(PORTAL_SLUG, slug); } catch { /* sin almacenamiento */ }
      onOk(r.debe_cambiar_clave);
    } catch (e) { setError(e instanceof Error ? e.message : `No se pudo conectar con ${API_URL}`); } finally { setBusy(false); }
  }
  return (
    <PublicShell title="Portal del empleado" heading="Tus recibos de sueldo" intro="Ingresá para ver tus recibos y dar tu conformidad.">
      <form className="pb-card" onSubmit={submit}>
        {error && <div className="pb-error" role="alert">{error}</div>}
        <div className="pb-field"><label htmlFor="slug">Código de tu empresa</label><input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} autoCapitalize="none" required /></div>
        <div className="pb-field"><label htmlFor="pe">Email</label><input id="pe" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div className="pb-field"><label htmlFor="pp">Contraseña</label><input id="pp" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        <button className="pb-btn" type="submit" disabled={busy}>{busy ? "Ingresando..." : "Ingresar"}</button>
        <p className="pb-consent">Si no tenés acceso, pedíselo a tu empleador.</p>
      </form>
    </PublicShell>
  );
}

function Recibos() {
  const [rows, setRows] = useState<Recibo[] | null>(null);
  const [det, setDet] = useState<ReciboDet | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => { portalApi<{ recibos: Recibo[] }>("/portal/recibos").then((r) => setRows(r.recibos)).catch((e) => setError(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  async function abrir(id: number) { setError(""); try { setDet(await portalApi<ReciboDet>(`/portal/recibos/${id}`)); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo abrir"); } }
  if (det) return <ReciboVista det={det} onBack={() => { setDet(null); load(); }} onChanged={() => abrir(det.id)} />;
  return (
    <>
      {error && <div className="pb-error" role="alert">{error}</div>}
      {!rows ? <div className="pb-card"><p>Cargando...</p></div> : rows.length === 0 ? <div className="pb-card"><p>Todavía no tenés recibos. Aparecen acá cuando tu empleador los emite.</p></div> : rows.map((r) => {
        const [txt, tone] = CONF[r.conformidad] || [r.conformidad, "gray"];
        return (
          <button key={r.id} className="g3-slip" onClick={() => abrir(r.id)}>
            <strong>{r.periodo}</strong><small>Recibo {r.numero} · emitido {fmt(r.emitido_en)}</small>
            <span>{r.estado === "anulado" ? <span className="g3-badge bad">Anulado</span> : <span className={`g3-badge ${tone}`}>{txt}</span>}</span>
          </button>
        );
      })}
    </>
  );
}

function ReciboVista({ det, onBack, onChanged }: { det: ReciboDet; onBack: () => void; onChanged: () => void }) {
  const [reserva, setReserva] = useState("");
  const [conReserva, setConReserva] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  async function dar(tipo: "conforme" | "con_reserva") {
    setError("");
    try { await portalApi(`/portal/recibos/${det.id}/conformidad`, { method: "POST", body: { tipo, reserva: tipo === "con_reserva" ? reserva : null } }); setMsg("Quedó registrada tu respuesta."); onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo registrar"); }
  }
  const [txt, tone] = CONF[det.conformidad] || [det.conformidad, "gray"];
  return (
    <>
      <button className="pb-btn pb-btn-ghost" onClick={onBack} style={{ marginBottom: 12 }}>Volver a mis recibos</button>
      <div className="pb-card">
        <span className="pb-step-label">Recibo {det.numero}</span>
        <h2>{det.periodo}</h2>
        <p>{det.estado === "anulado" ? <span className="g3-badge bad">Anulado</span> : <span className={`g3-badge ${tone}`}>{txt}</span>}{det.conformidad_en ? ` el ${fmt(det.conformidad_en)}` : ""}</p>
        {det.reserva && <p>Tu reserva: {det.reserva}</p>}
        {det.html
          ? <iframe className="g3-frame" title={`Recibo ${det.numero}`} sandbox="" srcDoc={det.html} />
          : <p>No se pudo mostrar el recibo. Pedíselo a tu empleador.</p>}
      </div>
      {msg && <div className="pb-msg" role="status">{msg}</div>}
      {error && <div className="pb-error" role="alert">{error}</div>}
      {det.puede_dar_conformidad && (
        <div className="pb-card">
          <h2>Tu conformidad</h2>
          {det.texto_conformidad && <p className="pb-consent">{det.texto_conformidad}</p>}
          <p className="pb-consent">Haber visto el recibo no es lo mismo que estar conforme: solo se registra tu conformidad si la das acá. Podés darla con reserva si no estás de acuerdo con algo.</p>
          {!conReserva ? (
            <div style={{ display: "grid", gap: 10 }}>
              <button className="pb-btn" onClick={() => dar("conforme")}>Estoy conforme</button>
              <button className="pb-btn pb-btn-ghost" onClick={() => setConReserva(true)}>Conforme con reserva</button>
            </div>
          ) : (
            <>
              <div className="pb-field"><label htmlFor="rsv">Qué reservás</label><textarea id="rsv" rows={3} maxLength={500} value={reserva} onChange={(e) => setReserva(e.target.value)} /></div>
              <div style={{ display: "grid", gap: 10 }}>
                <button className="pb-btn" onClick={() => dar("con_reserva")} disabled={reserva.trim().length < 5}>Enviar con reserva</button>
                <button className="pb-btn pb-btn-ghost" onClick={() => setConReserva(false)}>Cancelar</button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

interface Vac {
  saldos: { anio: number; corresponden: number; gozados: number; pendientes: number }[];
  pedidos: { id: number; desde: string; hasta: string; estado: string; nota: string | null }[];
  licencias: { id: number; tipo: string; desde: string; hasta: string; estado: string }[];
  tipos_licencia: { id: number; nombre: string; con_goce: boolean }[]; aviso_enfermedad: string;
}

function Vacaciones() {
  const [d, setD] = useState<Vac | null>(null);
  const [tipo, setTipo] = useState("vacaciones");
  const [lt, setLt] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [nota, setNota] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(() => { portalApi<Vac>("/portal/vacaciones").then(setD).catch((e) => setError(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  async function enviar(ev: FormEvent) {
    ev.preventDefault(); setError(""); setMsg("");
    try {
      await portalApi("/portal/solicitudes", { method: "POST", body: { tipo, desde, hasta, leave_type_id: tipo === "licencia" && lt ? Number(lt) : null, nota: nota.trim() || null } });
      setMsg("Enviamos tu pedido. Tu empleador lo tiene que aprobar."); setDesde(""); setHasta(""); setNota(""); load();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo enviar"); }
  }
  if (!d) return <div className="pb-card"><p>{error || "Cargando..."}</p></div>;
  return (
    <>
      <div className="pb-card">
        <h2>Tus días de vacaciones</h2>
        {d.saldos.length === 0 ? <p>Todavía no hay saldo cargado.</p> : d.saldos.map((s) => <p key={s.anio}><b>{s.anio}</b>: te corresponden {s.corresponden}, gozaste {s.gozados}, te quedan {s.pendientes}.</p>)}
      </div>
      <form className="pb-card" onSubmit={enviar}>
        <h2>Pedir vacaciones o una licencia</h2>
        {msg && <div className="pb-msg" role="status">{msg}</div>}
        {error && <div className="pb-error" role="alert">{error}</div>}
        <div className="pb-field"><label htmlFor="vt">Qué querés pedir</label><select id="vt" value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="vacaciones">Vacaciones</option><option value="licencia">Licencia</option></select></div>
        {tipo === "licencia" && <div className="pb-field"><label htmlFor="vl">Tipo de licencia</label><select id="vl" value={lt} onChange={(e) => setLt(e.target.value)} required><option value="">Elegí una</option>{d.tipos_licencia.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></div>}
        <div className="pb-row">
          <div className="pb-field"><label htmlFor="vd">Desde</label><input id="vd" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required /></div>
          <div className="pb-field"><label htmlFor="vh">Hasta</label><input id="vh" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} required /></div>
        </div>
        <div className="pb-field"><label htmlFor="vn">Nota (opcional)</label><input id="vn" maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} /></div>
        <button className="pb-btn" type="submit">Enviar pedido</button>
        <p className="pb-consent">{d.aviso_enfermedad}</p>
      </form>
      {(d.pedidos.length > 0 || d.licencias.length > 0) && (
        <div className="pb-card">
          <h2>Tus pedidos y licencias</h2>
          {d.pedidos.map((p) => <p key={"p" + p.id}>Vacaciones {fmt(p.desde)} al {fmt(p.hasta)} · <b>{p.estado}</b></p>)}
          {d.licencias.map((l) => <p key={"l" + l.id}>{l.tipo} {fmt(l.desde)} al {fmt(l.hasta)} · <b>{l.estado}</b></p>)}
        </div>
      )}
    </>
  );
}

interface Ded { tipo: string; importe_anual: number; mes_desde: number; comprobante: string | null }
interface F572D { anio: number; estado: string | null; deducciones: (Ded & { nombre: string })[]; tipos: Record<string, string>; editable: boolean; cargas: { conyuge: boolean; hijos: number; hijos_incap: number } }

function F572() {
  const anio = new Date().getFullYear();
  const [d, setD] = useState<F572D | null>(null);
  const [filas, setFilas] = useState<{ tipo: string; importe: string; mes: string; comp: string }[]>([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    portalApi<F572D>(`/portal/f572?anio=${anio}`).then((r) => { setD(r); setFilas(r.deducciones.map((x) => ({ tipo: x.tipo, importe: String(x.importe_anual), mes: String(x.mes_desde), comp: x.comprobante || "" }))); }).catch((e) => setError(e.message));
  }, [anio]);
  async function guardar(enviar: boolean) {
    setError(""); setMsg("");
    try {
      const deducciones = filas.filter((f) => f.importe.trim()).map((f) => ({ tipo: f.tipo, importe_anual: Number(f.importe.replace(/\./g, "").replace(",", ".")), mes_desde: Number(f.mes) || 1, comprobante: f.comp.trim() || null }));
      if (deducciones.some((x) => Number.isNaN(x.importe_anual))) { setError("Revisá los importes: tienen que ser números."); return; }
      const r = await portalApi<F572D>("/portal/f572", { method: "POST", body: { anio, deducciones, enviar } });
      setD(r); setMsg(enviar ? "Enviamos tu F.572 a tu empleador." : "Guardamos tu borrador.");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); }
  }
  if (!d) return <div className="pb-card"><p>{error || "Cargando..."}</p></div>;
  const set = (i: number, k: string, v: string) => setFilas(filas.map((f, j) => (j === i ? { ...f, [k]: v } : f)));
  return (
    <div className="pb-card">
      <h2>Deducciones de Ganancias {d.anio}</h2>
      <p>Estado: <b>{d.estado || "sin cargar"}</b>. Cargá lo que querés que tu empleador tenga en cuenta al retenerte Ganancias.</p>
      <p className="pb-consent">Cargas de familia en tu legajo: {d.cargas.conyuge ? "cónyuge, " : ""}{d.cargas.hijos} hijo(s), {d.cargas.hijos_incap} con discapacidad. Si algo no está bien, pedile a tu empleador que lo corrija en tu legajo.</p>
      {msg && <div className="pb-msg" role="status">{msg}</div>}
      {error && <div className="pb-error" role="alert">{error}</div>}
      {filas.map((f, i) => (
        <div key={i} style={{ borderTop: "1px solid #e2e0e8", paddingTop: 10, marginTop: 10 }}>
          <div className="pb-field"><label htmlFor={`ft${i}`}>Tipo</label><select id={`ft${i}`} value={f.tipo} disabled={!d.editable} onChange={(e) => set(i, "tipo", e.target.value)}>{Object.entries(d.tipos).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="pb-row">
            <div className="pb-field"><label htmlFor={`fi${i}`}>Importe anual ($)</label><input id={`fi${i}`} inputMode="decimal" value={f.importe} disabled={!d.editable} onChange={(e) => set(i, "importe", e.target.value)} /></div>
            <div className="pb-field"><label htmlFor={`fm${i}`}>Desde el mes</label><input id={`fm${i}`} inputMode="numeric" value={f.mes} disabled={!d.editable} onChange={(e) => set(i, "mes", e.target.value)} /></div>
          </div>
          <div className="pb-field"><label htmlFor={`fc${i}`}>Comprobante (opcional)</label><input id={`fc${i}`} value={f.comp} disabled={!d.editable} onChange={(e) => set(i, "comp", e.target.value)} /></div>
          {d.editable && <button className="pb-btn pb-btn-ghost" onClick={() => setFilas(filas.filter((_, j) => j !== i))}>Quitar</button>}
        </div>
      ))}
      {d.editable ? (
        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          <button className="pb-btn pb-btn-ghost" onClick={() => setFilas([...filas, { tipo: Object.keys(d.tipos)[0], importe: "", mes: "1", comp: "" }])}>Agregar deducción</button>
          <button className="pb-btn pb-btn-ghost" onClick={() => guardar(false)}>Guardar borrador</button>
          <button className="pb-btn" onClick={() => guardar(true)}>Enviar a mi empleador</button>
        </div>
      ) : <p className="pb-consent">Tu empleador ya aprobó este F.572: para cambiarlo, hablá con él.</p>}
    </div>
  );
}

function Clave({ primera, onDone }: { primera: boolean; onDone: () => void }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [rep, setRep] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  async function submit(ev: FormEvent) {
    ev.preventDefault(); setError(""); setMsg("");
    if (nueva !== rep) { setError("Las contraseñas nuevas no coinciden."); return; }
    try { await portalApi("/portal/password", { method: "POST", body: { actual, nueva } }); setMsg("Listo, cambiaste tu contraseña."); setActual(""); setNueva(""); setRep(""); onDone(); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo cambiar"); }
  }
  return (
    <form className="pb-card" onSubmit={submit}>
      <h2>Cambiar mi contraseña</h2>
      {primera && <div className="pb-msg">Es tu primer ingreso: te recomendamos cambiar la clave provisoria que te dieron.</div>}
      {msg && <div className="pb-msg" role="status">{msg}</div>}
      {error && <div className="pb-error" role="alert">{error}</div>}
      <div className="pb-field"><label htmlFor="ca">Contraseña actual</label><input id="ca" type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} required /></div>
      <div className="pb-field"><label htmlFor="cn">Contraseña nueva (mínimo 8 caracteres)</label><input id="cn" type="password" autoComplete="new-password" minLength={8} value={nueva} onChange={(e) => setNueva(e.target.value)} required /></div>
      <div className="pb-field"><label htmlFor="cr">Repetí la nueva</label><input id="cr" type="password" autoComplete="new-password" value={rep} onChange={(e) => setRep(e.target.value)} required /></div>
      <button className="pb-btn" type="submit">Cambiar contraseña</button>
    </form>
  );
}
