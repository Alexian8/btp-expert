// ═══════════════════════════════════════════════════════════════════════════
// exportCsv — utilitaire d'export CSV (téléchargement navigateur)
// Utilisé par les listes (clients, factures, logs...) pour exporter les
// données filtrées au format CSV compatible Excel (séparateur ; , BOM UTF-8).
// ═══════════════════════════════════════════════════════════════════════════

const SEPARATOR = ";"; // Excel FR attend un point-virgule

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

/**
 * Génère un fichier CSV et déclenche son téléchargement.
 * @param filename nom du fichier sans extension (la date du jour est ajoutée)
 * @param header   libellés des colonnes
 * @param rows     lignes de données (mêmes index que header)
 */
export function downloadCsv(filename: string, header: string[], rows: unknown[][]): void {
  const lines = [
    header.map(escapeCell).join(SEPARATOR),
    ...rows.map((r) => r.map(escapeCell).join(SEPARATOR)),
  ];
  // BOM UTF-8 pour que Excel reconnaisse les accents
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
