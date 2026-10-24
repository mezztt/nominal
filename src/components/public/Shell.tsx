import type { ReactNode } from "react";
import { APP_NAME } from "../../config";
import { NominalLogo, PoweredBy, useLightPage } from "../Brand";

/** Marco de las páginas públicas (verificación de recibos y portal del empleado): siempre en claro, pensado para el celular. */
export default function PublicShell({ title, heading, intro, error, children }: {
  title: string; heading: string; intro?: string; error?: string; children?: ReactNode;
}) {
  useLightPage();
  return (
    <div className="pb-page">
      <header className="pb-hero">
        <div className="pb-wrap">
          <div className="pb-top"><NominalLogo size={38} /><div><strong>{APP_NAME}</strong><small>{title}</small></div></div>
          <h1>{heading}</h1>
          {intro && <p>{intro}</p>}
        </div>
      </header>
      <main className="pb-wrap pb-main">
        {error ? <div className="pb-card"><div className="pb-error" role="alert">{error}</div></div> : children}
      </main>
      <footer className="pb-foot"><PoweredBy /></footer>
    </div>
  );
}
