import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { APP_BRAND, APP_NAME, dateTime, publicApi } from "../../config";
import { InstagramLink, MezzttLink, NominalLogo, PoweredBy, useBrandLinks, useLightPage } from "../../components/Brand";

/**
 * Textos legales públicos (sin login): /legal/terminos, /legal/privacidad y /legal/baja (Disposición 954/2025).
 * Son textos generales del servicio; no reemplazan el asesoramiento de un profesional (ver LEGAL.md).
 */
const UPDATED = "octubre de 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="lg-section"><h2>{title}</h2>{children}</section>;
}

function Contact() {
  const links = useBrandLinks();
  return (
    <p className="lg-contact">
      Escribinos por el Instagram de <MezzttLink />
      <InstagramLink href={links.mezztt_instagram_url} label={`Instagram de ${APP_BRAND}`} />
    </p>
  );
}

function Terminos() {
  return (
    <>
      <p className="lg-lead">
        Estas son las condiciones para usar {APP_NAME}. Están escritas en lenguaje simple. Si usás el sistema, entendemos que las aceptás.
      </p>
      <Section title="1. Qué es Nominal">
        <p>{APP_NAME} es un sistema para liquidar sueldos y emitir recibos de haberes de empresas y estudios contables de Argentina: legajos, convenios, novedades, liquidaciones, recibos, aguinaldo y vacaciones, liquidación final, Ganancias de 4ª categoría, descuentos y embargos, y planillas de apoyo para ARCA, según los módulos que cada cliente contrate.</p>
      </Section>
      <Section title="2. Quién presta el servicio">
        <p>El servicio lo presta {APP_BRAND}, que desarrolla y mantiene el sistema. El cliente es la empresa o el estudio que lo contrata, y es quien decide qué personas tienen usuario y qué puede hacer cada una.</p>
      </Section>
      <Section title="3. Qué es Nominal y qué no es">
        <ul>
          <li>{APP_NAME} es una <b>herramienta de cálculo y registro</b>. No presenta declaraciones juradas, no transmite el libro de sueldos digital ni la declaración F.931 ante ARCA, y no reemplaza al contador ni al asesor laboral.</li>
          <li>Los parámetros legales (topes, escalas, alícuotas, convenios) los publica {APP_BRAND} con su fuente y fecha de vigencia. Cada empresa debe revisarlos y confirmarlos antes de cerrar un período. La responsabilidad por el cálculo final y por su presentación es del cliente y de su profesional.</li>
          <li>La plantilla del recibo sigue el Decreto 407/2026 (Anexo III) y está marcada como pendiente de contraste con el PDF oficial hasta que se confirme.</li>
        </ul>
      </Section>
      <Section title="4. Cuenta y contraseñas">
        <ul>
          <li>Cada usuario es personal. No compartas tu contraseña.</li>
          <li>El cliente es responsable de lo que se hace con los usuarios que crea y de darlos de baja cuando alguien deja de trabajar con él.</li>
          <li>Si creés que alguien entró con tu usuario, cambiá la contraseña y avisanos.</li>
        </ul>
      </Section>
      <Section title="5. Datos personales y sensibles">
        <p>El sistema guarda datos de empleados (CBU, familia, certificados médicos). El cliente es el responsable de esos datos y {APP_BRAND} los guarda por su cuenta. Los datos de salud y el CBU se almacenan cifrados y su lectura queda registrada. Más detalle en la <Link to="/legal/privacidad">Política de privacidad</Link>.</p>
      </Section>
      <Section title="6. Abono, baja y arrepentimiento">
        <ul>
          <li>El servicio tiene un pago inicial y un abono mensual según los módulos contratados, acordados con {APP_BRAND} antes de empezar. Los módulos que dependen de otros incluyen lo necesario para funcionar, y eso se informa en la cotización.</li>
          <li>Podés pedir la baja o ejercer el arrepentimiento cuando quieras, con el botón «Dar de baja el servicio» (Configuración → Mi plan y el menú; si no podés ingresar, también desde <Link to="/legal/baja">Baja y arrepentimiento</Link>), sin motivo ni trámites previos y con constancia inmediata. El sistema sigue funcionando hasta el final del período ya pagado, de acuerdo con la Disposición 954/2025 de la Subsecretaría de Defensa del Consumidor y Lealtad Comercial (Ministerio de Economía).</li>
          <li>Si el abono queda impago, el acceso puede suspenderse después de avisarte. Los datos no se borran por eso.</li>
        </ul>
      </Section>
      <Section title="7. Tus datos son tuyos">
        <p>Podés pedirnos una copia de tus datos en cualquier momento, también al darte de baja. Los recibos y registros laborales tienen plazos de conservación legales que el cliente debe respetar.</p>
      </Section>
      <Section title="8. Disponibilidad">
        <p>Trabajamos para que el sistema esté disponible todo el tiempo y hacemos copias de seguridad, pero no podemos garantizar que nunca haya cortes. Conviene no dejar la liquidación para el último día del vencimiento.</p>
      </Section>
      <Section title="9. Responsabilidad">
        <p>{APP_BRAND} responde por el funcionamiento del sistema dentro de lo razonable. No responde por datos mal cargados, por parámetros que el cliente confirmó sin revisar, ni por multas o diferencias que surjan de una liquidación presentada sin control profesional.</p>
      </Section>
      <Section title="10. Cambios y ley aplicable">
        <p>Podemos mejorar el sistema y actualizar estas condiciones; si el cambio es importante, te avisamos antes. Se rigen por las leyes de la República Argentina.</p>
      </Section>
      <Section title="11. Contacto"><Contact /></Section>
    </>
  );
}

function Privacidad() {
  return (
    <>
      <p className="lg-lead">
        Acá te contamos qué datos personales se guardan en {APP_NAME}, para qué se usan y qué derechos tenés, según la Ley 25.326 de Protección de Datos Personales.
      </p>
      <Section title="1. Quién es responsable de los datos">
        <ul>
          <li>La <b>empresa o estudio</b> que usa {APP_NAME} es el responsable de su base de datos: decide qué datos carga y para qué.</li>
          <li><b>{APP_BRAND}</b> presta el software y guarda esos datos por cuenta del cliente. No los usa para otra cosa.</li>
        </ul>
      </Section>
      <Section title="2. Qué datos se guardan y para qué">
        <ul>
          <li><b>Empleados:</b> nombre, CUIL, domicilio, fecha de ingreso, categoría, sueldo, grupo familiar y CBU. Sirven para liquidar y emitir el recibo.</li>
          <li><b>Usuarios del sistema:</b> nombre, email y rol.</li>
          <li><b>Uso del sistema:</b> se registra quién cierra liquidaciones, cambia parámetros o lee datos de salud, CBU y sueldos completos.</li>
        </ul>
      </Section>
      <Section title="3. Datos de salud">
        <p>Los certificados médicos y diagnósticos son datos sensibles (Ley 25.326): se guardan cifrados, solo los ven los roles con permiso y cada lectura queda registrada. No se usan para ningún otro fin.</p>
      </Section>
      <Section title="4. Verificación del recibo">
        <p>El código QR del recibo permite comprobar que existe y no fue modificado. La página de verificación <b>no muestra datos personales</b> del trabajador.</p>
      </Section>
      <Section title="5. No se venden ni se ceden">
        <p>Los datos no se venden ni se entregan a terceros para publicidad. Solo se comparten cuando lo exige la ley o una orden judicial, o con los proveedores técnicos necesarios para que el sistema funcione (alojamiento), obligados a la confidencialidad.</p>
      </Section>
      <Section title="6. Tus derechos">
        <p>Podés pedir <b>acceso</b> a tus datos, que se <b>rectifiquen</b> o <b>actualicen</b> si están mal, y que se <b>supriman</b> cuando corresponda. El pedido se hace ante tu empleador, que es el responsable de la base. Si no sabés a quién dirigirte, escribinos y te orientamos.</p>
      </Section>
      <Section title="7. Seguridad">
        <p>Las contraseñas se guardan cifradas, la conexión es segura (https), cada cliente ve solo sus propios datos, las acciones sensibles quedan registradas y se hacen copias de seguridad. Ningún sistema es infalible: si detectamos un problema que afecte tus datos, se lo avisamos al responsable.</p>
      </Section>
      <Section title="8. Cookies y seguimiento">
        <p>{APP_NAME} no usa cookies de publicidad ni rastreadores de terceros. Solo guarda en tu navegador lo necesario para mantener tu sesión y tu preferencia de modo claro u oscuro.</p>
      </Section>
      <Section title="9. Órgano de control">
        <p className="lg-quote">La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.</p>
      </Section>
      <Section title="10. Contacto"><Contact /></Section>
    </>
  );
}

function Baja() {
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState("BAJA");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ code: string; created_at: string; kind: string } | null>(null);
  async function send() {
    setBusy(true); setError("");
    try {
      setDone(await publicApi("/public/cancellation-request", { method: "POST", body: { email, kind, reason: reason.trim() || null } }));
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo registrar el pedido"); } finally { setBusy(false); }
  }
  return (
    <>
      <p className="lg-lead">
        Podés dar de baja el servicio o arrepentirte de la contratación cuando quieras, de forma simple y sin trabas, según la Disposición 954/2025 de la Subsecretaría de Defensa del Consumidor y Lealtad Comercial (Ministerio de Economía). El pedido queda registrado con fecha, hora y un código de constancia.
      </p>
      <Section title="Cómo funciona">
        <ul>
          <li><b>Baja:</b> el administrador la pide con el botón «Dar de baja el servicio» (Configuración → Mi plan y menú), la confirma en dos pasos y recibe al instante la constancia <b>BAJA-SRV-AAAA-NNNN</b>. El sistema sigue funcionando hasta el final del período ya pagado; no se hacen cobros nuevos, tus datos se conservan y podés retirar la baja antes de esa fecha. Si no podés ingresar, pedila acá. Antes de la baja podés pedir una copia de tus datos.</li>
          <li><b>Arrepentimiento:</b> dentro de los plazos legales de la contratación a distancia.</li>
          <li>Te respondemos dentro de las 24 horas, con el mismo código.</li>
        </ul>
      </Section>
      <Section title="Pedirlo ahora">
        {done ? (
          <div className="nm-note">Recibimos tu pedido. Guardá este código de constancia: <b>{done.code}</b> ({dateTime(done.created_at)}).</div>
        ) : (
          <div className="lg-form">
            <label>Email del administrador<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" /></label>
            <label>Tipo de pedido
              <select value={kind} onChange={(e) => setKind(e.target.value)}><option value="BAJA">Baja del servicio</option><option value="ARREPENTIMIENTO">Arrepentimiento</option></select>
            </label>
            <label>Motivo (opcional)<textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
            {error && <div className="pb-error" role="alert">{error}</div>}
            <button type="button" className="nm-danger-button" disabled={busy || !email.trim()} onClick={send}>{busy ? "Enviando..." : "Enviar el pedido"}</button>
          </div>
        )}
      </Section>
      <Section title="Contacto"><Contact /></Section>
    </>
  );
}

const DOCS = {
  terminos: { title: "Términos y condiciones", other: "privacidad", otherLabel: "Política de privacidad", Body: Terminos },
  privacidad: { title: "Política de privacidad", other: "terminos", otherLabel: "Términos y condiciones", Body: Privacidad },
  baja: { title: "Baja y arrepentimiento", other: "terminos", otherLabel: "Términos y condiciones", Body: Baja },
} as const;

function Legal({ doc }: { doc: keyof typeof DOCS }) {
  useLightPage();
  const d = DOCS[doc];
  useEffect(() => { document.title = `${d.title} · ${APP_NAME}`; window.scrollTo(0, 0); }, [d.title]);
  return (
    <div className="pb-page lg-page">
      <header className="lg-top">
        <div className="lg-wrap lg-top-row">
          <span className="lg-brand"><NominalLogo size={34} /><strong>{APP_NAME}</strong></span>
          <button type="button" className="lg-back" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}>‹ Volver</button>
        </div>
      </header>
      <main className="lg-wrap">
        <article className="pb-card lg-card">
          <span className="pb-step-label">Legales</span>
          <h1>{d.title}</h1>
          <p className="lg-updated">Última actualización: {UPDATED}</p>
          <d.Body />
          <p className="lg-also">Leé también: <Link to={`/legal/${d.other}`}>{d.otherLabel}</Link></p>
        </article>
      </main>
      <footer className="pb-foot"><PoweredBy /></footer>
    </div>
  );
}

export default Legal;
