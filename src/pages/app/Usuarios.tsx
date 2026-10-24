import { useCallback, useEffect, useState } from "react";
import { appApi, getSessionUser, PERMS, PERM_LABELS, ROLES, ROLE_HINTS, ROLE_LABELS } from "../../config";
import type { EmployerItem } from "../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, useFlash } from "../../components/ui";

interface UserItem { id: number; name: string; email: string; role: string; active: boolean; extra_perms: string | null; employer_ids: number[] }

const ROLE_TONE: Record<string, string> = { ADMINISTRADOR: "violet", CONTADOR: "brand", RRHH: "blue", CONSULTA: "gray", ESTUDIO_ADMIN: "violet", ESTUDIO_USER: "green" };
const isStudio = (role: string) => role === "ESTUDIO_ADMIN" || role === "ESTUDIO_USER";

function Usuarios() {
  const me = getSessionUser();
  const { show, fail, node: flash } = useFlash();
  const [users, setUsers] = useState<UserItem[] | null>(null);
  const [employers, setEmployers] = useState<EmployerItem[]>([]);
  const [editing, setEditing] = useState<UserItem | "new" | null>(null);

  const load = useCallback(() => { appApi<UserItem[]>("/users").then(setUsers).catch(fail); }, [fail]);
  useEffect(() => {
    load();
    appApi<EmployerItem[]>("/config/employers").then(setEmployers).catch(() => {});
  }, [load]);

  return (
    <section className="products-page">
      <PageHeader eyebrow="USUARIOS" title="Usuarios" subtitle="Quién entra al sistema y qué puede hacer cada uno. Los empleados no son usuarios: entran por el portal.">
        <button className="primary-button" onClick={() => setEditing("new")}>+ Nuevo usuario</button>
      </PageHeader>
      <div className="nm-grid-3" style={{ marginBottom: 16 }}>
        {ROLES.map((r) => (
          <div key={r} className="nm-card" style={{ padding: 14 }}><strong>{ROLE_LABELS[r]}</strong><p className="nm-muted" style={{ margin: "4px 0 0" }}>{ROLE_HINTS[r]}</p></div>
        ))}
      </div>
      {!users ? <Loading /> : users.length === 0 ? <Empty title="Sin usuarios">Creá el primero con «Nuevo usuario».</Empty> : (
        <div className="nm-table-wrap">
          <table className="nm-table">
            <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Permisos extra</th><th>Estado</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="is-click" onClick={() => setEditing(u)}>
                  <td><strong>{u.name}</strong>{u.id === me?.id && <small>Vos</small>}</td>
                  <td>{u.email}</td>
                  <td><Pill tone={ROLE_TONE[u.role] || "gray"}>{ROLE_LABELS[u.role] || u.role}</Pill>{u.role === "ESTUDIO_USER" && <small>{u.employer_ids.length} empresa(s)</small>}</td>
                  <td>{u.extra_perms ? u.extra_perms.split(",").map((p) => PERM_LABELS[p] || p).join(", ") : <span className="nm-muted">Los del rol</span>}</td>
                  <td>{u.active ? <Pill tone="green">Activo</Pill> : <Pill tone="gray">Inactivo</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="nm-muted" style={{ marginTop: 12 }}>
        Ver datos de salud, ver el CBU completo y los sueldos queda registrado: cada lectura se audita.
      </p>
      {editing && <UserForm user={editing === "new" ? null : editing} employers={employers} isMe={editing !== "new" && editing.id === me?.id}
        onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); show("Usuario guardado"); }} />}
      {flash}
    </section>
  );
}

function UserForm({ user, employers, isMe, onClose, onSaved }: {
  user: UserItem | null; employers: EmployerItem[]; isMe: boolean; onClose: () => void; onSaved: () => void;
}) {
  const me = getSessionUser();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user?.role || "RRHH");
  const [perms, setPerms] = useState<string[]>(user?.extra_perms ? user.extra_perms.split(",") : []);
  const [empIds, setEmpIds] = useState<number[]>(user?.employer_ids || []);
  const [active, setActive] = useState(user?.active ?? true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  // Un estudio puede crear roles de estudio; una empresa común, no.
  const roles = ROLES.filter((r) => me?.role === "ADMINISTRADOR" || r !== "ADMINISTRADOR");

  async function save() {
    setError("");
    setSaving(true);
    try {
      const extra = { extra_perms: perms, employer_ids: isStudio(role) ? empIds : [] };
      if (user) await appApi(`/users/${user.id}`, { method: "PUT", body: { name, role, active, ...extra, password: password || null } });
      else await appApi("/users", { method: "POST", body: { name, email, password, role, ...extra } });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setSaving(false); }
  }

  return (
    <Modal eyebrow={user ? "EDITAR USUARIO" : "NUEVO USUARIO"} title={user ? user.name : "Nuevo usuario"} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button></>}>
      <div className="product-form">
        <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label="Email (para entrar)"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!user} /></Field>
        <Field label={user ? "Contraseña nueva (opcional)" : "Contraseña"} hint="Mínimo 6 caracteres"><input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Field label="Rol">
          <select value={role} onChange={(e) => setRole(e.target.value)} disabled={isMe}>
            {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]} - {ROLE_HINTS[r]}</option>)}
          </select>
        </Field>
        <Field label="Permisos extra" hint="Se suman a los que ya trae el rol.">
          <div className="nm-inline-checks">
            {PERMS.map((p) => <label key={p}><input type="checkbox" checked={perms.includes(p)} onChange={() => setPerms(toggle(perms, p))} /> {PERM_LABELS[p]}</label>)}
          </div>
        </Field>
        {role === "ESTUDIO_USER" && (
          <Field label="Empresas a las que puede entrar" hint="Sin empresas asignadas no ve ninguna.">
            <div className="nm-inline-checks">
              {employers.length === 0 && <span className="nm-muted">Todavía no hay empresas cargadas.</span>}
              {employers.map((e) => <label key={e.id}><input type="checkbox" checked={empIds.includes(e.id)} onChange={() => setEmpIds(toggle(empIds, e.id))} /> {e.razon_social}</label>)}
            </div>
          </Field>
        )}
        {user && !isMe && (
          <div className="nm-inline-checks"><label><input type="checkbox" checked={!active} onChange={(e) => setActive(!e.target.checked)} /> Desactivar (no puede entrar)</label></div>
        )}
        {error && <div className="nm-note nm-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

export default Usuarios;
