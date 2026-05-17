// Déclarations TS minimalistes pour les templates JS hérités d'Electron.
// Les modules .js sont des CommonJS purs (string templates HTML) qui ne
// nécessitent pas de typage fort — on les expose comme des renderers
// qui acceptent un objet de données et renvoient une string HTML.

declare module "./templates/receptionTemplate" {
  export function renderReceptionHtml(args: {
    report: Record<string, unknown>;
    reserves: Array<Record<string, unknown>>;
    client: Record<string, unknown> | null;
    chantier: Record<string, unknown> | null;
    company: Record<string, unknown>;
  }): string;
}

declare module "./templates/tvaAttestationTemplate" {
  export function renderTvaAttestationHtml(args: {
    attestation: Record<string, unknown>;
    company: Record<string, unknown>;
  }): string;
}

declare module "./templates/tvaAttestationCerfaTemplate" {
  export function renderTvaAttestationCerfaHtml(args: {
    attestation: Record<string, unknown>;
    company: Record<string, unknown>;
  }): string;
}

declare module "./templates/dc4Template" {
  export function renderDc4Html(args: {
    declaration: Record<string, unknown>;
    subcontractor: Record<string, unknown> | null;
    chantier: Record<string, unknown> | null;
    company: Record<string, unknown>;
  }): string;
}
