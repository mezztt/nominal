// Tipos de negocio de Nominal. Mismos datos que backend/rubros.py (fuente: specs/rubros.json, clave "nominal").
// OJO con los nombres: en Nominal "rubro" ya significa otra cosa (rubro de costo laboral de los conceptos) y `business_type`
// es EMPRESA o ESTUDIO. El tipo de negocio de esta lista viaja como `industry`.
export interface IndustryInfo { key: string; label: string; icon: string; tagline: string; modules: string[] }

export const INDUSTRIES: IndustryInfo[] = [
  {
    key: "COMERCIO", label: "Comercio y PyME", icon: "🏬",
    tagline: "Legajos, liquidación y portal del empleado",
    modules: ["legajos", "convenios", "novedades", "liquidaciones", "recibos", "aguinaldo_vacaciones", "liquidacion_final", "descuentos", "arca_exportacion", "web_portal_empleado"],
  },
  {
    key: "GASTRONOMIA", label: "Gastronomía y hotelería", icon: "🍴",
    tagline: "Novedades y horas, aguinaldo y vacaciones",
    modules: ["legajos", "convenios", "novedades", "liquidaciones", "recibos", "aguinaldo_vacaciones", "liquidacion_final", "descuentos", "arca_exportacion", "web_portal_empleado"],
  },
  {
    key: "CONSTRUCCION", label: "Construcción", icon: "🏗️",
    tagline: "Novedades, liquidación final y Ganancias",
    modules: ["legajos", "convenios", "novedades", "liquidaciones", "recibos", "aguinaldo_vacaciones", "liquidacion_final", "descuentos", "ganancias", "arca_exportacion"],
  },
  {
    key: "SANIDAD", label: "Salud y clínicas", icon: "🏥",
    tagline: "Guardias, novedades y recibos",
    modules: ["legajos", "convenios", "novedades", "liquidaciones", "recibos", "aguinaldo_vacaciones", "liquidacion_final", "descuentos", "ganancias", "arca_exportacion", "web_portal_empleado"],
  },
  {
    key: "BODEGA_AGRO", label: "Bodega, campo y agro", icon: "🍇",
    tagline: "Temporadas, novedades y recibos",
    modules: ["legajos", "convenios", "novedades", "liquidaciones", "recibos", "aguinaldo_vacaciones", "liquidacion_final", "arca_exportacion"],
  },
  {
    key: "ESTUDIO_CONTABLE", label: "Estudio contable", icon: "📒",
    tagline: "Varias empresas, todo incluido",
    modules: ["legajos", "convenios", "novedades", "liquidaciones", "recibos", "aguinaldo_vacaciones", "liquidacion_final", "ganancias", "descuentos", "arca_exportacion", "multiempresa", "web_portal_empleado", "web_verificacion"],
  },
];

export const INDUSTRY_LABELS: Record<string, string> = Object.fromEntries(INDUSTRIES.map((r) => [r.key, r.label]));

export function industryInfo(key: string | null | undefined): IndustryInfo | undefined {
  return INDUSTRIES.find((r) => r.key === key);
}

/** Módulos sugeridos para el tipo de negocio (vacío si no hay). Las dependencias las completa el formulario y el backend. */
export function suggestedModules(key: string | null | undefined): string[] {
  return [...(industryInfo(key)?.modules || [])];
}
