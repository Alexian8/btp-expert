import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Plus,
  Search,
  ShieldCheck,
  Power,
  PowerOff,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Mail,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@btp/ui";

import { CreateCompanyModal } from "./CreateCompanyModal";
import { superAdminApi, type Company } from "../api/superAdminApi";

// ═══════════════════════════════════════════════════════════════════════════
// CompaniesAdminPage — Panel super_admin (éditeur SaaS BatiDesk)
//
// Liste/crée/désactive les entreprises clientes.
// Accessible uniquement aux users de rôle "super_admin".
// ═══════════════════════════════════════════════════════════════════════════

function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return s;
  }
}

export function CompaniesAdminPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await superAdminApi.listCompanies();
      setCompanies(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = companies.filter((c) => {
    if (!search) return true;
    return c.name.toLowerCase().includes(search.toLowerCase());
  });

  const stats = {
    total: companies.length,
    active: companies.filter((c) => c.isActive).length,
    setup: companies.filter((c) => c.isSetupComplete).length,
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            Entreprises clientes
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Panel super-admin BatiDesk — gestion des tenants SaaS
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" />
          Nouvelle entreprise
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Total" value={stats.total} icon={Building2} />
        <StatCard label="Actives" value={stats.active} icon={Power} accent="emerald" />
        <StatCard label="Setup terminé" value={stats.setup} icon={CheckCircle2} accent="primary" />
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une entreprise…"
          className="pl-10"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm mb-4">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm bg-card border border-dashed border-border rounded-lg">
          {search ? "Aucun résultat" : "Aucune entreprise. Crée la première."}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[2fr_120px_140px_120px_140px] gap-3 px-4 py-2.5 bg-muted/40 text-xs font-medium text-muted-foreground border-b border-border">
            <div>Entreprise</div>
            <div>Setup</div>
            <div>Utilisateurs</div>
            <div>Créée</div>
            <div className="text-right">Actions</div>
          </div>
          <div className="divide-y divide-border">
            {filtered.map((c) => (
              <CompanyRow key={c.id} company={c} onChanged={load} />
            ))}
          </div>
        </div>
      )}

      <CreateCompanyModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void load()}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent?: "emerald" | "primary";
}) {
  const ac =
    accent === "emerald"
      ? "bg-emerald-500/10 text-emerald-600"
      : "bg-primary/10 text-primary";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-lg p-4"
    >
      <div className="flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-md flex items-center justify-center", ac)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
      </div>
    </motion.div>
  );
}

function CompanyRow({ company, onChanged }: { company: Company; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  async function toggleActive() {
    if (busy) return;
    const verb = company.isActive ? "Désactiver" : "Réactiver";
    if (!confirm(
      `${verb} "${company.name}" ?\n\n${
        company.isActive
          ? "Tous les utilisateurs de cette entreprise seront bloqués au login."
          : "L'entreprise pourra de nouveau se connecter (mais ses users restent désactivés tant que l'admin de la company ne les réactive pas)."
      }`
    )) return;
    setBusy(true);
    try {
      await superAdminApi.updateCompany(company.id, { isActive: !company.isActive });
      toast.success(`"${company.name}" ${company.isActive ? "désactivée" : "réactivée"}`);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "grid grid-cols-[2fr_120px_140px_120px_140px] gap-3 px-4 py-3 items-center",
        !company.isActive && "opacity-50",
        busy && "pointer-events-none"
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{company.name || `Company #${company.id}`}</p>
        <p className="text-xs text-muted-foreground">ID #{company.id}</p>
      </div>

      <div>
        {company.isSetupComplete ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="w-3 h-3" />
            Terminé
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-amber-500/10 text-amber-600">
            <Clock className="w-3 h-3" />
            En cours
          </span>
        )}
      </div>

      <div className="text-xs">
        <span className="font-medium">{company.activeUsers ?? 0}</span>
        <span className="text-muted-foreground"> / {company.userCount ?? 0}</span>
        <span className="text-muted-foreground ml-1">actifs</span>
      </div>

      <div className="text-xs text-muted-foreground">
        {formatDate(company.createdAt)}
      </div>

      <div className="flex items-center justify-end gap-1">
        <Button
          variant="outline"
          size="icon"
          title={company.isActive ? "Désactiver l'entreprise" : "Réactiver"}
          onClick={toggleActive}
          disabled={busy}
        >
          {company.isActive ? (
            <PowerOff className="w-3.5 h-3.5 text-destructive" />
          ) : (
            <Power className="w-3.5 h-3.5 text-emerald-500" />
          )}
        </Button>
      </div>
    </div>
  );
}
