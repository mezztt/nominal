import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { API_URL, IS_LOCAL_APP, TOKEN_KEY, appApi, canAccess, dateTime, getSessionUser, hasPerm, moduleLabel, saveBlob, shortDate, usd } from "../../config";
import type { EmployerItem } from "../../config";
import { BajaServicioCard } from "../../components/BajaServicio";
import { startTour } from "../../components/tour/Tour";
import { INDUSTRIES, industryInfo } from "../../rubros";
import { Empty, Field, Loading, Modal, PageHeader, Pill, Seg, Switch, Tabs, numOrNull, strOrNull, useFlash } from "../../components/ui";

interface CancellationItem { code: string; kind: string; status: string; created_at: string }

type Tab = "empresa" | "recibo" | "criterios" | "parametros" | "feriados" | "plan" | "ayuda";

interface Company { industry?: string | null; name: string; cuit: string | null; email: string | null; phone: string | null; address: string | null; city: string | null; business_type: string }
interface Employer {
  id: number; razon_social: string; nombre_fantasia: string | null; cuit: string | null; cuit_valido: boolean | null; domicilio: string | null;
  localidad: string | null; provincia: string | null; actividad: string | null; es_mipyme: boolean; mipyme_vigencia: string | null; tamano: number | null;
  art_nombre: string | null; art_porcentaje: number; art_suma_fija: number; scvo_prima: number | null; fal_id: string | null; fal_alicuota: number | null;
  obra_social_default: string | null; banco: string | null; cbu_mask: string | null; tiene_cbu: boolean; lugar_pago: string | null; payslip_prefix: string | null;
}
interface Receipt {
  grafico_posicion: "pie" | "cabecera"; ganancias_en_grafico: string; firma_vias: string[]; copias: string; prorrateo_sumas_globales: string;
  hoja_explicativa: boolean; pendiente_contraste: boolean; aviso_contraste: string | null;
  config: ReceiptConfig;
}
type ReceiptConfig = { textos: { conformidad: string; leyenda_responsable: string; pie: string }; qr_verificacion: boolean };
interface ParamRow { id: number; clave: string; valor: unknown; periodicidad: string; vigencia_desde: string; vigencia_hasta: string | null; fuente_titulo: string; fuente_url: string | null; nota: string | null; verificado: boolean; status: string; confirmado: boolean }
interface HolidayItem { id: number; fecha: string; nombre: string; ambito: string; activo: boolean; propio: boolean }
interface Plan { company_name: string; payment_status: string; payment_due_date: string | null; client_price: number | null; apply_iva: boolean; modules: string[]; core_modules: string[]; available_modules: string[] }

const STATUS_TONE: Record<string, [string, string]> = { vigente: ["green", "Vigente"], por_vencer: ["orange", "Por vencer"], vencido: ["red", "Vencido"] };
const CRITERIO_LABELS: Record<string, [string, string]> = {
  nr_aportan_os_inssjp_sind: ["Las sumas no remunerativas de convenio aportan a obra social, INSSJP y sindicato", "Criterio de la sección H.3. La base del aporte la fija el convenio; el tope de 2% (art. 9 Ley 14.250, Ley 27.802) se mide sin sumas no remunerativas (Decretos 407 y 612/2026) y no cuenta la cuota de afiliación."],
  presentismo_incluye_nr: ["El presentismo incluye las sumas no remunerativas", "Por defecto no."],
  presentismo_incluye_he: ["El presentismo incluye las horas extra", "Por defecto no."],
  he_base_incluye_presentismo: ["El valor hora de las extras incluye el presentismo", "Básico + antigüedad + presentismo."],
  sac_sobre_preaviso_integracion: ["El SAC se calcula también sobre preaviso e integración del mes", "Aplica a la liquidación final."],
  vacaciones_dias_sin_redondeo: ["Vacaciones proporcionales con 2 decimales, sin redondear los días", ""],
};

function Configuracion() {
  const user = getSessionUser();
  const location = useLocation();
  const { show, fail, node: flash } = useFlash();
  const [tab, setTab] = useState<Tab>(() => ((location.state as { tab?: Tab } | null)?.tab) || "empresa");
  const canEdit = ["ADMINISTRADOR", "ESTUDIO_ADMIN", "CONTADOR", "ESTUDIO_USER"].includes(user?.role || "");
  const canParams = hasPerm(user, "editar_parametros");

  return (
    <section className="products-page">
      <PageHeader eyebrow="CONFIGURACIÓN" title="Configuración" subtitle="Datos de la empresa, plantilla del recibo, criterios de liquidación y parámetros legales." />
      <Tabs<Tab> value={tab} onChange={setTab} options={[
        ["empresa", "Empresa"], ["recibo", "Recibo"], ["criterios", "Criterios"], ["parametros", "Parámetros legales"],
        ["feriados", "Feriados"], ["plan", "Mi plan"], ["ayuda", "Ayuda"],
      ]} />
      {tab === "empresa" && <EmpresaTab canEdit={canEdit} show={show} fail={fail} />}
      {tab === "recibo" && <ReciboTab canEdit={canEdit} show={show} fail={fail} />}
      {tab === "criterios" && <CriteriosTab canEdit={canParams} show={show} fail={fail} />}
      {tab === "parametros" && <ParametrosTab canEdit={canParams} show={show} fail={fail} />}
      {tab === "feriados" && <FeriadosTab canEdit={canEdit} show={show} fail={fail} />}
      {tab === "plan" && <PlanTab show={show} fail={fail} />}
      {tab === "ayuda" && (
        <div className="nm-card">
          <h2>¿Cómo funcionamos?</h2>
          <p className="nm-muted">Volvé a ver el recorrido por las pantallas de Nominal cuando quieras.</p>
          <button className="primary-button" onClick={startTour}>Ver el recorrido</button>
        </div>
      )}
      {flash}
    </section>
  );
}

type Msg = { show: (t: string, e?: boolean) => void; fail: (e: unknown) => void };

function EmpresaTab({ canEdit, show, fail }: { canEdit: boolean } & Msg) {
  const [company, setCompany] = useState<Company | null>(null);
  const [emp, setEmp] = useState<Employer | null>(null);
  const [list, setList] = useState<EmployerItem[]>([]);
  const [cbu, setCbu] = useState("");
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => {
    appApi<Company>("/company").then(setCompany).catch(fail);
    appApi<Employer>("/config/employer").then(setEmp).catch(fail);
    appApi<EmployerItem[]>("/config/employers").then(setList).catch(() => {});
  }, [fail]);
  useEffect(load, [load]);
  if (!company || !emp) return <Loading />;
  const setE = <K extends keyof Employer>(k: K, v: Employer[K]) => setEmp({ ...emp, [k]: v });
  const setC = <K extends keyof Company>(k: K, v: Company[K]) => setCompany({ ...company, [k]: v });

  async function save() {
    if (!emp || !company) return;
    setSaving(true);
    try {
      await appApi("/company", { method: "PUT", body: { name: company.name, cuit: strOrNull(company.cuit), email: strOrNull(company.email), phone: strOrNull(company.phone), address: strOrNull(company.address), city: strOrNull(company.city) } });
      const body: Record<string, unknown> = {
        razon_social: emp.razon_social, nombre_fantasia: strOrNull(emp.nombre_fantasia), cuit: strOrNull(emp.cuit), domicilio: strOrNull(emp.domicilio),
        localidad: strOrNull(emp.localidad), provincia: strOrNull(emp.provincia), actividad: strOrNull(emp.actividad), es_mipyme: emp.es_mipyme,
        mipyme_vigencia: emp.es_mipyme ? strOrNull(emp.mipyme_vigencia) : null, tamano: numOrNull(emp.tamano), art_nombre: strOrNull(emp.art_nombre),
        art_porcentaje: numOrNull(emp.art_porcentaje), art_suma_fija: numOrNull(emp.art_suma_fija), scvo_prima: numOrNull(emp.scvo_prima),
        fal_id: strOrNull(emp.fal_id), fal_alicuota: numOrNull(emp.fal_alicuota), obra_social_default: strOrNull(emp.obra_social_default),
        banco: strOrNull(emp.banco), lugar_pago: strOrNull(emp.lugar_pago), payslip_prefix: strOrNull(emp.payslip_prefix),
      };
      if (cbu.trim()) body.cbu = cbu;
      setEmp(await appApi<Employer>("/config/employer", { method: "PUT", body }));
      setCbu("");
      show("Datos guardados");
    } catch (e) { fail(e); } finally { setSaving(false); }
  }

  return (
    <div className="nm-stack">
      {list.length > 1 && <div className="nm-note">Estás configurando la empresa seleccionada arriba a la izquierda: <b>{emp.razon_social}</b>.</div>}
      <div className="nm-card">
        <div className="nm-card-head"><div><h2>Empresa empleadora</h2><p>Estos datos van en el encabezado de cada recibo.</p></div></div>
        <div className="nm-grid-2">
          <Field label="Razón social"><input value={emp.razon_social} onChange={(e) => setE("razon_social", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Nombre de fantasía"><input value={emp.nombre_fantasia || ""} onChange={(e) => setE("nombre_fantasia", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="CUIT" hint={emp.cuit && emp.cuit_valido === false ? "El dígito verificador no coincide: revisalo." : "11 números; se valida el dígito verificador."}>
            <input value={emp.cuit || ""} onChange={(e) => setE("cuit", e.target.value)} disabled={!canEdit} placeholder="30-12345678-9" /></Field>
          <Field label="Actividad"><input value={emp.actividad || ""} onChange={(e) => setE("actividad", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Domicilio" wide><input value={emp.domicilio || ""} onChange={(e) => setE("domicilio", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Localidad"><input value={emp.localidad || ""} onChange={(e) => setE("localidad", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Provincia"><input value={emp.provincia || ""} onChange={(e) => setE("provincia", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Cantidad de trabajadores"><input inputMode="numeric" value={emp.tamano ?? ""} onChange={(e) => setE("tamano", numOrNull(e.target.value))} disabled={!canEdit} /></Field>
          <Field label="Prefijo de numeración de recibos"><input value={emp.payslip_prefix || ""} maxLength={6} onChange={(e) => setE("payslip_prefix", e.target.value)} disabled={!canEdit} /></Field>
        </div>
      </div>
      <div className="nm-card">
        <div className="nm-card-head"><div><h2>Contribuciones y seguros</h2><p>Cambian la alícuota (18% o 20,4%), el FAL y el costo laboral.</p></div></div>
        <Switch on={emp.es_mipyme} onChange={(v) => setE("es_mipyme", v)} label="Tiene certificado MiPyME vigente" hint="Alícuota de contribuciones del 18% y FAL del 2,5%." />
        <div className="nm-grid-2">
          {emp.es_mipyme && <Field label="Vencimiento del certificado"><input type="date" value={emp.mipyme_vigencia || ""} onChange={(e) => setE("mipyme_vigencia", e.target.value)} disabled={!canEdit} /></Field>}
          <Field label="ART (aseguradora)"><input value={emp.art_nombre || ""} onChange={(e) => setE("art_nombre", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="ART: alícuota variable (%)"><input inputMode="decimal" value={emp.art_porcentaje ?? ""} onChange={(e) => setE("art_porcentaje", e.target.value as unknown as number)} disabled={!canEdit} /></Field>
          <Field label="ART: suma fija por trabajador ($)"><input inputMode="decimal" value={emp.art_suma_fija ?? ""} onChange={(e) => setE("art_suma_fija", e.target.value as unknown as number)} disabled={!canEdit} /></Field>
          <Field label="Seguro de vida obligatorio ($)" hint="Vacío = usa el parámetro vigente."><input inputMode="decimal" value={emp.scvo_prima ?? ""} onChange={(e) => setE("scvo_prima", e.target.value as unknown as number)} disabled={!canEdit} /></Field>
          <Field label="Obra social por defecto"><input value={emp.obra_social_default || ""} onChange={(e) => setE("obra_social_default", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Código FAL"><input value={emp.fal_id || ""} onChange={(e) => setE("fal_id", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="FAL: alícuota propia (%)" hint="Vacío = usa el parámetro vigente."><input inputMode="decimal" value={emp.fal_alicuota ?? ""} onChange={(e) => setE("fal_alicuota", e.target.value as unknown as number)} disabled={!canEdit} /></Field>
        </div>
      </div>
      <div className="nm-card">
        <div className="nm-card-head"><div><h2>Pago</h2><p>El CBU se guarda cifrado y nunca se muestra completo.</p></div></div>
        <div className="nm-grid-2">
          <Field label="Banco"><input value={emp.banco || ""} onChange={(e) => setE("banco", e.target.value)} disabled={!canEdit} /></Field>
          <Field label={emp.tiene_cbu ? `CBU cargado (${emp.cbu_mask})` : "CBU de la cuenta"} hint={emp.tiene_cbu ? "Escribí uno nuevo para reemplazarlo." : "22 números."}>
            <input inputMode="numeric" value={cbu} onChange={(e) => setCbu(e.target.value)} autoComplete="off" disabled={!canEdit} /></Field>
          <Field label="Lugar de pago" wide><input value={emp.lugar_pago || ""} onChange={(e) => setE("lugar_pago", e.target.value)} disabled={!canEdit} /></Field>
        </div>
      </div>
      <div className="nm-card">
        <div className="nm-card-head"><div><h2>Cuenta del cliente</h2><p>Los datos de contacto de quien contrató Nominal.</p></div></div>
        <div className="nm-grid-2">
          <Field label="Nombre"><input value={company.name} onChange={(e) => setC("name", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="CUIT"><input value={company.cuit || ""} onChange={(e) => setC("cuit", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Email"><input type="email" value={company.email || ""} onChange={(e) => setC("email", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Teléfono"><input value={company.phone || ""} onChange={(e) => setC("phone", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Dirección"><input value={company.address || ""} onChange={(e) => setC("address", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Ciudad"><input value={company.city || ""} onChange={(e) => setC("city", e.target.value)} disabled={!canEdit} /></Field>
        </div>
      </div>
      {IS_LOCAL_APP && <LocalBackupCard show={show} fail={fail} />}
      <IndustryCard industry={company.industry || ""} onSaved={(k) => setCompany({ ...company, industry: k })} show={show} fail={fail} />
      {canEdit && (
        <div className="nm-row">
          <button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</button>
          {canAccess(getSessionUser(), "multiempresa") && <button className="secondary-button" onClick={() => setAdding(true)}>+ Otra empresa empleadora</button>}
        </div>
      )}
      {adding && <NewEmployer onClose={() => setAdding(false)} onSaved={() => { setAdding(false); show("Empresa creada. Elegila arriba para trabajar con ella."); load(); }} />}
    </div>
  );
}

interface IndustryStarter {
  industry: string | null; label: string | null; aviso: string;
  convenios: { numero: string | null; nombre: string; aviso: string; status: string; estado: string }[];
  conceptos: { codigo: string; nombre: string; tipo: string }[];
}

/** Tipo de negocio del cliente + lista (solo de lectura) de convenios y conceptos para revisar. No carga nada. */
function IndustryCard({ industry, onSaved, show, fail }: { industry: string; onSaved: (k: string) => void } & Msg) {
  const user = getSessionUser();
  const canChange = ["ADMINISTRADOR", "ESTUDIO_ADMIN"].includes(user?.role || "");
  const [info, setInfo] = useState<IndustryStarter | null>(null);
  const [open, setOpen] = useState(false);
  const current = industryInfo(industry);
  async function change(key: string) {
    if (!key) return;
    try { await appApi("/company", { method: "PUT", body: { industry: key } }); onSaved(key); show("Tipo de negocio guardado"); }
    catch (e) { fail(e); }
  }
  async function seeSuggestions() {
    try { setInfo(await appApi<IndustryStarter>("/company/industry-starter")); setOpen(true); } catch (e) { fail(e); }
  }
  return (
    <div className="nm-card">
      <div className="nm-card-head"><div><h2>Tipo de negocio</h2><p>No cambia lo que tenés contratado: sirve para sugerirte qué convenios conviene tener a mano.</p></div></div>
      <div className="nm-grid-2">
        <Field label="¿A qué se dedica la empresa?">
          <select value={industry} disabled={!canChange} onChange={(e) => change(e.target.value)}>
            <option value="">Sin elegir</option>
            {INDUSTRIES.map((r) => <option key={r.key} value={r.key}>{r.icon} {r.label}</option>)}
          </select>
        </Field>
        {current && <Field label="Para este tipo de negocio"><p className="nm-muted">{current.tagline}</p></Field>}
      </div>
      {current && <button className="secondary-button" style={{ alignSelf: "flex-start" }} onClick={seeSuggestions}>Ver convenios y conceptos sugeridos</button>}
      {open && info && (
        <Modal eyebrow="SUGERENCIAS" title={`Para ${(info.label || "").toLowerCase()}`} onClose={() => setOpen(false)}>
          <p className="nm-muted">{info.aviso}</p>
          <h3>Convenios para revisar</h3>
          {info.convenios.map((c) => (
            <div key={c.nombre} className="nm-note" style={{ marginBottom: 8 }}>
              <b>{c.nombre}</b>{c.numero ? ` (CCT ${c.numero})` : ""} · {c.estado}
              <div className="nm-muted">{c.aviso}</div>
            </div>
          ))}
          <h3>Conceptos de recibo que ya vienen cargados</h3>
          <p className="nm-muted">{info.conceptos.map((c) => `${c.codigo} ${c.nombre}`).join(" · ") || "Todavía no hay conceptos base cargados."}</p>
        </Modal>
      )}
    </div>
  );
}

function NewEmployer({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [razon, setRazon] = useState("");
  const [cuit, setCuit] = useState("");
  const [error, setError] = useState("");
  async function save() {
    try { await appApi("/config/employers", { method: "POST", body: { razon_social: razon, cuit: strOrNull(cuit) } }); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo crear"); }
  }
  return (
    <Modal eyebrow="MULTIEMPRESA" title="Otra empresa empleadora" onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save} disabled={!razon.trim()}>Crear</button></>}>
      <div className="product-form">
        <Field label="Razón social"><input value={razon} onChange={(e) => setRazon(e.target.value)} autoFocus /></Field>
        <Field label="CUIT"><input value={cuit} onChange={(e) => setCuit(e.target.value)} /></Field>
        {error && <div className="nm-note nm-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

function ReciboTab({ canEdit, show, fail }: { canEdit: boolean } & Msg) {
  const [r, setR] = useState<Receipt | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { appApi<Receipt>("/config/recibo").then(setR).catch(fail); }, [fail]);
  if (!r) return <Loading />;
  const toggleVia = (v: string) => setR({ ...r, firma_vias: r.firma_vias.includes(v) ? r.firma_vias.filter((x) => x !== v) : [...r.firma_vias, v] });
  const setText = (k: "conformidad" | "leyenda_responsable" | "pie", v: string) => setR({ ...r, config: { ...r.config, textos: { ...r.config.textos, [k]: v } } });
  async function save() {
    if (!r) return;
    setSaving(true);
    try {
      setR(await appApi<Receipt>("/config/recibo", { method: "PUT", body: {
        grafico_posicion: r.grafico_posicion, ganancias_en_grafico: r.ganancias_en_grafico, firma_vias: r.firma_vias, copias: r.copias,
        prorrateo_sumas_globales: r.prorrateo_sumas_globales, hoja_explicativa: r.hoja_explicativa, config: r.config } }));
      show("Plantilla guardada");
    } catch (e) { fail(e); } finally { setSaving(false); }
  }
  return (
    <div className="nm-stack">
      {r.pendiente_contraste && <div className="nm-note nm-note-warn" role="note">{r.aviso_contraste}. Podés configurarla, pero no la tomes como definitiva hasta que se confirme.</div>}
      <div className="nm-card">
        <div className="nm-card-head"><div><h2>Plantilla del recibo</h2><p>Decreto 407/2026, Anexo III: cuatro secciones y gráfico del costo laboral.</p></div></div>
        <div className="nm-grid-2">
          <Field label="Gráfico del costo laboral"><Seg value={r.grafico_posicion} onChange={(v) => setR({ ...r, grafico_posicion: v })} options={[["pie", "Al pie"], ["cabecera", "En la cabecera"]]} /></Field>
          <Field label="Ganancias en el gráfico">
            <select value={r.ganancias_en_grafico} onChange={(e) => setR({ ...r, ganancias_en_grafico: e.target.value })} disabled={!canEdit}>
              <option value="separado">Separado</option><option value="excluido">Excluido</option><option value="dentro_del_neto">Dentro del neto</option>
            </select></Field>
          <Field label="Copias"><select value={r.copias} onChange={(e) => setR({ ...r, copias: e.target.value })} disabled={!canEdit}><option value="ORIGINAL">Original</option><option value="ORIGINAL_DUPLICADO">Original y duplicado</option></select></Field>
          <Field label="Reparto de sumas globales">
            <select value={r.prorrateo_sumas_globales} onChange={(e) => setR({ ...r, prorrateo_sumas_globales: e.target.value })} disabled={!canEdit}>
              <option value="igual">Por igual</option><option value="por_remuneracion">Según remuneración</option><option value="por_jornada">Según jornada</option>
            </select></Field>
        </div>
        <Field label="Cómo firma el trabajador" hint="Al menos una vía.">
          <div className="nm-inline-checks">
            {([["papel", "En papel"], ["portal", "En el portal del empleado"], ["digital", "Firma digital"]] as const).map(([v, l]) =>
              <label key={v}><input type="checkbox" checked={r.firma_vias.includes(v)} onChange={() => toggleVia(v)} disabled={!canEdit} /> {l}</label>)}
          </div>
        </Field>
        <Switch on={r.hoja_explicativa} onChange={(v) => setR({ ...r, hoja_explicativa: v })} label="Incluir hoja explicativa" />
      </div>
      <div className="nm-card">
        <div className="nm-card-head"><div><h2>Textos</h2></div></div>
        <Field label="Leyenda de conformidad"><input value={r.config.textos.conformidad} onChange={(e) => setText("conformidad", e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Leyenda del responsable"><textarea rows={2} value={r.config.textos.leyenda_responsable} onChange={(e) => setText("leyenda_responsable", e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Pie"><input value={r.config.textos.pie} onChange={(e) => setText("pie", e.target.value)} disabled={!canEdit} /></Field>
      </div>
      {canEdit && <div><button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar plantilla"}</button></div>}
    </div>
  );
}

function CriteriosTab({ canEdit, show, fail }: { canEdit: boolean } & Msg) {
  const [crit, setCrit] = useState<Record<string, boolean | string> | null>(null);
  useEffect(() => { appApi<{ criterios: Record<string, boolean | string> }>("/config/criterios").then((d) => setCrit(d.criterios)).catch(fail); }, [fail]);
  if (!crit) return <Loading />;
  async function set(k: string, v: boolean | string) {
    const next = { ...crit, [k]: v };
    setCrit(next);
    try { await appApi("/config/criterios", { method: "PUT", body: { criterios: { [k]: v } } }); show("Criterio guardado"); }
    catch (e) { setCrit(crit); fail(e); }
  }
  return (
    <div className="nm-card">
      <div className="nm-card-head"><div><h2>Criterios de liquidación</h2><p>Interruptores donde la ley o el convenio admiten más de una lectura. Cada cambio queda registrado.</p></div></div>
      {!canEdit && <div className="nm-note">Para cambiarlos necesitás el permiso «Editar parámetros legales».</div>}
      {Object.entries(CRITERIO_LABELS).map(([k, [label, hint]]) =>
        typeof crit[k] === "boolean" ? <Switch key={k} on={crit[k] as boolean} onChange={(v) => canEdit && set(k, v)} label={label} hint={hint} /> : null)}
      <Field label="Divisor del SAC"><Seg value={String(crit.sac_divisor || "calendario")} onChange={(v) => canEdit && set("sac_divisor", v)} options={[["calendario", "Días del semestre (181/184)"], ["180", "180 días"]]} /></Field>
    </div>
  );
}

function fmtValue(v: unknown): string {
  if (typeof v === "number") return v.toLocaleString("es-AR", { maximumFractionDigits: 5 });
  if (typeof v === "string") return v;
  const t = JSON.stringify(v);
  return t.length > 60 ? t.slice(0, 57) + "..." : t;
}

function ParametrosTab({ canEdit, show, fail }: { canEdit: boolean } & Msg) {
  const [rows, setRows] = useState<ParamRow[] | null>(null);
  const load = useCallback(() => { appApi<{ params: ParamRow[] }>("/params").then((d) => setRows(d.params)).catch(fail); }, [fail]);
  useEffect(load, [load]);
  if (!rows) return <Loading />;
  async function ack(id: number) {
    try { await appApi(`/params/${id}/ack`, { method: "POST", body: {} }); show("Parámetro confirmado"); load(); } catch (e) { fail(e); }
  }
  const pending = rows.filter((r) => r.status !== "vigente" && !r.confirmado).length;
  return (
    <div className="nm-card">
      <div className="nm-card-head"><div><h2>Parámetros legales vigentes</h2><p>Los publica Mezztt con su fuente y fecha. Si alguno está vencido o por vencer, confirmá que lo revisaste antes de cerrar el mes.</p></div></div>
      {pending > 0 && <div className="nm-note nm-note-warn" role="note">{pending} parámetro(s) sin confirmar. Bloquean el cierre del período.</div>}
      {rows.length === 0 ? <Empty title="Todavía no hay parámetros publicados">Mezztt los publica desde su panel; aparecen acá apenas estén.</Empty> : (
        <div className="nm-table-wrap">
          <table className="nm-table">
            <thead><tr><th>Parámetro</th><th>Valor</th><th>Vigencia</th><th>Fuente</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {rows.map((p) => {
                const [tone, label] = STATUS_TONE[p.status] || ["gray", p.status];
                return (
                  <tr key={p.id}>
                    <td><strong>{p.clave}</strong><small>{p.periodicidad}</small></td>
                    <td>{fmtValue(p.valor)}</td>
                    <td>{shortDate(p.vigencia_desde)}{p.vigencia_hasta ? ` a ${shortDate(p.vigencia_hasta)}` : ""}</td>
                    <td>{p.fuente_url ? <a href={p.fuente_url} target="_blank" rel="noreferrer">{p.fuente_titulo}</a> : p.fuente_titulo}{!p.verificado && <small>Sin verificar contra la norma</small>}</td>
                    <td><Pill tone={tone}>{label}</Pill>{p.confirmado && <small>Confirmado</small>}</td>
                    <td>{canEdit && p.status !== "vigente" && !p.confirmado && <button className="secondary-button" onClick={() => ack(p.id)}>Confirmar</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FeriadosTab({ canEdit, show, fail }: { canEdit: boolean } & Msg) {
  const year = new Date().getFullYear();
  const [rows, setRows] = useState<HolidayItem[] | null>(null);
  const [fecha, setFecha] = useState("");
  const [nombre, setNombre] = useState("");
  const load = useCallback(() => { appApi<HolidayItem[]>(`/config/feriados?anio=${year}`).then(setRows).catch(fail); }, [fail, year]);
  useEffect(load, [load]);
  async function add() {
    try { await appApi("/config/feriados", { method: "POST", body: { fecha, nombre, ambito: "empresa" } }); setFecha(""); setNombre(""); show("Feriado agregado"); load(); } catch (e) { fail(e); }
  }
  async function remove(id: number) {
    try { await appApi(`/config/feriados/${id}`, { method: "DELETE" }); load(); } catch (e) { fail(e); }
  }
  if (!rows) return <Loading />;
  return (
    <div className="nm-card">
      <div className="nm-card-head"><div><h2>Feriados {year}</h2><p>Los nacionales y provinciales los publica Mezztt. Acá sumás los propios (día del gremio, puentes de la empresa).</p></div></div>
      {canEdit && (
        <div className="nm-row" style={{ marginBottom: 12 }}>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha" />
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del feriado" aria-label="Nombre" />
          <button className="primary-button" onClick={add} disabled={!fecha || nombre.trim().length < 2}>Agregar</button>
        </div>
      )}
      {rows.length === 0 ? <Empty title="Sin feriados cargados">Cuando Mezztt publique el calendario o cargues uno propio, lo vas a ver acá.</Empty> : (
        <div className="nm-table-wrap"><table className="nm-table"><tbody>
          {rows.map((h) => (
            <tr key={h.id}><td>{shortDate(h.fecha)}</td><td><strong>{h.nombre}</strong></td><td><Pill tone={h.propio ? "brand" : "gray"}>{h.propio ? "Propio" : h.ambito}</Pill></td>
              <td>{h.propio && canEdit && <button className="nm-link nm-link-danger" onClick={() => remove(h.id)}>Quitar</button>}</td></tr>
          ))}
        </tbody></table></div>
      )}
    </div>
  );
}

function PlanTab({ fail }: Msg) {
  const user = getSessionUser();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [open, setOpen] = useState<"ARREPENTIMIENTO" | null>(null);
  const [bajas, setBajas] = useState<CancellationItem[]>([]);
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const owner = user?.role === "ADMINISTRADOR" || user?.role === "ESTUDIO_ADMIN";
  const load = useCallback(() => {
    appApi<Plan>("/config/plan").then(setPlan).catch(fail);
    if (owner) appApi<CancellationItem[]>("/cancellation-request").then(setBajas).catch(() => {});
  }, [fail, owner]);
  useEffect(load, [load]);
  if (!plan) return <Loading />;
  async function send() {
    try {
      const r = await appApi<{ code: string }>("/cancellation-request", { method: "POST", body: { reason: strOrNull(reason), kind: open } });
      setCode(r.code); load();
    } catch (e) { fail(e); }
  }
  return (
    <div className="nm-stack">
      <div className="nm-card">
        <div className="nm-card-head"><div><h2>Mi plan</h2><p>Módulos incluidos, abono y estado del pago.</p></div></div>
        <p>Abono: <b>{plan.client_price != null ? usd(plan.client_price) : "a convenir"}</b>{plan.apply_iva ? " + IVA" : ""} · Pago: <Pill tone={plan.payment_status === "al_dia" ? "green" : "orange"}>{plan.payment_status}</Pill>{plan.payment_due_date && <> · vence {shortDate(plan.payment_due_date)}</>}</p>
        <div className="nm-chips">{plan.modules.map((m) => <Pill key={m} tone="brand">{moduleLabel(m)}</Pill>)}</div>
        {plan.available_modules.length > 0 && <p className="nm-muted" style={{ marginTop: 10 }}>Podés sumar: {plan.available_modules.map(moduleLabel).join(", ")}. Pedilo a Mezztt.</p>}
      </div>
      {owner && <BajaServicioCard />}
      {owner && (
        <div className="nm-card">
          <div className="nm-card-head"><div><h2>Arrepentimiento</h2><p>Dentro de los plazos de la Disposición 954/2025. Queda registrado con fecha y código.</p></div></div>
          <div className="nm-row">
            <button className="secondary-button" onClick={() => { setCode(""); setOpen("ARREPENTIMIENTO"); }}>Arrepentimiento</button>
          </div>
          {bajas.length > 0 && <ul className="nm-muted">{bajas.map((b) => <li key={b.code}>Arrepentimiento {b.code} · {dateTime(b.created_at)} · {b.status}</li>)}</ul>}
        </div>
      )}
      {open && (
        <Modal eyebrow="ARREPENTIMIENTO" title="Arrepentimiento" onClose={() => setOpen(null)}
          footer={code ? <button className="primary-button" onClick={() => setOpen(null)}>Listo</button>
            : <><button className="secondary-button" onClick={() => setOpen(null)}>Volver</button><button className="nm-danger-button" onClick={send}>Enviar el pedido</button></>}>
          <div className="product-form">
            {code ? <p>Recibimos tu pedido. Guardá este código de constancia: <strong>{code}</strong>.</p> : (
              <><p className="nm-muted">Te respondemos dentro de las 24 horas.</p>
                <Field label="Motivo (opcional)"><textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field></>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Configuracion;

/** Solo en la app de escritorio local (pago único): los datos están únicamente en esta PC, así que acá se hace la copia de seguridad. */
function LocalBackupCard({ show, fail }: { show: (t: string) => void; fail: (e: unknown) => void }) {
  const [busy, setBusy] = useState(false);
  async function backup() {
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/local/backup`, { headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ""}` } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "No se pudo hacer la copia");
      const match = /filename="?([^";]+)"?/.exec(res.headers.get("Content-Disposition") || "");
      saveBlob(await res.blob(), match ? match[1] : "Nominal-copia.db");
      show("Copia de seguridad guardada");
    } catch (e) { fail(e); } finally { setBusy(false); }
  }
  return (
    <div className="nm-card">
      <div className="nm-card-head"><div><h2>Copia de seguridad</h2><p>Tus datos están solo en esta computadora. Guardá una copia en un pendrive o en la nube cada semana: si la PC se rompe, es lo único que te permite recuperarlos.</p></div></div>
      <button className="secondary-button" type="button" onClick={backup} disabled={busy}>{busy ? "Preparando…" : "Descargar copia de seguridad"}</button>
    </div>
  );
}
