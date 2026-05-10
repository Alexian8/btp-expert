import { useEffect, useState, useCallback } from "react";
import { Database, Play, Download, Trash2, RefreshCw, Clock, HardDrive } from "lucide-react";
import { backupService, type BackupListResponse } from "@/lib/backupService";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} Mo`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} Go`;
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffMin < 1440) return `il y a ${Math.floor(diffMin / 60)} h`;
  const diffDays = Math.floor(diffMin / 1440);
  if (diffDays < 7) return `il y a ${diffDays} j`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function BackupsPage() {
  const [data, setData] = useState<BackupListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // nom du backup en cours d'op
  const [running, setRunning] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      setData(await backupService.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setData({ count: 0, totalBytes: 0, files: [] });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function runBackup() {
    setRunning(true);
    setError(null);
    try {
      await backupService.run();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setRunning(false);
    }
  }

  async function downloadBackup(name: string) {
    setBusy(name);
    try {
      await backupService.download(name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  }

  async function deleteBackup(name: string) {
    if (!confirm(`Supprimer "${name}" ? Cette action est irréversible.`)) return;
    setBusy(name);
    try {
      await backupService.delete(name);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  }

  async function restoreBackup(name: string) {
    if (
      !confirm(
        `Restaurer "${name}" ?\n\nCela ÉCRASE les données actuelles avec celles du backup. Conseillé : faire un backup manuel d'abord.`
      )
    )
      return;
    setBusy(name);
    setError(null);
    try {
      const res = await backupService.restore(name);
      alert(`Restauration terminée : ${res.statements} requêtes exécutées.`);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  }

  const lastBackup = data?.files[0];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Sauvegardes serveur</h1>
        <button onClick={reload} className="btn-ghost" disabled={isLoading}>
          <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      {/* ─── Carte d'état globale ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="card">
          <div className="flex items-center gap-2 text-text-muted text-xs mb-1">
            <Clock size={14} />
            Dernière sauvegarde
          </div>
          <div className="font-medium">
            {lastBackup ? formatRelative(lastBackup.createdAt) : "—"}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 text-text-muted text-xs mb-1">
            <Database size={14} />
            Nombre de sauvegardes
          </div>
          <div className="font-medium">{data?.count ?? "—"}</div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 text-text-muted text-xs mb-1">
            <HardDrive size={14} />
            Espace total utilisé
          </div>
          <div className="font-medium">{data ? formatBytes(data.totalBytes) : "—"}</div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={runBackup} className="btn-primary" disabled={running}>
          <Play size={16} />
          {running ? "Sauvegarde en cours…" : "Lancer une sauvegarde"}
        </button>
      </div>

      {error && (
        <div className="card mb-4 border-red-500/30 bg-red-500/10 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ─── Liste des backups ─────────────────────────────────────────── */}
      {isLoading && !data ? (
        <div className="text-text-muted text-sm">Chargement…</div>
      ) : (data?.files.length ?? 0) === 0 ? (
        <div className="card text-text-muted text-sm">
          Aucune sauvegarde pour l'instant. Le cron tourne tous les jours à 3h. Tu peux aussi en lancer une maintenant via le bouton ci-dessus.
        </div>
      ) : (
        <div className="space-y-2">
          {data!.files.map((f) => (
            <div key={f.name} className="card">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs truncate">{f.name}</div>
                  <div className="text-xs text-text-muted mt-0.5">
                    {formatBytes(f.size)} · {formatRelative(f.createdAt)}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => downloadBackup(f.name)}
                    className="btn-secondary !px-2 !py-1"
                    title="Télécharger"
                    disabled={busy === f.name}
                  >
                    <Download size={14} />
                  </button>
                  <button
                    onClick={() => restoreBackup(f.name)}
                    className="btn-secondary !px-2 !py-1"
                    title="Restaurer"
                    disabled={busy === f.name}
                  >
                    <Play size={14} />
                  </button>
                  <button
                    onClick={() => deleteBackup(f.name)}
                    className="btn-secondary !px-2 !py-1 hover:!border-red-500/50 hover:!text-red-400"
                    title="Supprimer"
                    disabled={busy === f.name}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
