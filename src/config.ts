// Configuración compartida de Nominal · by Mezztt
// En local usa el backend de tu PC. Online se define VITE_API_URL al compilar (ver .env.example).
// En la app de escritorio local la dirección del backend la entrega la propia app (window.mezzttApp, ver desktop/preload.js).
declare global { interface Window { mezzttApp?: { apiUrl?: string; local?: boolean; online?: boolean } } }
export const API_URL = ((typeof window !== "undefined" && window.mezzttApp?.apiUrl) || import.meta.env.VITE_API_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
/** ¿Está corriendo dentro de la app de escritorio de Mezztt? (local = pago único, online = mensual conectada) */
export const IN_DESKTOP_APP = typeof window !== "undefined" && !!window.mezzttApp;
export const IS_LOCAL_APP = typeof window !== "undefined" && !!window.mezzttApp?.local;

export const APP_NAME = "Nominal";
export const APP_VERSION = "1.0.0";
export const APP_BRAND = "Mezztt";

/** Enlaces de marca por defecto (Mezztt los cambia desde Configuración del panel; ver useBrandLinks en components/Brand) */
export interface BrandLinks { system_instagram_url: string; mezztt_instagram_url: string; mezztt_site_url: string }
export const DEFAULT_BRAND_LINKS: BrandLinks = {
  system_instagram_url: "https://instagram.com/nominal.mezztt",
  mezztt_instagram_url: "https://instagram.com/mezzttofficial",
  mezztt_site_url: "https://mezztt.site",
};

export const ADMIN_TOKEN_KEY = "nominal_admin_token";
export const TOKEN_KEY = "nominal_token";
export const USER_KEY = "nominal_user";
export const THEME_KEY = "nominal_theme";

// =====================================================================
// MÓDULOS
//   núcleo (sin cargo)  ·  cobrables (USD 6 c/u)  ·  webs públicas (USD 20 c/u)
// Mismos ids que backend/schemas.py (CORE_MODULES, BILLABLE_MODULES, EXTRA_MODULES, MODULE_DEPENDENCIES)
// =====================================================================
export const CORE_MODULES = ["inicio", "configuracion", "usuarios"];
export const BILLABLE_MODULES = ["legajos", "convenios", "novedades", "liquidaciones", "recibos", "aguinaldo_vacaciones", "liquidacion_final", "ganancias", "descuentos", "arca_exportacion", "multiempresa"];
/** Webs (cada una se cobra con el precio de web) */
export const EXTRA_MODULES = ["web_portal_empleado", "web_verificacion"];
/** Lo que el panel puede tildar para un cliente */
export const ALL_MODULES = [...BILLABLE_MODULES, ...EXTRA_MODULES];

/** Dependencias: lo implícito se tilda y se cobra solo (el panel lo marca como «incluido por …») */
export const MODULE_DEPENDENCIES: Record<string, string[]> = {
  novedades: ["legajos"],
  liquidaciones: ["legajos", "convenios"],
  recibos: ["liquidaciones"],
  aguinaldo_vacaciones: ["liquidaciones"],
  liquidacion_final: ["liquidaciones"],
  ganancias: ["liquidaciones"],
  descuentos: ["legajos"],
  arca_exportacion: ["liquidaciones"],
  web_portal_empleado: ["recibos"],
  web_verificacion: ["recibos"],
};

/** Agrega los módulos que otros necesitan (recibos -> liquidaciones -> legajos y convenios…), en el orden de ALL_MODULES */
export function withDependencies(modules: string[]): string[] {
  const chosen = new Set(modules.filter((m) => ALL_MODULES.includes(m)));
  const queue = [...chosen];
  while (queue.length) {
    for (const dep of MODULE_DEPENDENCIES[queue.pop()!] || []) {
      if (!chosen.has(dep)) { chosen.add(dep); queue.push(dep); }
    }
  }
  return ALL_MODULES.filter((m) => chosen.has(m));
}
/** Qué módulos tildados exigen a `module` (para el aviso «incluido por …») */
export function requiredBy(module: string, selected: string[]): string[] {
  return selected.filter((s) => withDependencies([s]).includes(module) && s !== module);
}

export const MODULE_LABELS: Record<string, string> = {
  inicio: "Inicio", configuracion: "Configuración", usuarios: "Usuarios",
  legajos: "Legajos", convenios: "Convenios y escalas", novedades: "Novedades", liquidaciones: "Liquidaciones",
  recibos: "Recibos", aguinaldo_vacaciones: "Aguinaldo y vacaciones", liquidacion_final: "Liquidación final",
  ganancias: "Ganancias 4ª categoría", descuentos: "Descuentos y embargos", arca_exportacion: "Exportación a ARCA", multiempresa: "Multiempresa",
  web_portal_empleado: "Portal del empleado", web_verificacion: "Verificación de recibos",
};
export const MODULE_HINTS: Record<string, string> = {
  legajos: "Ficha del empleado: datos personales, familia, contrato, documentación y CBU protegido",
  convenios: "Convenios colectivos, categorías y escalas paritarias publicadas por Mezztt",
  novedades: "Licencias, horas extra, banco de horas, ausencias y vacaciones del mes",
  liquidaciones: "Períodos mensuales: cálculo de haberes, aportes, contribuciones y neto",
  recibos: "Recibo según Decreto 407/2026 con costo laboral, firma y conformidad",
  aguinaldo_vacaciones: "SAC (aguinaldo) y vacaciones: saldos, pedidos y liquidación",
  liquidacion_final: "Egreso: indemnización, proporcionales y certificados",
  ganancias: "Retención mensual de Ganancias 4ª categoría con F.572",
  descuentos: "Planes de descuento (tope 20%) y embargos",
  arca_exportacion: "Conciliación con F.931 y planilla para ARCA",
  multiempresa: "Varias empresas empleadoras para estudios contables",
  web_portal_empleado: "El empleado ve y firma sus recibos desde el celular",
  web_verificacion: "Verificación pública del recibo con código QR",
};

export const ROLES = ["ADMINISTRADOR", "CONTADOR", "RRHH", "CONSULTA", "ESTUDIO_ADMIN", "ESTUDIO_USER"];
export const ROLE_LABELS: Record<string, string> = {
  ADMINISTRADOR: "Dueño / gerente", CONTADOR: "Contador", RRHH: "RRHH / administración", CONSULTA: "Solo consulta",
  ESTUDIO_ADMIN: "Estudio: administrador", ESTUDIO_USER: "Estudio: usuario",
};
export const ROLE_HINTS: Record<string, string> = {
  ADMINISTRADOR: "Todo el sistema, usuarios y configuración",
  CONTADOR: "Liquida, cierra períodos y edita parámetros; no ve datos de salud",
  RRHH: "Legajos, novedades y recibos; ve sueldos, salud y CBU, no cierra liquidaciones",
  CONSULTA: "Solo mira sueldos y recibos",
  ESTUDIO_ADMIN: "Todo, en las empresas del estudio",
  ESTUDIO_USER: "Liquida solo las empresas que se le asignan",
};
export const PERMS = ["ver_sueldos", "ver_salud", "ver_cbu", "editar_legajos", "cerrar_liquidacion", "editar_parametros"];

/** Pantallas del menú lateral (en este orden). `roles`: quién la ve además del dueño. Igual a backend/permissions.py MODULE_ROLES. */
export interface NavItem { module: string; path: string; label: string; icon: string; roles: string[]; section: "LIQUIDACIÓN" | "GESTIÓN" | "EMPRESA" }
const ACCT = ["CONTADOR", "ESTUDIO_ADMIN", "ESTUDIO_USER"];
export const NAV: NavItem[] = [
  { module: "inicio", path: "/app", label: "Inicio", icon: "home", roles: ["*"], section: "LIQUIDACIÓN" },
  { module: "liquidaciones", path: "/app/liquidaciones", label: "Liquidaciones", icon: "wallet", roles: ["CONSULTA", ...ACCT], section: "LIQUIDACIÓN" },
  { module: "novedades", path: "/app/novedades", label: "Novedades", icon: "calendarCheck", roles: ["RRHH", ...ACCT], section: "LIQUIDACIÓN" },
  { module: "recibos", path: "/app/recibos", label: "Recibos", icon: "book", roles: ["RRHH", "CONSULTA", ...ACCT], section: "LIQUIDACIÓN" },
  { module: "aguinaldo_vacaciones", path: "/app/aguinaldo-vacaciones", label: "Aguinaldo y vacaciones", icon: "package", roles: ["RRHH", ...ACCT], section: "LIQUIDACIÓN" },
  { module: "liquidacion_final", path: "/app/liquidacion-final", label: "Liquidación final", icon: "truck", roles: ACCT, section: "LIQUIDACIÓN" },
  { module: "ganancias", path: "/app/ganancias", label: "Ganancias", icon: "chart", roles: ACCT, section: "LIQUIDACIÓN" },
  { module: "descuentos", path: "/app/descuentos", label: "Descuentos y embargos", icon: "store", roles: ["RRHH", ...ACCT], section: "LIQUIDACIÓN" },
  { module: "legajos", path: "/app/legajos", label: "Legajos", icon: "contact", roles: ["RRHH", "CONSULTA", ...ACCT], section: "GESTIÓN" },
  { module: "convenios", path: "/app/convenios", label: "Convenios", icon: "hat", roles: ACCT, section: "GESTIÓN" },
  { module: "arca_exportacion", path: "/app/arca", label: "Exportación a ARCA", icon: "grid", roles: ACCT, section: "GESTIÓN" },
  { module: "web_portal_empleado", path: "/app/portal", label: "Portal del empleado", icon: "contact", roles: ["RRHH", ...ACCT], section: "GESTIÓN" },
  { module: "multiempresa", path: "/app/multiempresa", label: "Empresas del estudio", icon: "usersRound", roles: ["ESTUDIO_ADMIN", "ESTUDIO_USER"], section: "GESTIÓN" },
  { module: "usuarios", path: "/app/usuarios", label: "Usuarios", icon: "users", roles: [], section: "EMPRESA" },
  { module: "configuracion", path: "/app/configuracion", label: "Configuración", icon: "settings", roles: [], section: "EMPRESA" },
];
export const pathFor = (module: string) => NAV.find((n) => n.module === module)?.path || `/app/${module}`;
export const iconFor = (module: string) => NAV.find((n) => n.module === module)?.icon || "home";

export function moduleLabel(module: string): string {
  return MODULE_LABELS[module] || module;
}
export function moduleHint(module: string): string {
  return MODULE_HINTS[module] || "";
}

// =====================================================================
// HELPERS
// =====================================================================
export function splitList(value: string | null | undefined): string[] {
  return (value || "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function money(value: number | string | null | undefined): string {
  const n = Number(value || 0);
  const decimals = Number.isInteger(n) ? 0 : 2;
  return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Importe en dólares: "USD 38,72" (los precios de Nominal se cotizan en USD) */
export function usd(value: number | string | null | undefined): string {
  const n = Number(value || 0);
  const decimals = Number.isInteger(n) ? 0 : 2;
  return (n < 0 ? "-USD " : "USD ") + Math.abs(n).toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Planes sobre el abono mensual M (iguales a los del backend, schemas.py): trimestral paga 2 de 3 meses, anual 10 de 12 */
export const TRIMESTRAL_MESES_PAGOS = 2;
export const ANUAL_MESES_PAGOS = 10;
export function plansFor(monthly: number | string | null | undefined) {
  const m = Number(monthly || 0);
  const r = (n: number) => Math.round(n * 100) / 100;
  return { quarterly: r(m * TRIMESTRAL_MESES_PAGOS), annual: r(m * ANUAL_MESES_PAGOS), annualSaving: r(m * (12 - ANUAL_MESES_PAGOS)) };
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const v = value.length === 10 ? value + "T12:00:00" : value;
  return new Date(v).toLocaleDateString("es-AR");
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.toLocaleDateString("es-AR")} ${hhmm(d)}`;
}

const pad = (n: number) => String(n).padStart(2, "0");
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Date -> "2026-10-01T18:30:00" (hora local, lo que espera el backend) */
export function toLocalISO(d: Date): string {
  return `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}
export function parseDay(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function addMinutes(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 60000);
}
export function hhmm(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function timeRange(start: string | Date, end: string | Date): string {
  return `${hhmm(start)}–${hhmm(end)}`;
}
export function hhmmToMinutes(v: string): number {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
}
const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAYS_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]; // 0 = lunes (como el backend)

export function dayLabel(d: Date, short = true): string {
  const today = new Date();
  const k = dayKey(d);
  if (k === dayKey(today)) return "Hoy";
  if (k === dayKey(addDays(today, 1))) return "Mañana";
  if (k === dayKey(addDays(today, -1))) return "Ayer";
  return short ? `${DAYS_ES[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}` : longDate(d);
}
export function longDate(d: Date): string {
  const txt = `${DAYS_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`;
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}
export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const t = `${MONTHS_LONG[(m || 1) - 1]} ${y}`;
  return t.charAt(0).toUpperCase() + t.slice(1);
}
export function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function shiftPeriod(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function minutesLabel(min: number): string {
  if (min % 60 === 0) return `${min / 60} h`;
  if (min > 60) return `${Math.floor(min / 60)} h ${min % 60} min`;
  return `${min} min`;
}
export function initials(name: string): string {
  return name.split(/[\s,]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/** Descarga un archivo del backend (CSV) con el token de la sesión */
export async function downloadFile(path: string, filename: string) {
  const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ""}` } });
  if (!res.ok) throw new Error("No se pudo descargar");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Descarga en el navegador un archivo ya armado */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Arma un CSV que Excel abre bien (separado por ; y con acentos) y lo descarga */
export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",");
    return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const text = [headers, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
  saveBlob(new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" }), filename);
}

/** Descarga un archivo del panel general con una solicitud POST (para cosas que llevan un secreto en el cuerpo) */
export async function adminDownloadPost(path: string, body: unknown, fallbackName: string) {
  const res = await fetch(`${API_URL}${path}`, { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem(ADMIN_TOKEN_KEY) || ""}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(detailText(await res.json().catch(() => ({}))));
  const match = /filename="?([^";]+)"?/.exec(res.headers.get("Content-Disposition") || "");
  saveBlob(await res.blob(), match ? match[1] : fallbackName);
}

/** Descarga un archivo del panel general (con el token del panel) */
export async function adminDownload(path: string, fallbackName: string) {
  const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem(ADMIN_TOKEN_KEY) || ""}` } });
  if (!res.ok) throw new Error("No se pudo descargar");
  const match = /filename="?([^";]+)"?/.exec(res.headers.get("Content-Disposition") || "");
  saveBlob(await res.blob(), match ? match[1] : fallbackName);
}

// =====================================================================
// FETCH
// =====================================================================
function adminHeaders(json = false): HeadersInit {
  const headers: Record<string, string> = { Authorization: `Bearer ${localStorage.getItem(ADMIN_TOKEN_KEY) || ""}` };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

/** fetch para el panel general (Mezztt). Si el token venció, vuelve al login. */
export async function adminApi<T = any>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method || "GET",
      headers: adminHeaders(options.body !== undefined),
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }
  if (response.status === 401 || response.status === 403) {
    if (path !== "/admin/me/password" && !path.endsWith("/toggle-active")) {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      window.location.href = "/";
    }
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(detailText(data));
  return data as T;
}

/** El servidor cortó el acceso (falta de pago o baja): pantalla completa, sin poder usar nada. Al pagar, «Reintentar» vuelve a entrar. */
export function showStopped(message?: string) {
  if (typeof document === "undefined" || document.getElementById("mz-stopped")) return;
  const box = document.createElement("div");
  box.id = "mz-stopped";
  box.setAttribute("role", "alert");
  box.style.cssText = "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:#0b0b0c;color:#f4f4f5;font-family:Inter,system-ui,sans-serif;padding:24px;text-align:center";
  const title = document.createElement("h1");
  title.textContent = message || "Sistema detenido por falta de pago";
  title.style.cssText = "font-size:26px;margin:0 0 10px";
  const text = document.createElement("p");
  text.textContent = "Tus datos están a salvo. Cuando se regularice el pago, el sistema vuelve a funcionar solo. Escribile a Mezztt si ya pagaste.";
  text.style.cssText = "max-width:420px;margin:0 auto 18px;line-height:1.5;color:#a1a1aa";
  const btn = document.createElement("button");
  btn.textContent = "Reintentar";
  btn.style.cssText = "border:0;border-radius:10px;padding:10px 18px;font-weight:700;cursor:pointer;background:#f4f4f5;color:#0b0b0c";
  btn.onclick = () => window.location.reload();
  const wrap = document.createElement("div");
  wrap.append(title, text, btn);
  box.append(wrap);
  document.body.append(box);
}
async function stoppedGuard(response: Response) {
  if (response.status !== 402) return;
  const data = await response.clone().json().catch(() => ({}));
  const d = data?.detail;
  showStopped(typeof d === "object" && d ? d.message : undefined);
  throw new Error(typeof d === "object" && d ? d.message : "Sistema detenido");
}

function employerHeader(): Record<string, string> {
  const id = getEmployerId();
  return id ? { "X-Employer-Id": id } : {};
}

function detailText(data: any): string {
  const d = data?.detail;
  if (typeof d === "string") return d;
  if (d && typeof d === "object" && typeof d.message === "string") return d.message;
  if (Array.isArray(d) && d[0]?.msg) return "Revisá los datos: " + d.map((x: any) => (x.loc || []).slice(-1)[0]).join(", ");
  return "Ocurrió un error";
}

/** fetch para el sistema del local. Si la sesión venció, vuelve al login. */
export async function appApi<T = any>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ""}`, ...employerHeader() };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }
  await stoppedGuard(response);
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = IN_DESKTOP_APP ? "/app" : "/";      // en la app de escritorio la sesión se renueva sola al recargar
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(detailText(data));
  return data as T;
}

/** Sube un archivo (multipart). No lleva Content-Type: el navegador arma el boundary. */
export async function appUpload<T = any>(path: string, form: FormData): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ""}`, ...employerHeader() },
      body: form,
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = "/";
  }
  await stoppedGuard(response);
  if (response.status === 413) throw new Error("El archivo es demasiado grande");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(detailText(data));
  return data as T;
}

/** Trae un archivo protegido (imagen, PDF) con el token en el encabezado, nunca en la URL */
export async function appBlob(path: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ""}`, ...employerHeader() } });
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }
  await stoppedGuard(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(detailText(data));
  }
  return response.blob();
}

/** fetch público (verificación de recibos y portal, sin login) */
export async function publicApi<T = any>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method || "GET",
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("No se pudo conectar. Probá de nuevo en un momento.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(detailText(data));
  return data as T;
}

// =====================================================================
// SESIÓN
// =====================================================================
export interface EmployerItem { id: number; razon_social: string; cuit: string | null; es_principal: boolean }
export interface SessionUser {
  id: number;
  name: string;
  email: string;
  company_id: number;
  company_name: string;
  business_type?: string;
  role: string;
  perms?: string[];
  enabled_modules: string;
  employers?: EmployerItem[];
}

export const EMPLOYER_KEY = "nominal_employer";
/** Empresa empleadora elegida (se manda como X-Employer-Id en cada llamada). */
export function getEmployerId(): string {
  try { return localStorage.getItem(EMPLOYER_KEY) || ""; } catch { return ""; }
}
export function setEmployerId(id: string | number) {
  try { localStorage.setItem(EMPLOYER_KEY, String(id)); } catch { /* sin almacenamiento */ }
}

export function getSessionUser(): SessionUser | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function hasPerm(user: SessionUser | null, perm: string): boolean {
  return !!user && (user.perms || []).includes(perm);
}

/** ¿Puede esta persona abrir la pantalla de `module`? (módulo contratado + rol). El backend vuelve a validar. */
export function canAccess(user: SessionUser | null, module: string): boolean {
  if (!user) return false;
  const enabled = CORE_MODULES.includes(module) || splitList(user.enabled_modules).includes(module);
  if (!enabled) return false;
  if (module === "multiempresa" && user.business_type !== "ESTUDIO") return false;   // «Empresas del estudio» es solo de estudios contables
  if (module === "configuracion" || module === "usuarios") return user.role === "ADMINISTRADOR" || user.role === "ESTUDIO_ADMIN";
  if (user.role === "ADMINISTRADOR") return true;
  const item = NAV.find((n) => n.module === module);
  if (!item) return false;
  return item.roles.includes("*") || item.roles.includes(user.role);
}

// =====================================================================
// PANEL (Mezztt)
// =====================================================================
export interface SystemItem {
  id: number;
  cancel_code?: string | null;
  service_end_date?: string | null;
  name: string;
  slug: string | null;
  business_type: string | null;
  industry?: string | null;
  cuit: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  enabled_modules: string | null;
  client_price: number | string | null;
  payment_status: string;
  payment_due_date: string | null;
  billed: boolean;
  apply_iva: boolean;
  archived: boolean;
  notes: string | null;
  created_at: string;
}
export interface PaymentItem { id: number; company_id: number; amount: number | string; payment_date: string; method: string | null; notes: string | null }
export const GRACE_DAYS = 10;
export function isOverdue(s: Pick<SystemItem, "payment_due_date" | "payment_status">): boolean {
  if (!s.payment_due_date || s.payment_status === "al_dia") return false;
  const limit = new Date(s.payment_due_date);
  limit.setDate(limit.getDate() + GRACE_DAYS);
  return new Date() > limit;
}
export function systemStatus(s: SystemItem): { label: string; tone: "ok" | "warn" | "off" } {
  if (s.archived) return { label: "Dado de baja", tone: "off" };
  if (isOverdue(s)) return { label: "Pago atrasado", tone: "warn" };
  return { label: "Activo", tone: "ok" };
}
export const PAYMENT_STATUS_LABELS: Record<string, string> = { al_dia: "Al día", pendiente: "Pendiente", vencido: "Vencido" };

/** Precios de Nominal (USD): configuración (una vez), precio por módulo cobrable y precio de cada web */
export interface BillingPrices { base_cost: number | string; module_price: number | string; web_price: number | string }
export interface PriceBreakdown {
  setup: number; modulesCount: number; modulesTotal: number; web: number; websCount: number;
  monthlySubtotal: number; monthlyTotal: number; initialSubtotal: number; initialTotal: number;
  /** módulos finales (con dependencias) y los que se agregaron solos */
  modules: string[]; implied: string[];
}
/**
 * Pago inicial (una sola vez) = configuración + módulos cobrables + webs.
 * Abono mensual = módulos cobrables + webs (la configuración no se cobra por mes).
 * Los módulos que otros necesitan (salón -> caja, etc.) se agregan y se cobran. Mismo cálculo que el backend.
 */
export function priceBreakdown(chosen: string[], prices: BillingPrices | null, iva: boolean): PriceBreakdown {
  const base = [...new Set(chosen)].filter((m) => ALL_MODULES.includes(m));
  const modules = withDependencies(base);
  const implied = modules.filter((m) => !base.includes(m));
  const modulesCount = modules.filter((m) => !EXTRA_MODULES.includes(m)).length;
  const websCount = modules.filter((m) => EXTRA_MODULES.includes(m)).length;
  const setup = Number(prices?.base_cost ?? 0);
  const modulesTotal = Number(prices?.module_price ?? 0) * modulesCount;
  const web = Number(prices?.web_price ?? 0) * websCount;
  const monthlySubtotal = modulesTotal + web;
  const initialSubtotal = setup + monthlySubtotal;
  const f = iva ? 1.21 : 1;
  return { setup, modulesCount, modulesTotal, web, websCount, monthlySubtotal, monthlyTotal: monthlySubtotal * f, initialSubtotal, initialTotal: initialSubtotal * f, modules, implied };
}

/** Ítem del panel «Pendientes» del Inicio */
export interface PendingItem { key: string; label: string; count: number; path: string; hint: string; tone: "warn" | "alert" | "info"; amount?: number }

export const PERM_LABELS: Record<string, string> = {
  ver_sueldos: "Ver sueldos", ver_salud: "Ver datos de salud", ver_cbu: "Ver CBU completo", editar_legajos: "Editar legajos",
  cerrar_liquidacion: "Cerrar liquidaciones", editar_parametros: "Editar parámetros legales",
};
