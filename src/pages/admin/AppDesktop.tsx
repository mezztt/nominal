import { useCallback, useEffect, useState } from "react";
import { adminApi, adminDownloadPost, dateTime } from "../../config";
import { Pill } from "../../components/ui";

/**
 * «App de escritorio» de un cliente (panel de Mezztt → Sistemas → cliente → pestaña App).
 * Genera instaladores de UN SOLO USO (código NOM-XXXX-XXXX-XXXX) y muestra el estado de cada instalación. Ver backend/app_instalable.py.
 */
interface Install {
  id: number; mode: "MENSUAL" | "UNICO"; status: string; label: string | null; code_hint: string | null; downloads: number;
  code_expires_at: string | null; created_at: string | null; activated_at: string | null; last_seen_at: string | null; ended_at: string | null; app_version: string | null;
}
interface AppState { installs: Install[]; available: Record<string, boolean>; files: Record<string, string>; code_ttl_days: number; max_downloads: number; stopped: string | null }
interface Generated { id: number; code: string; uninstall_key: string; mode: string; filename: string; download_path: string; expires_at: string }
interface SystemUser { id: number; name: string; email: string; role: string; active: boolean }

const MODE_LABEL: Record<string, string> = { MENSUAL: "Mensual · conectada (misma información que la web)", UNICO: "Pago único · local (corre en la PC del cliente)" };
const STATUS: Record<string, [string, string]> = {
  PENDIENTE: ["Sin instalar", "orange"], ACTIVA: ["Instalada", "green"], DESINSTALADA: ["Desinstalada", "gray"], REVOCADA: ["Cerrada", "gray"], VENCIDA: ["Código vencido", "gray"],
};

export default function AppDesktop({ companyId, users, show, fail }: { companyId: number; users: SystemUser[]; show: (t: string) => void; fail: (e: unknown) => void }) {
  const [state, setState] = useState<AppState | null>(null);
  const [mode, setMode] = useState<"MENSUAL" | "UNICO">("MENSUAL");
  const [label, setLabel] = useState("");
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<Generated | null>(null);

  const load = useCallback(async () => {
    try { setState(await adminApi<AppState>(`/admin/systems/${companyId}/app`)); } catch (e) { fail(e); }
  }, [companyId, fail]);
  useEffect(() => { load(); }, [load]);

  async function generate() {
    setBusy(true);
    try {
      const g = await adminApi<Generated>(`/admin/systems/${companyId}/app/instalador`, { method: "POST", body: { mode, label: label.trim() || null, login_user_id: mode === "MENSUAL" && userId ? Number(userId) : null } });
      setMade(g);
      setLabel("");
      await adminDownloadPost(g.download_path, { code: g.code }, g.filename);
      show("Instalador generado y descargado");
      await load();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  async function redownload() {
    if (!made) return;
    try { await adminDownloadPost(made.download_path, { code: made.code }, made.filename); await load(); } catch (e) { fail(e); }
  }

  async function close(i: Install) {
    const msg = i.status === "PENDIENTE" ? "El código de este instalador va a dejar de servir." : "La app de esa PC va a dejar de abrir (muestra «Sistema detenido»). Para volver a darle acceso hay que generar otro instalador.";
    if (!window.confirm(msg + " ¿Seguro?")) return;
    try { await adminApi(`/admin/app/installs/${i.id}/cerrar`, { method: "POST" }); show("Listo"); await load(); } catch (e) { fail(e); }
  }

  async function newKey(i: Install) {
    if (!window.confirm("Se genera una clave de desinstalación nueva y la anterior deja de servir. ¿Seguro?")) return;
    try {
      const r = await adminApi<{ uninstall_key: string }>(`/admin/app/installs/${i.id}/nueva-clave`, { method: "POST" });
      window.prompt("Clave de desinstalación nueva (copiala y anotala; no se vuelve a mostrar):", r.uninstall_key);
    } catch (e) { fail(e); }
  }

  async function rename(i: Install) {
    const v = window.prompt("Nombre para reconocer esta PC (por ejemplo «Recepción»)", i.label || "");
    if (v === null) return;
    try { await adminApi(`/admin/app/installs/${i.id}`, { method: "PUT", body: { label: v } }); await load(); } catch (e) { fail(e); }
  }

  if (!state) return <p className="nm-hint">Cargando…</p>;
  const missing = !state.available[mode];

  return (
    <div className="product-form">
      <div className="nm-note nm-note-info">
        Instalador de <strong>un solo uso</strong>: se instala en una sola PC, se borra solo al terminar y no se puede volver a usar. El código vence a los {state.code_ttl_days} días si no se instala.
      </div>
      {state.stopped && <div className="nm-note nm-note-warn">Este cliente está {state.stopped === "PAGO" ? "con el pago vencido: la web y las apps mensuales muestran «Sistema detenido por falta de pago»" : "dado de baja: la web y las apps no abren"}.</div>}

      <div className="form-group">
        <label>Modalidad</label>
        <select value={mode} onChange={(e) => setMode(e.target.value as "MENSUAL" | "UNICO")}>
          <option value="MENSUAL">{MODE_LABEL.MENSUAL}</option>
          <option value="UNICO">{MODE_LABEL.UNICO}</option>
        </select>
        <p className="nm-hint">
          {mode === "MENSUAL"
            ? "Usa tu servidor: la web y la app comparten los datos. Si el cliente no paga, la app y la web se detienen solas. Necesita internet."
            : "Los datos quedan solo en esa PC y no se conectan con la web. Licencia de por vida: nunca se corta. Funciona sin internet."}
        </p>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Nombre de la PC (opcional)</label><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Recepción, Contabilidad…" maxLength={80} /></div>
        {mode === "MENSUAL" && (
          <div className="form-group"><label>Entra con el usuario</label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Administrador principal</option>
              {users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select></div>
        )}
      </div>
      {missing && <div className="nm-note nm-note-warn">Todavía no está cargado el instalador base ({state.files[mode]}) en el servidor. Armalo con <code>desktop\CONSTRUIR APP.bat</code> y copialo a la carpeta <code>installers</code> del servidor.</div>}
      <button className="primary-button" type="button" disabled={busy || missing} onClick={generate} style={{ alignSelf: "flex-start" }}>
        {busy ? "Generando…" : "Descargar instalador (app de escritorio)"}
      </button>

      {made && (
        <div className="nm-note nm-note-info">
          <strong>Código de activación: {made.code}</strong><br />
          <strong>Clave para desinstalar: {made.uninstall_key}</strong><br />
          El código va en el nombre del archivo ({made.filename}); si lo renombran, el instalador lo pide a mano. La clave se la das al cliente: sin ella no puede desinstalar.
          Anotá las dos ahora: después no se vuelven a mostrar (la clave se puede cambiar por una nueva).
          <div style={{ marginTop: 8 }}><button className="secondary-button" type="button" onClick={redownload}>Descargar de nuevo</button></div>
        </div>
      )}

      <hr className="nm-hr" />
      <h3 style={{ margin: "0 0 8px" }}>Instalaciones</h3>
      {state.installs.length === 0 ? <p className="nm-hint">Todavía no se generó ningún instalador para este cliente.</p> : (
        <div className="nm-table-wrap">
          <table className="nm-table">
            <thead><tr><th>PC</th><th>Modalidad</th><th>Estado</th><th>Instalada</th><th>Última conexión</th><th /></tr></thead>
            <tbody>
              {state.installs.map((i) => {
                const [txt, tone] = STATUS[i.status] || [i.status, "gray"];
                const closable = i.status === "PENDIENTE" || (i.status === "ACTIVA" && i.mode === "MENSUAL");
                return (
                  <tr key={i.id}>
                    <td>{i.label || <span className="nm-hint">sin nombre</span>}<br /><span className="nm-hint">código …{i.code_hint}</span></td>
                    <td>{i.mode === "MENSUAL" ? "Mensual" : "Pago único"}</td>
                    <td><Pill tone={tone}>{txt}</Pill>{i.status === "PENDIENTE" && <><br /><span className="nm-hint">{i.downloads} descargas</span></>}</td>
                    <td>{i.activated_at ? dateTime(i.activated_at) : "—"}{i.app_version ? <><br /><span className="nm-hint">v{i.app_version}</span></> : null}</td>
                    <td>{i.last_seen_at ? dateTime(i.last_seen_at) : "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="secondary-button" type="button" onClick={() => rename(i)}>Nombre</button>{" "}
                      {(i.status === "ACTIVA" || i.status === "PENDIENTE") && <><button className="secondary-button" type="button" onClick={() => newKey(i)}>Clave nueva</button>{" "}</>}
                      {closable && <button className="nm-danger-button" type="button" onClick={() => close(i)}>{i.status === "PENDIENTE" ? "Anular" : "Cortar"}</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="nm-hint" style={{ marginTop: 10 }}>Las instalaciones de pago único no se pueden cortar a distancia: son locales y de por vida.</p>
    </div>
  );
}
