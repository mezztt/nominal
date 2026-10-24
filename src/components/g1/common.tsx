import { useState } from "react";
import type { ReactNode } from "react";
import { appApi } from "../../config";
import { Modal } from "../ui";
import "../../g1.css";
import "../../g2.css";

/** Lee un archivo y lo devuelve en base64 (sin el prefijo data:) */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => resolve(String(rd.result).split(",", 2)[1] || "");
    rd.onerror = () => reject(new Error("No se pudo leer el archivo"));
    rd.readAsDataURL(file);
  });
}

export function fileToText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => resolve(String(rd.result));
    rd.onerror = () => reject(new Error("No se pudo leer el archivo"));
    rd.readAsText(file, "utf-8");
  });
}

export const MAX_ARCHIVO = 1_500_000;

export function MesNav({ anio, mes, onChange }: { anio: number; mes: number; onChange: (anio: number, mes: number) => void }) {
  const nombres = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const mover = (n: number) => {
    const d = new Date(anio, mes - 1 + n, 1);
    onChange(d.getFullYear(), d.getMonth() + 1);
  };
  return (
    <div className="nm1-month">
      <button type="button" className="nm2-btn is-small" onClick={() => mover(-1)} aria-label="Mes anterior">‹</button>
      <strong>{nombres[mes - 1]} {anio}</strong>
      <button type="button" className="nm2-btn is-small" onClick={() => mover(1)} aria-label="Mes siguiente">›</button>
    </div>
  );
}

interface ImportResult {
  simulacion: boolean; filas: number; validas: number; creados?: number; cargados?: number;
  errores: { fila: number; mensaje: string }[]; avisos: (string | { fila: number; mensaje: string })[]; columnas_ignoradas: string[];
}

/** Importación por CSV en dos pasos: primero se revisa (simulación) y recién después se guarda. */
export function ImportCsv({ title, endpoint, ayuda, ejemplo, onClose, onDone }: {
  title: string; endpoint: string; ayuda: ReactNode; ejemplo: string; onClose: () => void; onDone: (mensaje: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const [res, setRes] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const correr = async (simular: boolean) => {
    if (!texto.trim()) { setError("Pegá el contenido o elegí un archivo CSV."); return; }
    setBusy(true); setError("");
    try {
      const r = await appApi<ImportResult>(endpoint, { method: "POST", body: { csv: texto, simular } });
      setRes(r);
      if (!simular) onDone(`Importación lista: ${r.creados ?? r.cargados ?? 0} registros guardados.`);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo importar"); }
    setBusy(false);
  };
  const elegir = async (f: File | undefined) => {
    if (!f) return;
    try { setTexto(await fileToText(f)); setRes(null); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo leer"); }
  };
  const guardado = !!res && !res.simulacion;

  return (
    <Modal title={title} eyebrow="IMPORTAR CSV" size="wide" onClose={onClose}
      footer={<>
        <button className="nm2-btn" onClick={onClose}>{guardado ? "Cerrar" : "Cancelar"}</button>
        {!guardado && <button className="nm2-btn" disabled={busy} onClick={() => void correr(true)}>Revisar</button>}
        {!guardado && <button className="nm2-btn is-primary" disabled={busy || !res || res.validas === 0 || res.errores.length > 0} onClick={() => void correr(false)}>Importar</button>}
      </>}>
      <div className="nm-stack">
        <p className="nm1-sub" style={{ margin: 0 }}>{ayuda}</p>
        <p className="nm1-sub" style={{ margin: 0 }}>Primera fila con los títulos. Separador coma, punto y coma o tabulación. Ejemplo:</p>
        <pre className="nm1-code" style={{ minHeight: 0 }} aria-label="Ejemplo de archivo">{ejemplo}</pre>
        <label className="nm2-label">Archivo CSV<input className="nm1-file" type="file" accept=".csv,.txt,text/csv" onChange={(e) => void elegir(e.target.files?.[0])} /></label>
        <label className="nm2-label">O pegá el contenido acá
          <textarea className="nm1-code" value={texto} onChange={(e) => { setTexto(e.target.value); setRes(null); }} spellCheck={false} />
        </label>
        {error && <p className="nm-note nm-note-error">{error}</p>}
        {res && (
          <div className="nm1-result" role="status">
            <p className={`nm-note ${res.errores.length ? "nm-note-warn" : "nm-note-info"}`}>
              {res.filas} fila(s) leída(s): <strong>{res.validas} válida(s)</strong>
              {res.errores.length > 0 && <>, <strong>{res.errores.length} con error</strong> (corregí el archivo y volvé a revisar; no se importa nada hasta que no haya errores)</>}
              {guardado && <>. Se guardaron <strong>{res.creados ?? res.cargados ?? 0}</strong>.</>}
            </p>
            {res.columnas_ignoradas.length > 0 && <p className="nm-muted">Columnas que no usamos: {res.columnas_ignoradas.join(", ")}.</p>}
            {res.errores.length > 0 && <ul className="nm1-errlist">{res.errores.slice(0, 50).map((e, i) => <li key={i}>{e.fila ? `Fila ${e.fila}: ` : ""}{e.mensaje}</li>)}</ul>}
            {res.avisos.length > 0 && <ul className="nm1-warnlist">{res.avisos.slice(0, 30).map((a, i) => <li key={i}>{typeof a === "string" ? a : `Fila ${a.fila}: ${a.mensaje}`}</li>)}</ul>}
          </div>
        )}
      </div>
    </Modal>
  );
}

/** "12,5" -> 12.5 ; "" -> null */
export function num(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : null;
}

/** Número del backend a texto editable con coma */
export function numText(v: number | string | null | undefined): string {
  return v === null || v === undefined ? "" : String(v).replace(".", ",");
}

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
