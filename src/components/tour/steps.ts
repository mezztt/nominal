// Pasos del tutorial «¿Cómo funcionamos?» de Nominal, según el rol de quien entra.
// Solo se incluyen pantallas que esa persona realmente ve en su menú.
import { canAccess, splitList } from "../../config";
import type { SessionUser } from "../../config";
import type { TourStep } from "./Tour";

const nav = (m: string) => `[data-tour="nav-${m}"]`;

export function tourSteps(user: SessionUser | null): TourStep[] {
  if (!user) return [];
  const can = (m: string) => canAccess(user, m);
  const steps: TourStep[] = [];
  const add = (cond: boolean, s: TourStep) => { if (cond) steps.push(s); };
  const role = user.role;
  const has = (m: string) => splitList(user.enabled_modules).includes(m);
  const theme: TourStep = { selector: '[data-tour="theme"]', title: "Claro u oscuro", text: "Cambiá el aspecto de la pantalla según lo que te resulte más cómodo." };
  const help: TourStep = { selector: '[data-tour="tour-help"]', title: "¿Cómo funcionamos?", text: "Si querés volver a ver este recorrido, tocá este botón cuando quieras." };
  const who = role === "CONSULTA" ? "Desde acá consultás sueldos y recibos."
    : role === "RRHH" ? "Desde acá cargás legajos y novedades y emitís recibos."
    : role === "CONTADOR" ? "Desde acá liquidás, cerrás períodos y mantenés los parámetros legales."
    : role.startsWith("ESTUDIO") ? "Desde acá liquidás los sueldos de las empresas de tu estudio."
    : "Desde acá manejás la liquidación de sueldos de tu empresa.";
  add(true, { title: "Bienvenido a Nominal", text: `${who} Te mostramos lo principal en un minuto.` });
  add(true, { selector: '[data-tour="pendientes"]', title: "Pendientes", text: "En Inicio ves lo que hay para resolver ahora: liquidaciones sin calcular, parámetros por vencer, recibos sin conformidad y más. Tocá uno y vas directo a esa pantalla." });
  add(user.role !== "CONSULTA" && (user.employers || []).length > 1, { selector: '[data-tour="empresa"]', title: "Empresa empleadora", text: "Elegí con qué empresa trabajás. Todo lo que ves —legajos, liquidaciones, recibos— es de la empresa elegida." });
  add(can("legajos"), { selector: nav("legajos"), title: "Legajos", text: "La ficha de cada empleado: datos, familia, contrato y documentación. El CBU y los datos de salud están protegidos y su lectura queda registrada." });
  add(can("convenios"), { selector: nav("convenios"), title: "Convenios", text: "Categorías y escalas paritarias. Mezztt publica los paquetes con fuente y fecha; vos los aceptás." });
  add(can("novedades"), { selector: nav("novedades"), title: "Novedades", text: "Licencias, horas extra, ausencias y vacaciones del mes, antes de liquidar." });
  add(can("liquidaciones"), { selector: nav("liquidaciones"), title: "Liquidaciones", text: "Abrí el período, calculá, revisá y cerrá. El cierre guarda los parámetros usados para que el recibo sea reproducible." });
  add(can("recibos"), { selector: nav("recibos"), title: "Recibos", text: "Emití los recibos con el formato del Decreto 407/2026 y seguí la conformidad de cada trabajador." });
  add(can("aguinaldo_vacaciones"), { selector: nav("aguinaldo_vacaciones"), title: "Aguinaldo y vacaciones", text: "SAC de junio y diciembre y saldos de vacaciones." });
  add(can("liquidacion_final"), { selector: nav("liquidacion_final"), title: "Liquidación final", text: "Egresos: indemnización, proporcionales y certificados." });
  add(can("ganancias"), { selector: nav("ganancias"), title: "Ganancias", text: "Retención mensual de 4ª categoría con las deducciones del F.572." });
  add(can("descuentos"), { selector: nav("descuentos"), title: "Descuentos y embargos", text: "Planes de descuento con el tope del 20% y embargos judiciales." });
  add(can("arca_exportacion"), { selector: nav("arca_exportacion"), title: "Exportación a ARCA", text: "Planilla de conciliación para presentar en ARCA. Nominal no presenta nada por vos." });
  add(can("web_portal_empleado"), { selector: nav("web_portal_empleado"), title: "Portal del empleado", text: "Dale acceso a cada empleado: ve sus recibos, da su conformidad, pide vacaciones y carga su F.572." });
  add(can("multiempresa"), { selector: nav("multiempresa"), title: "Empresas del estudio", text: "Tablero con todas las empresas, sus alertas y vencimientos. Entrás a cada una con un clic." });
  add(true, theme);
  const webs = [has("web_portal_empleado") && "el portal del empleado", has("web_verificacion") && "la verificación de recibos por QR"].filter(Boolean).join(" y ");
  if (can("configuracion")) add(true, { selector: nav("configuracion"), title: "Configuración", text: `Datos de la empresa, plantilla del recibo, criterios y parámetros legales.${webs ? ` Tenés activo ${webs}.` : ""} Acá mismo está el botón «¿Cómo funcionamos?» para volver a ver este recorrido.` });
  else add(true, help);
  return steps;
}

/** Recorrido del panel general de Mezztt (superadmin) */
export function adminTourSteps(): TourStep[] {
  const a = (p: string) => `[data-tour="admin-${p}"]`;
  return [
    { title: "Bienvenido al panel de Nominal", text: "Desde acá administrás los clientes que usan Nominal: qué módulos tienen habilitados, cuánto pagan y cómo se factura. Te mostramos lo principal." },
    { selector: a("inicio"), title: "Inicio", text: "El resumen: cuántos clientes hay, qué se espera cobrar este mes, cuánto ya entró y los pedidos de baja pendientes." },
    { selector: a("parametros"), title: "Parámetros legales", text: "Publicá topes, escalas, alícuotas y convenios con su fuente y fecha. Los clientes reciben el aviso y confirman." },
    { selector: a("sistemas"), title: "Sistemas", text: "Cada cliente es un sistema. Acá lo das de alta, elegís sus módulos (los que dependen de otros se marcan solos), el abono y podés resetear contraseñas." },
    { selector: a("pagos"), title: "Pagos", text: "Registrá lo que te paga cada cliente y mirá quién está al día y quién debe." },
    { selector: a("facturacion"), title: "Facturación", text: "Cotizaciones con pago inicial y abono mensual (más los planes trimestral y anual) y las facturas mensuales de cada sistema." },
    { selector: '[data-tour="theme"]', title: "Claro u oscuro", text: "Cambiá el aspecto de la pantalla según lo que te resulte más cómodo." },
    { selector: a("configuracion"), title: "Configuración", text: "Precios, enlaces de marca y copia de seguridad. Acá mismo está el botón «¿Cómo funcionamos?» para volver a ver este recorrido." },
  ];
}
