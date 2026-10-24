import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { appApi, canAccess, hasPerm, money, shortDate, periodLabel, NAV, moduleLabel } from "../config";
import type { SessionUser } from "../config";
import { NominalLogo } from "./Brand";
import { startTour } from "./tour/Tour";

/**
 * Asistente de Nominal (flotante, solo en el panel del cliente).
 * Responde con datos reales de la empresa (empleados, liquidación del mes, recibos por emitir, aguinaldo, vencimientos)
 * y explica cómo usar el sistema. Funciona por reglas: no usa IA externa ni tiene costo.
 * Respeta módulos y permisos: solo consulta lo que el usuario puede ver. No da asesoramiento legal ni contable definitivo.
 * (No confundir con components/liquidacion-final/Asistente.tsx, que es el asistente paso a paso del egreso.)
 */

interface Action { label: string; to?: string; run?: () => void }
interface Msg { from: "bot" | "user"; text: string; actions?: Action[] }

const VALIDAR = "Es una guía general: validalo con tu contador.";

// ---------- texto ----------
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

function lev(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** ¿El texto contiene la palabra/frase? Las palabras cortas (≤4) van enteras; las demás toleran un tipeo (2 si son largas). */
function has(t: string, ...words: string[]): boolean {
  const tokens = t.split(/[^a-z0-9]+/).filter(Boolean);
  return words.some((w) => {
    if (!w.includes(" ") && w.length <= 4) return tokens.includes(w);
    if (t.includes(w)) return true;
    if (w.includes(" ")) return false;
    const max = w.length >= 9 ? 2 : 1;
    return tokens.some((k) => k.length >= 4 && lev(k, w) <= max);
  });
}

const lista = (items: string[], max = 6) => items.slice(0, max).map((x) => `• ${x}`).join("\n") + (items.length > max ? `\n… y ${items.length - max} más.` : "");

// ---------- ayuda ("cómo hago X") ----------
interface Help { id: string; keys: string[]; text: string; to?: string; label?: string; module?: string; tour?: boolean }

const HELP: Help[] = [
  {
    id: "liquidar", keys: ["liquidar", "liquido", "liquidamos", "liquidacion mensual", "liquidar un mes", "liquidar el mes", "liquidar sueldos", "calcular", "nuevo periodo", "cerrar periodo", "cerrar el mes", "cerrar", "cierro", "cerrar la liquidacion"],
    module: "liquidaciones", to: "/app/liquidaciones", label: "Ir a Liquidaciones",
    text: "Para liquidar un mes:\n1. Dejá al día Legajos y Novedades.\n2. En Liquidaciones tocá «Nuevo período» (mes y año).\n3. Tocá «Calcular»: liquida a todos los empleados.\n4. Revisá las alertas, «Marcar revisado» y «Cerrar período».\nEl cierre guarda los parámetros legales usados y no te deja cerrar si hay un CUIL inválido, un parámetro vencido sin confirmar o falta una escala. Cerrar lo hace quien tiene ese permiso (dueño o contador).",
  },
  {
    id: "reabrir", keys: ["reabrir", "reabro", "corregir un periodo", "periodo cerrado", "me equivoque"],
    module: "liquidaciones", to: "/app/liquidaciones", label: "Ir a Liquidaciones",
    text: "Un período cerrado se puede reabrir desde su detalle en Liquidaciones, con «Reabrir» y contando el motivo (queda auditado). Solo lo hace quien tiene permiso para cerrar. Si ya emitiste recibos, anulá o reemití los que cambien. " + VALIDAR,
  },
  {
    id: "novedades", keys: ["novedad", "novedades", "hora extra", "horas extra", "horas extras", "extras", "ausencia", "ausencias", "faltas", "presentismo", "licencia", "licencias", "banco de horas", "enfermedad"],
    module: "novedades", to: "/app/novedades", label: "Ir a Novedades",
    text: "Las novedades se cargan antes de calcular, en Novedades:\n• «Horas y ausencias»: horas extra, faltas y demás novedades del mes por empleado.\n• «Licencias»: enfermedad, maternidad, etc. Una licencia sin aprobar no descuenta nada.\n• «Banco de horas»: saldo y movimientos.\nUna ausencia injustificada hace perder el presentismo. Si cargás algo con el período ya calculado, volvé a tocar «Calcular».",
  },
  {
    id: "emitir", keys: ["emitir", "emito", "emision", "recibo", "recibos", "imprimir recibo", "recibo de sueldo"],
    module: "recibos", to: "/app/recibos", label: "Ir a Recibos",
    text: "Para emitir los recibos: primero cerrá el período en Liquidaciones. Después, en Recibos aparece «Períodos cerrados con recibos para emitir» y tocás «Emitir recibos». Cada recibo sale inmodificable, con su número y su QR, y desde ahí lo ves, imprimís o enviás al portal del empleado. Si falta un dato (CUIT o domicilio de la empresa; CUIL, fecha de ingreso o categoría del empleado) ese recibo no sale y te dice qué completar. Preguntame «¿qué falta para emitir?» y te lo reviso.",
  },
  {
    id: "anular", keys: ["anular", "anulo", "anulacion", "recibo mal", "corregir recibo", "reemitir"],
    module: "recibos", to: "/app/recibos", label: "Ir a Recibos",
    text: "Un recibo emitido no se edita: se anula desde Recibos con «Anular», contando el motivo, y si el período sigue cerrado se emite uno nuevo en su lugar. Si el error es de cálculo, reabrí antes el período en Liquidaciones. " + VALIDAR,
  },
  {
    id: "pago", keys: ["pagar", "pago", "se paga", "transferencia", "depositar", "deposito", "fecha de pago", "fecha limite", "cuando pago", "banco"],
    to: "/app/liquidaciones", label: "Ir a Liquidaciones",
    text: "Nominal liquida y emite los recibos, pero no mueve plata: el pago del sueldo (transferencia o depósito) lo hacés vos desde tu banco, con el neto de cada recibo. Cuando pagues, marcá la fecha de pago real en el período (Liquidaciones). La fecha límite de pago la calcula el sistema según los días hábiles después del cierre del mes. Confirmá plazos y forma de pago con tu contador.",
  },
  {
    id: "aguinaldo", keys: ["aguinaldo", "sac", "medio aguinaldo", "segundo semestre", "primer semestre"],
    module: "aguinaldo_vacaciones", to: "/app/aguinaldo-vacaciones", label: "Ir a Aguinaldo",
    text: "Aguinaldo (SAC): en Aguinaldo y vacaciones → «Aguinaldo (SAC)» elegís el semestre, ves la proyección por empleado (mejor remuneración del semestre, proporcional si ingresó después) y lo liquidás. Se paga en dos cuotas: 30 de junio y 18 de diciembre, con unos días hábiles de tolerancia. Después se cierra y se emiten los recibos como cualquier período. " + VALIDAR,
  },
  {
    id: "vacaciones", keys: ["vacaciones", "vacacion", "saldo de vacaciones", "cronograma"],
    module: "aguinaldo_vacaciones", to: "/app/aguinaldo-vacaciones", label: "Ir a Vacaciones",
    text: "Vacaciones: en Aguinaldo y vacaciones → «Vacaciones» ves los saldos por empleado, cargás pedidos y mirás el cronograma. Si tenés el portal, el empleado también puede pedirlas desde el celular. " + VALIDAR,
  },
  {
    id: "final", keys: ["liquidacion final", "egreso", "despido", "renuncia", "indemnizacion", "preaviso", "certificado de trabajo", "finiquito"],
    module: "liquidacion_final", to: "/app/liquidacion-final", label: "Ir a Liquidación final",
    text: "Liquidación final: en Liquidación final tocá «Nuevo egreso» y seguí el asistente de 4 pasos: datos del egreso (fecha y causa), base de cálculo, conceptos (haberes finales e indemnizaciones) y resumen con emisión. Al emitir se generan los documentos del egreso. Es un cálculo sensible: revisalo siempre con tu contador o abogado laboralista.",
  },
  {
    id: "convenios", keys: ["convenio", "convenios", "escala", "escalas", "paritaria", "paritarias", "categoria", "categorias", "cct", "basico"],
    module: "convenios", to: "/app/convenios", label: "Ir a Convenios",
    text: "Convenios: en Convenios ves los convenios colectivos con sus categorías y escalas paritarias (las publica Mezztt). Cada empleado se asigna a un convenio y categoría en su legajo, y la liquidación toma el básico de la escala vigente. Si necesitás uno propio, usá «Convenio propio»; en «Conceptos y fórmulas» definís conceptos adicionales. Sin escala vigente para una categoría, esa persona no se puede liquidar.",
  },
  {
    id: "empleado", keys: ["empleado", "empleados", "legajo", "legajos", "alta de empleado", "nuevo empleado", "agregar empleado", "importar", "csv", "cuil", "fecha de ingreso", "baja"],
    module: "legajos", to: "/app/legajos", label: "Ir a Legajos",
    text: "Para dar de alta un empleado: Legajos → «Nuevo empleado» (o «Importar CSV» si tenés varios). Para poder emitirle recibo necesita CUIL válido, fecha de ingreso y categoría (o sueldo pactado si está fuera de convenio); el CBU hace falta para pagarle. El filtro «Datos incompletos» te muestra a quién le falta algo.",
  },
  {
    id: "descuentos", keys: ["descuento", "descuentos", "embargo", "embargos", "prestamo", "adelanto", "cuota"],
    module: "descuentos", to: "/app/descuentos", label: "Ir a Descuentos",
    text: "Descuentos y embargos: ahí cargás planes de descuento (préstamos, adelantos) con sus cuotas, que se descuentan en cada liquidación respetando el tope del 20%, y los embargos. " + VALIDAR,
  },
  {
    id: "ganancias", keys: ["ganancias", "f572", "f 572", "retencion", "cuarta categoria"],
    module: "ganancias", to: "/app/ganancias", label: "Ir a Ganancias",
    text: "Ganancias 4ª categoría: en Ganancias cargás el F.572 de cada empleado y el sistema calcula la retención mensual con los parámetros vigentes; también ves el acumulado del año y el ajuste anual. " + VALIDAR,
  },
  {
    id: "arca", keys: ["arca", "afip", "f931", "931", "fal", "conciliacion", "presentar", "exportar", "cargas sociales", "contribuciones"],
    module: "arca_exportacion", to: "/app/arca", label: "Ir a Exportación a ARCA",
    text: "Exportación a ARCA: ahí conciliás lo liquidado con el F.931, ves los vencimientos (pago de sueldos, F.931, FAL, SAC) y descargás la planilla para cargar en ARCA. Nominal no presenta nada por vos: la presentación y el pago de cargas sociales los hacés vos o tu contador. " + VALIDAR,
  },
  {
    id: "portal", keys: ["portal", "acceso del empleado", "conformidad", "firma", "firmar", "qr", "verificar recibo"],
    module: "web_portal_empleado", to: "/app/portal", label: "Ir al Portal",
    text: "Portal del empleado: en Portal del empleado creás el acceso de cada persona. Desde el celular ve sus recibos, da su conformidad y pide vacaciones. Si firma en papel, en Recibos marcás «Firmó en papel». El QR del recibo permite verificar que es auténtico.",
  },
  {
    id: "usuarios", keys: ["usuario", "usuarios", "rol", "roles", "permiso", "permisos", "contador", "rrhh", "invitar"],
    module: "usuarios", to: "/app/usuarios", label: "Ir a Usuarios",
    text: "En Usuarios creás a tu equipo. Roles: Dueño/gerente (todo), Contador (liquida, cierra y edita parámetros), RRHH (legajos, novedades y recibos; ve sueldos pero no cierra) y Solo consulta (mira sueldos y recibos). Cada uno ve solo las pantallas que le corresponden.",
  },
  {
    id: "baja_servicio", keys: ["dar de baja el servicio", "baja del servicio", "darme de baja", "darse de baja", "cancelar el servicio", "cancelar la suscripcion", "dejar de usar", "ya no quiero usar", "dar de baja nominal"],
    module: "configuracion", to: "/app/configuracion", label: "Ir a Configuración",
    text: "Para darte de baja: Configuración → «Mi plan» → «Dar de baja el servicio» (también está en el menú). Se confirma en dos pasos y te da al instante una constancia BAJA-SRV con fecha y hora. No se corta de golpe: seguís usando el sistema hasta el final del período que ya pagaste, no se cobra de nuevo y no borramos tus datos. Si cambiás de idea, podés «Retirar la baja» antes de esa fecha.",
  },
  {
    id: "parametros", keys: ["parametro", "parametros", "topes", "tope", "anses", "feriados", "feriado", "mipyme", "datos de la empresa", "domicilio", "cuit"],
    module: "configuracion", to: "/app/configuracion", label: "Ir a Configuración",
    text: "En Configuración tenés: «Empresa» (CUIT, domicilio, ART, MiPyME: van en el recibo), «Recibo» (plantilla), «Criterios» de liquidación, «Parámetros legales» (topes ANSES, escalas, Ganancias: hay que confirmar los vencidos antes de cerrar), «Feriados» y «Mi plan». " + VALIDAR,
  },
  {
    id: "estudio", keys: ["estudio", "empresas del estudio", "multiempresa", "varias empresas", "cambiar de empresa", "otra empresa", "clientes del estudio"],
    module: "multiempresa", to: "/app/multiempresa", label: "Ir a Empresas del estudio",
    text: "Empresas del estudio: ahí das de alta las empresas que liquidás, ves el Tablero con las alertas de cada una, los vencimientos de todas juntas y asignás usuarios. Para trabajar una empresa elegila en el selector «Empresa» de arriba: todas las pantallas pasan a mostrar esa empresa.",
  },
  {
    id: "tema", keys: ["oscuro", "modo oscuro", "modo claro"],
    text: "El modo oscuro/claro se cambia abajo del menú de la izquierda (en el celular, abrí el menú con las tres rayitas).",
  },
  {
    id: "tour", keys: ["recorrido", "tutorial", "tour", "como funciona", "como funcionamos", "primeros pasos", "empezar"],
    tour: true,
    text: "Tenés un recorrido guiado por el sistema: tocá el botón de abajo, o «¿Cómo funcionamos?» en el menú de la izquierda.",
  },
];

// ---------- componente ----------
function AsistenteNominal({ user }: { user: SessionUser | null }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  // en el celular el botón se esconde al bajar la pantalla (así no tapa los botones de acción del final) y vuelve al subir
  const [tuck, setTuck] = useState(false);
  useEffect(() => {
    const last = new WeakMap<EventTarget, number>();
    const onScroll = (e: Event) => {
      const t = e.target as HTMLElement | Document;
      const y = t instanceof Document ? window.scrollY : (t as HTMLElement).scrollTop;
      const prev = last.get(t);
      if (prev === undefined) { last.set(t, y); return; }
      if (Math.abs(y - prev) > 6) { setTuck(y > prev && y > 60); last.set(t, y); }
    };
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, []);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const can = (m: string) => canAccess(user, m);
  const seeMoney = hasPerm(user, "ver_sueldos");
  const esEstudio = user?.business_type === "ESTUDIO";

  useEffect(() => {
    if (open && msgs.length === 0) {
      const first = (user?.name || "").split(" ")[0];
      setMsgs([{
        from: "bot",
        text: `¡Hola${first ? ` ${first}` : ""}! Soy el asistente de Nominal. Te cuento el estado de la liquidación, qué falta para emitir recibos, los vencimientos, o te explico cómo hacer algo. Es orientación general: lo legal y contable validalo con tu contador.`,
      }]);
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, typing]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /** ¿Puede ir a esa ruta? (módulo contratado + rol) */
  function canGo(path: string): boolean {
    const clean = path.split("?")[0];
    if (clean === "/app") return true;
    const item = NAV.find((n) => n.path !== "/app" && (clean === n.path || clean.startsWith(n.path + "/")));
    return !!item && can(item.module);
  }
  const go = (label: string, to: string): Action[] => (canGo(to) ? [{ label, to }] : []);
  const denied = (module: string): Msg => ({
    from: "bot",
    text: `«${moduleLabel(module)}» no está disponible para tu usuario o tu plan. Si lo necesitás, pedíselo al administrador.`,
  });
  const noMoney: Msg = { from: "bot", text: "Tu usuario no tiene permiso para ver sueldos y montos. Pedíselo al administrador de la empresa." };

  function helpReply(h: Help): Msg {
    if (h.module && !can(h.module)) return denied(h.module);
    const actions: Action[] = [];
    if (h.tour) actions.push({ label: "Ver el recorrido", run: startTour });
    else if (h.to) actions.push(...go(h.label || "Ir", h.to));
    return { from: "bot", text: h.text, actions: actions.length ? actions : undefined };
  }

  function bestHelp(t: string): Help | null {
    let best: Help | null = null;
    let score = 0;
    for (const h of HELP) {
      let s = 0;
      for (const k of h.keys) if (has(t, k)) s += k.length;
      if (s > score) { score = s; best = h; }
    }
    return best;
  }

  // ---------- datos reales ----------
  const sinFalta = (m: string) => m.replace(/^Falta /, "falta ").replace(/^El /, "el ");

  async function qEmpleados(): Promise<Msg> {
    if (!can("legajos")) return denied("legajos");
    const r = await appApi<{ total: number; resumen: { activos: number; licencia: number; suspendidos: number; bajas: number; incompletos: number } }>("/empleados?limit=1");
    const s = r.resumen;
    const extra = [s.licencia ? `${s.licencia} de licencia` : "", s.suspendidos ? `${s.suspendidos} suspendido${s.suspendidos > 1 ? "s" : ""}` : ""].filter(Boolean);
    return {
      from: "bot",
      text: `Hay ${s.activos} empleado${s.activos === 1 ? "" : "s"} activo${s.activos === 1 ? "" : "s"}${extra.length ? ` (${extra.join(", ")})` : ""} y ${s.bajas} baja${s.bajas === 1 ? "" : "s"}.` +
        (s.incompletos ? `\n${s.incompletos} legajo${s.incompletos > 1 ? "s tienen" : " tiene"} datos incompletos. Preguntame «¿qué falta para emitir?» para ver cuáles.` : "\nTodos los legajos tienen los datos básicos."),
      actions: go("Ver Legajos", "/app/legajos"),
    };
  }

  async function qIncompletos(): Promise<Msg> {
    if (!can("legajos")) return denied("legajos");
    const r = await appApi<{ total: number; items: { nombre: string; faltantes: { mensaje: string }[] }[] }>("/empleados?filtro=incompletos&limit=50");
    if (!r.total) return { from: "bot", text: "No hay legajos con datos incompletos.", actions: go("Ver Legajos", "/app/legajos") };
    return {
      from: "bot",
      text: `${r.total} legajo${r.total > 1 ? "s" : ""} con datos incompletos:\n` + lista(r.items.map((e) => `${e.nombre}: ${e.faltantes.map((f) => sinFalta(f.mensaje)).join("; ")}`)),
      actions: go("Completar en Legajos", "/app/legajos"),
    };
  }

  async function qLiquidacion(): Promise<Msg> {
    if (!can("liquidaciones")) return denied("liquidaciones");
    type P = { id: number; etiqueta: string; estado: string; tipo: string; empleados: number; alertas: number; bruto: number | null; neto: number | null; costo_laboral: number | null; fecha_pago_limite: string | null; fecha_pago_real: string | null };
    const ps = await appApi<P[]>("/periodos");
    if (!ps.length) return { from: "bot", text: "Todavía no abriste ningún período. En Liquidaciones tocá «Nuevo período» para empezar.", actions: go("Ir a Liquidaciones", "/app/liquidaciones") };
    const p = ps.find((x) => x.tipo === "mensual") || ps[0];
    const estado: Record<string, string> = { borrador: "borrador (sin calcular)", calculada: "calculada", revisada: "revisada", cerrada: "cerrada" };
    const lines = [`${p.etiqueta}: ${estado[p.estado] || p.estado}, ${p.empleados} empleado${p.empleados === 1 ? "" : "s"} liquidado${p.empleados === 1 ? "" : "s"}${p.alertas ? `, ${p.alertas} alerta${p.alertas > 1 ? "s" : ""} para revisar` : ""}.`];
    if (seeMoney && p.neto != null) lines.push(`Bruto ${money(p.bruto)} · Neto a pagar ${money(p.neto)} · Costo laboral ${money(p.costo_laboral)}.`);
    if (p.fecha_pago_limite) lines.push(`Fecha límite de pago: ${shortDate(p.fecha_pago_limite)}${p.fecha_pago_real ? ` (pagado el ${shortDate(p.fecha_pago_real)})` : ""}.`);
    if (p.estado === "borrador") lines.push("Siguiente paso: tocá «Calcular» en el período.");
    else if (p.estado !== "cerrada") {
      try {
        const b = await appApi<{ bloqueos: { mensaje: string; confirmable: boolean }[] }>(`/periodos/${p.id}/bloqueos`);
        lines.push(b.bloqueos.length ? "Para poder cerrarlo falta:\n" + lista(b.bloqueos.map((x) => x.mensaje), 5) : "No hay nada que impida cerrarlo: revisalo y cerralo.");
      } catch { /* sin detalle de bloqueos */ }
    } else lines.push("Ya está cerrado: podés emitir los recibos.");
    return { from: "bot", text: lines.join("\n"), actions: go("Abrir período", "/app/liquidaciones") };
  }

  /** Recibos que faltan emitir y POR QUÉ (empresa, empleados, período sin cerrar) */
  async function qEmision(): Promise<Msg> {
    if (!can("recibos")) return denied("recibos");
    if (!seeMoney) return noMoney;
    const r = await appApi<{ periodos: { id: number; etiqueta: string; sin_emitir: number }[] }>("/recibos");
    const sin = r.periodos.filter((p) => p.sin_emitir > 0);
    const lines: string[] = [];
    // período sin cerrar: todavía no se puede emitir
    let abierto: { etiqueta: string; estado: string } | undefined;
    if (can("liquidaciones")) {
      try { abierto = (await appApi<{ etiqueta: string; estado: string }[]>("/periodos")).find((x) => x.estado !== "cerrada"); } catch { /* sin acceso */ }
    }
    if (abierto) lines.push(`${abierto.etiqueta} sigue ${abierto.estado === "borrador" ? "sin calcular" : "abierto"}: hay que calcularlo y cerrarlo antes de emitir sus recibos.`);
    if (!sin.length) {
      return { from: "bot", text: (lines.length ? lines.join("\n") + "\n" : "") + "No hay recibos de períodos cerrados pendientes de emitir.", actions: go("Ver Recibos", "/app/recibos") };
    }
    lines.unshift(`Faltan emitir recibos de ${sin.map((p) => `${p.etiqueta} (${p.sin_emitir})`).join(", ")}.`);
    const motivos: string[] = [];
    // empresa: CUIT y domicilio
    try {
      const e = await appApi<{ cuit: string | null; cuit_valido: boolean | null; domicilio: string | null }>("/config/employer");
      if (!e.cuit) motivos.push("Empresa: falta el CUIT (Configuración → Empresa).");
      else if (e.cuit_valido === false) motivos.push("Empresa: el CUIT no es válido (Configuración → Empresa).");
      if (!e.domicilio) motivos.push("Empresa: falta el domicilio (Configuración → Empresa).");
    } catch { /* sin datos de la empresa */ }
    // empleados: CUIL, fecha de ingreso, categoría (el CBU no frena el recibo)
    let empAcc: Action[] = [];
    if (can("legajos")) {
      try {
        const emp = await appApi<{ items: { nombre: string; faltantes: { campo: string; mensaje: string }[] }[] }>("/empleados?filtro=incompletos&limit=100");
        const filas = emp.items
          .map((e) => ({ n: e.nombre, f: e.faltantes.filter((x) => x.campo !== "cbu").map((x) => sinFalta(x.mensaje).replace(/ \(o el sueldo.*$/, "")) }))
          .filter((x) => x.f.length);
        if (filas.length) { motivos.push(`Empleados con datos que frenan el recibo:\n${lista(filas.map((x) => `${x.n}: ${x.f.join("; ")}`), 5)}`); empAcc = go("Completar legajos", "/app/legajos"); }
      } catch { /* sin acceso */ }
    }
    if (motivos.length) lines.push("Posibles causas:\n" + motivos.join("\n"));
    else lines.push("No veo datos faltantes de la empresa ni de los legajos. Probá «Emitir recibos»: si algún recibo no sale, el sistema te dice el motivo exacto.");
    return { from: "bot", text: lines.join("\n"), actions: [...go("Ir a Recibos", "/app/recibos"), ...empAcc, ...go("Configuración", "/app/configuracion")] };
  }

  async function qAguinaldo(): Promise<Msg> {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const y = hoy.getFullYear();
    const jun = new Date(y, 5, 30), dic = new Date(y, 11, 18);
    const sem = hoy <= jun ? 1 : hoy <= dic ? 2 : 1;
    const anio = hoy > dic ? y + 1 : y;
    const limite = sem === 1 ? new Date(anio, 5, 30) : new Date(anio, 11, 18);
    const dias = Math.round((limite.getTime() - hoy.getTime()) / 86400000);
    let text = `El próximo aguinaldo es el del ${sem === 1 ? "1º" : "2º"} semestre ${anio}: vence el ${limite.toLocaleDateString("es-AR")} (${dias === 0 ? "hoy" : `en ${dias} días`}), con unos días hábiles de tolerancia.`;
    if (can("aguinaldo_vacaciones") && seeMoney) {
      try {
        const p = await appApi<{ total_sac: number; empleados: unknown[]; periodo: { estado: string } | null; faltan_parametros: string[]; fechas: { fecha_con_tolerancia: string } }>(`/sac/${sem}/previa?anio=${anio}`);
        text += `\nProyección con lo ya liquidado: ${money(p.total_sac)} para ${p.empleados.length} empleado${p.empleados.length === 1 ? "" : "s"}.` +
          ` Tope con tolerancia: ${shortDate(p.fechas.fecha_con_tolerancia)}.` +
          (p.periodo ? ` El período está ${p.periodo.estado}.` : " Todavía no lo liquidaste.") +
          (p.faltan_parametros.length ? " Faltan parámetros legales para calcular los aportes." : "");
      } catch { /* sin proyección */ }
    } else if (!can("aguinaldo_vacaciones")) {
      text += "\n(Tu usuario o plan no incluye la pantalla de Aguinaldo.)";
    }
    return { from: "bot", text: text + "\n" + VALIDAR, actions: go("Ir a Aguinaldo", "/app/aguinaldo-vacaciones") };
  }

  async function qVencimientos(): Promise<Msg> {
    type V = { tipo: string; etiqueta: string; periodo: string | null; vence: string; dias: number; estado: string; vencido: boolean };
    let items: (V & { empresa?: string })[] = [];
    let nota = "";
    let acc: Action[] = [];
    if (can("arca_exportacion")) {
      const r = await appApi<{ items: V[]; falta_tabla_f931: boolean }>("/arca/vencimientos");
      items = r.items;
      if (r.falta_tabla_f931) nota = "\nOjo: falta cargar la tabla de vencimientos del F.931, así que esos no figuran.";
      acc = go("Ver vencimientos", "/app/arca");
    } else if (can("multiempresa")) {
      const r = await appApi<{ items: (V & { empresa: string })[] }>("/estudio/vencimientos");
      items = r.items;
      acc = go("Ver vencimientos", "/app/multiempresa");
    } else {
      return { from: "bot", text: "Tu usuario o plan no incluye el calendario de vencimientos (viene con Exportación a ARCA). Las fechas del F.931 y las cargas sociales consultalas con tu contador." };
    }
    const prox = items.filter((v) => v.estado === "pendiente" && v.dias >= -10 && v.dias <= 45).sort((a, b) => a.vence.localeCompare(b.vence));
    if (!prox.length) return { from: "bot", text: "No hay vencimientos pendientes en los próximos 45 días." + nota, actions: acc };
    return {
      from: "bot",
      text: "Próximos vencimientos:\n" + lista(prox.map((v) =>
        `${v.empresa ? v.empresa + " · " : ""}${v.etiqueta}${v.periodo ? " " + (/^\d{4}-\d{2}$/.test(v.periodo) ? periodLabel(v.periodo) : v.periodo) : ""}: ${shortDate(v.vence)} ${v.vencido ? "(vencido)" : v.dias === 0 ? "(hoy)" : `(en ${v.dias} día${v.dias === 1 ? "" : "s"})`}`), 7) + nota + "\n" + VALIDAR,
      actions: acc,
    };
  }

  async function qPendientes(): Promise<Msg> {
    const r = await appApi<{ items: { label: string; count: number; hint: string; path: string; tone: string }[] }>("/dashboard/pending");
    const items = r.items.filter((i) => canGo(i.path));
    if (!items.length) return { from: "bot", text: "Todo al día: no tenés pendientes." };
    return {
      from: "bot",
      text: "Esto es lo que tenés pendiente:\n" + lista(items.map((i) => `${i.label}${i.count > 1 ? ` (${i.count})` : ""}${i.hint ? ` — ${i.hint}` : ""}`), 6),
      actions: items.slice(0, 3).map((i) => ({ label: i.label.length > 28 ? i.label.slice(0, 26) + "…" : i.label, to: i.path.split("?")[0] })),
    };
  }

  async function qResumen(): Promise<Msg> {
    const d = await appApi<{ employer: { razon_social: string }; employees_active: number; params: { vencido: number; por_vencer: number }; open_period: { anio: number; mes: number; estado: string } | null; next_due: { tipo: string; vence: string; dias: number } | null }>("/dashboard");
    const lines = [`${d.employer.razon_social}: ${d.employees_active} empleado${d.employees_active === 1 ? "" : "s"} activo${d.employees_active === 1 ? "" : "s"}.`];
    lines.push(d.open_period ? `Período abierto: ${periodLabel(`${d.open_period.anio}-${String(d.open_period.mes).padStart(2, "0")}`)} (${d.open_period.estado}).` : "No hay períodos abiertos.");
    if (d.next_due) lines.push(`Próximo vencimiento: ${d.next_due.tipo} el ${shortDate(d.next_due.vence)} (en ${d.next_due.dias} días).`);
    if (d.params.vencido || d.params.por_vencer) lines.push(`Parámetros legales: ${d.params.vencido} vencido${d.params.vencido === 1 ? "" : "s"}, ${d.params.por_vencer} por vencer.`);
    return { from: "bot", text: lines.join("\n"), actions: go("Ir al Inicio", "/app") };
  }

  async function qEstudio(): Promise<Msg> {
    if (!esEstudio || !can("multiempresa")) return { from: "bot", text: "La gestión de varias empresas es solo para estudios contables. Tu cuenta trabaja con una sola empresa empleadora." };
    const r = await appApi<{ empresas: { razon_social: string; total_alertas: number }[]; total_alertas: number; con_periodo_abierto: number }>("/estudio/tablero");
    const top = r.empresas.filter((e) => e.total_alertas > 0).slice(0, 4).map((e) => `${e.razon_social} (${e.total_alertas})`);
    return {
      from: "bot",
      text: `El estudio tiene ${r.empresas.length} empresa${r.empresas.length === 1 ? "" : "s"}, ${r.con_periodo_abierto} con período abierto y ${r.total_alertas} alerta${r.total_alertas === 1 ? "" : "s"} en total.` + (top.length ? `\nCon más alertas: ${top.join(", ")}.` : ""),
      actions: go("Ver el tablero", "/app/multiempresa"),
    };
  }

  // ---------- respuesta ----------
  async function answer(raw: string): Promise<Msg> {
    const t = norm(raw);

    if (/^(hola|buenas|buen dia|buenas tardes|buenas noches|hey|ey|que tal)\b/.test(t) && t.length < 24) {
      return { from: "bot", text: "¡Hola! ¿En qué te ayudo? Podés tocar una de las sugerencias de abajo o escribirme tu consulta." };
    }
    if (has(t, "gracias", "genial", "joya", "perfecto", "excelente", "barbaro", "buenisimo")) {
      return { from: "bot", text: "¡De nada! Cualquier cosa, acá estoy." };
    }
    if (/^(chau|adios|hasta luego|nos vemos)\b/.test(t)) return { from: "bot", text: "¡Hasta luego!" };

    const isHow = has(t, "como", "donde", "que hago", "ayuda", "se puede", "necesito", "quiero", "puedo", "explica", "pasos", "liquidar", "cargar", "carga", "calcular", "crear", "anular", "agregar", "hago", "hacer", "configurar");

    // qué falta para emitir (estado real); «cómo emito» es ayuda
    if (!has(t, "como") && /(sin emitir|falta(n)? (para )?emitir|para emitir|por que no.*(emit|recibo)|no (puedo|me deja|sale).*(emit|recibo)|recibos? pendientes?|pendientes? de emitir|recibos? (que )?faltan|no se emite)/.test(t)) return qEmision();

    // sueldos / montos sin permiso
    if (!seeMoney && has(t, "cuanto pago", "costo laboral", "neto total", "total de sueldos", "masa salarial", "cuanto cobra")) return noMoney;

    if (isHow) {
      const h = bestHelp(t);
      if (h) return helpReply(h);
    }

    // ---- datos ----
    if (has(t, "incompleto", "incompletos", "datos faltantes", "que falta cargar")) return qIncompletos();
    if (has(t, "cuantos empleados", "cuantas personas", "dotacion", "plantel", "cantidad de empleados", "empleados activos", "cuanta gente", "cuantos legajos") || (has(t, "empleados", "legajos", "personal") && has(t, "cuantos", "cuantas", "hay", "tengo", "tenemos"))) return qEmpleados();
    if (has(t, "estudio", "empresas del estudio", "tablero", "mis empresas", "multiempresa", "clientes del estudio")) return qEstudio();
    if (has(t, "aguinaldo", "sac", "medio aguinaldo")) return qAguinaldo();
    if (has(t, "vencimiento", "vencimientos", "vence", "cargas sociales", "f931", "931", "proximos pagos", "cuando vence")) return qVencimientos();
    if (has(t, "pendiente", "pendientes", "que tengo que hacer", "que me falta", "alertas", "tareas", "que falta")) return qPendientes();
    if (!has(t, "final", "egreso", "despido", "indemnizacion", "renuncia") &&
      has(t, "liquidacion", "periodo", "sueldos del mes", "cuanto pago", "costo laboral", "neto", "bruto", "liquidacion del mes", "estado del mes", "este mes", "mes actual", "del mes", "cerrado", "cerrada")) return qLiquidacion();
    if (has(t, "resumen", "como estamos", "estado general", "inicio")) return qResumen();

    // ---- ayuda sin «cómo» ----
    const h = bestHelp(t);
    if (h) return helpReply(h);

    return {
      from: "bot",
      text: "No te entendí del todo. Probá con algo como «¿qué falta para emitir los recibos?», «liquidación del mes», «¿cuántos empleados hay?», «próximos vencimientos», «¿cuándo es el aguinaldo?» o «¿cómo cargo horas extra?».",
    };
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || typing) return;
    setMsgs((m) => [...m, { from: "user", text: q }]);
    setInput("");
    setTyping(true);
    try {
      const [reply] = await Promise.all([answer(q), new Promise((r) => setTimeout(r, 400))]);
      setMsgs((m) => [...m, reply as Msg]);
    } catch (e) {
      setMsgs((m) => [...m, { from: "bot", text: e instanceof Error ? `Uy, no pude consultar eso: ${e.message}` : "Uy, algo falló. Probá de nuevo." }]);
    } finally {
      setTyping(false);
    }
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void send(input);
  }

  function doAction(a: Action) {
    if (a.run) a.run();
    else if (a.to) navigate(a.to);
    if (window.innerWidth <= 860) setOpen(false);   // en el celular, que se vea la pantalla
  }

  // sugerencias según módulos y rol
  const suggestions = [
    "¿Qué tengo pendiente?",
    can("legajos") && "¿Cuántos empleados hay?",
    can("liquidaciones") && "Liquidación del mes",
    can("recibos") && seeMoney && "¿Qué falta para emitir recibos?",
    can("aguinaldo_vacaciones") && "¿Cuándo es el aguinaldo?",
    (can("arca_exportacion") || can("multiempresa")) && "Próximos vencimientos",
    can("liquidaciones") && "¿Cómo liquido un mes?",
    can("novedades") && "¿Cómo cargo horas extra?",
    "¿Cómo se paga el sueldo?",
    esEstudio && can("multiempresa") && "Empresas del estudio",
  ].filter(Boolean) as string[];

  if (!user) return null;

  return (
    <>
      {!open && (
        <button type="button" className={`nm-assist-fab ${tuck ? "is-tucked" : ""}`} onClick={() => setOpen(true)} aria-label="Abrir el asistente">
          <svg className="nm-assist-fab-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H11l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z" />
            <path d="M8.5 10.5h7M8.5 13.5h4" />
          </svg>
          <span className="nm-assist-fab-text">Asistente</span>
        </button>
      )}
      {open && (
        <div className="nm-assist" role="dialog" aria-label="Asistente de Nominal">
          <div className="nm-assist-head">
            <NominalLogo size={34} />
            <div>
              <strong>Asistente Nominal</strong>
              <small>Liquidación, recibos y vencimientos</small>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar el asistente">×</button>
          </div>
          <div className="nm-assist-body" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={`nm-assist-msg ${m.from}`}>
                <p>{m.text}</p>
                {m.actions && m.actions.length > 0 && (
                  <div className="nm-assist-actions">
                    {m.actions.map((a) => (
                      <button type="button" key={(a.to || "run") + a.label} onClick={() => doAction(a)}>{a.label} ›</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {typing && <div className="nm-assist-msg bot"><p className="nm-assist-typing" aria-label="Escribiendo"><span /><span /><span /></p></div>}
            <div ref={endRef} />
          </div>
          <div className="nm-assist-suggest">
            {suggestions.map((s) => (
              <button type="button" key={s} onClick={() => void send(s)} disabled={typing}>{s}</button>
            ))}
          </div>
          <form className="nm-assist-input" onSubmit={submit}>
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escribí tu consulta…" aria-label="Tu consulta" autoComplete="off" />
            <button type="submit" disabled={!input.trim() || typing} aria-label="Enviar">➤</button>
          </form>
        </div>
      )}
    </>
  );
}

export default AsistenteNominal;
