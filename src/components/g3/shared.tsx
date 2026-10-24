import { useEffect, useState } from "react";
import { appApi } from "../../config";
import MesAnio from "../MesAnio";

export interface EmpleadoItem { id: number; legajo: string; nombre: string }

/** Lista de empleados activos para elegir (cada módulo trae la suya desde su propio router). */
export function useEmpleados(path: string): EmpleadoItem[] {
  const [rows, setRows] = useState<EmpleadoItem[]>([]);
  useEffect(() => { appApi<EmpleadoItem[]>(path).then(setRows).catch(() => setRows([])); }, [path]);
  return rows;
}

export function EmpleadoSelect({ rows, value, onChange, label = "Empleado" }: { rows: EmpleadoItem[]; value: number | null; onChange: (id: number | null) => void; label?: string }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
        <option value="">Elegí un empleado</option>
        {rows.map((r) => <option key={r.id} value={r.id}>{r.legajo ? `${r.legajo} · ` : ""}{r.nombre}</option>)}
      </select>
    </div>
  );
}

/** Mes y año (AAAA-MM) */
export function MonthInput({ value, onChange, label = "Período" }: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <MesAnio value={value} onChange={onChange} />
    </div>
  );
}

/** Importe con signo y color: negativo en rojo oscuro (texto además del color: lleva el signo menos) */
export function Amount({ value, bold }: { value: number | null | undefined; bold?: boolean }) {
  if (value === null || value === undefined) return <span className="nm-muted">—</span>;
  const txt = "$" + Math.abs(value).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <span className={value < 0 ? "g3-neg" : bold ? "g3-pos" : undefined}>{value < 0 ? "-" : ""}{txt}</span>;
}

/** Paso a paso del cálculo («¿Cómo se calculó?») */
export function Steps({ rows }: { rows: { etiqueta: string; importe: number; total?: boolean }[] }) {
  return (
    <ul className="g3-steps">
      {rows.map((r, i) => <li key={i} className={r.total ? "is-total" : ""}><span>{r.etiqueta}</span><Amount value={r.importe} /></li>)}
    </ul>
  );
}

export function Notes({ items, tone = "warn" }: { items: string[]; tone?: "warn" | "info" | "error" }) {
  if (!items.length) return null;
  return <div style={{ display: "grid", gap: 8, margin: "0 0 14px" }}>{items.map((t, i) => <div key={i} className={`nm-note nm-note-${tone}`}>{t}</div>)}</div>;
}
