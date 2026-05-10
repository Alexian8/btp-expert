import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Database, Play, Download, Trash2, RefreshCw, Clock, HardDrive, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [busy, setBusy] = useState<string | null>(null);
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
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Sauvegardes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Backups MySQL automatiques sur o2switch (cron quotidien à 3h du matin)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={runBackup} disabled={running}>
            <Play className="w-4 h-4" />
            {running ? "Sauvegarde…" : "Lancer une sauvegarde"}
          </Button>
          <Button variant="outline" onClick={reload} disabled={isLoading} size="sm">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Dernière sauvegarde</p>
          <p className="text-base font-semibold mt-0.5">
            {lastBackup ? formatRelative(lastBackup.createdAt) : "—"}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-card border border-border rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Nombre de sauvegardes</p>
          <p className="text-xl font-bold tabular-nums mt-0.5">{data?.count ?? "—"}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Espace utilisé</p>
          <p className="text-xl font-bold tabular-nums mt-0.5">
            {data ? formatBytes(data.totalBytes) : "—"}
          </p>
        </motion.div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Liste */}
      {isLoading && !data ? (
        <div className="text-muted-foreground text-sm py-12 text-center">Chargement…</div>
      ) : (data?.files.length ?? 0) === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center text-muted-foreground text-sm">
          Aucune sauvegarde pour l'instant. Le cron tourne tous les jours à 3h. Tu peux aussi en lancer une maintenant.
        </div>
      ) : (
        <div className="space-y-2">
          {data!.files.map((f) => (
            <motion.div
              key={f.name}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center text-primary shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs truncate">{f.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatBytes(f.size)} · {formatRelative(f.createdAt)}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => downloadBackup(f.name)}
                    disabled={busy === f.name}
                    title="Télécharger"
                    className="h-8 w-8"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => restoreBackup(f.name)}
                    disabled={busy === f.name}
                    title="Restaurer"
                    className="h-8 w-8"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => deleteBackup(f.name)}
                    disabled={busy === f.name}
                    title="Supprimer"
                    className="h-8 w-8 hover:!border-destructive/50 hover:!text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
