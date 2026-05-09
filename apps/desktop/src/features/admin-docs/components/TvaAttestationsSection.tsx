import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Receipt, Plus, Search, FileText,
} from "lucide-react";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TVA_RATE_META, TVA_ATTESTATION_STATUS_META, formatEuro,
  type TvaAttestation, type TvaRate,
} from "@btp/types";
import { useAdministrativeDocsStore } from "@/stores/administrativeDocsStore";
import { TvaAttestationFormModal } from "./TvaAttestationFormModal";

// ═══════════════════════════════════════════════════════════════════════════
// TvaAttestationsSection — Liste des attestations TVA
// ═══════════════════════════════════════════════════════════════════════════

export function TvaAttestationsSection() {
  const { tvaAttestations, stats, fetchTvaAttestations } = useAdministrativeDocsStore();

  const [search, setSearch] = useState("");
  const [filterRate, setFilterRate] = useState<TvaRate | 0>(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTvaAttestations();
  }, []);

  const filtered = useMemo(() => {
    return tvaAttestations.filter((a) => {
      if (filterRate && a.tvaRate !== filterRate) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const inRef = a.reference?.toLowerCase().includes(q);
        const inClient = a.clientName?.toLowerCase().includes(q);
        const inAddr = a.logementAddress?.toLowerCase().includes(q);
        if (!inRef && !inClient && !inAddr) return false;
      }
      return true;
    });
  }, [tvaAttestations, search, filterRate]);

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label="Total attestations"
          value={String(stats.tvaAttestationsTotal)}
          icon={Receipt}
          color="bg-blue-500/15 text-blue-500"
        />
        <StatCard
          label={`Cette année (${new Date().getFullYear()})`}
          value={String(stats.tvaAttestationsThisYear)}
          icon={FileText}
          color="bg-emerald-500/15 text-emerald-500"
        />
        <div className="bg-muted/30 border border-border rounded-lg p-3 text-xs text-muted-foreground">
          <p className="font-semibold mb-1">Conservation 5 ans</p>
          <p>Les attestations doivent être conservées par toi ET par le client pendant 5 ans après la fin du chantier.</p>
        </div>
      </div>

      {/* Header */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-500" />
              Attestations TVA réduite
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              TVA 5,5% (rénovation énergétique) ou 10% (amélioration / entretien)
            </p>
          </div>
          <Button onClick={() => { setEditingId(null); setFormOpen(true); }} size="sm">
            <Plus className="w-4 h-4" />
            Nouvelle attestation
          </Button>
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par référence, client, adresse..."
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-1">
            {([0, 5.5, 10] as Array<TvaRate | 0>).map((r) => (
              <button
                key={String(r)}
                type="button"
                onClick={() => setFilterRate(r)}
                className={cn(
                  "px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                  filterRate === r
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "bg-card border border-border text-muted-foreground hover:bg-accent"
                )}
              >
                {r === 0 ? "Toutes" : `TVA ${String(r).replace(".", ",")}%`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <EmptyState onCreate={() => { setEditingId(null); setFormOpen(true); }} />
      ) : (
        <div className="space-y-2">
          {filtered.map((a, idx) => (
            <TvaRow
              key={a.id}
              attestation={a}
              delay={Math.min(idx * 0.03, 0.3)}
              onClick={() => { setEditingId(a.id); setFormOpen(true); }}
            />
          ))}
        </div>
      )}

      <TvaAttestationFormModal
        open={formOpen}
        attestationId={editingId}
        onClose={() => setFormOpen(false)}
      />
    </div>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }: {
  label: string;
  value: string;
  icon: any;
  color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-base font-bold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

// ─── Row ───────────────────────────────────────────────────────────────────
function TvaRow({ attestation, delay, onClick }: {
  attestation: TvaAttestation;
  delay: number;
  onClick: () => void;
}) {
  const rateMeta = TVA_RATE_META[String(attestation.tvaRate)];
  const statusMeta = TVA_ATTESTATION_STATUS_META[attestation.status];
  const formattedDate = attestation.signedDate
    ? new Date(attestation.signedDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className="group flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-soft-sm transition-all cursor-pointer"
    >
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", rateMeta.colorTw)}>
        <Receipt className="w-4 h-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-sm font-semibold">{attestation.reference}</span>
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0", rateMeta.colorTw)}>
            {rateMeta.label}
          </span>
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0", statusMeta.colorTw)}>
            {statusMeta.label}
          </span>
          {attestation.attestationType === "cerfa_1300" && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 bg-violet-500/15 text-violet-500">
              CERFA 1300
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
          <span>{formattedDate}</span>
          {attestation.clientName && (<><span>·</span><span className="truncate">{attestation.clientName}</span></>)}
          {attestation.totalAmountHt > 0 && (<><span>·</span><span>{formatEuro(attestation.totalAmountHt)} HT</span></>)}
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="text-center py-16 bg-card border border-dashed border-border rounded-lg">
      <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
        <Receipt className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold mb-1">Aucune attestation TVA</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
        L'attestation TVA réduite (10% / 5,5%) doit être signée par le client AVANT facturation
        pour les travaux dans logements de + de 2 ans.
      </p>
      <Button onClick={onCreate}>
        <Plus className="w-4 h-4" />
        Créer une attestation
      </Button>
    </div>
  );
}
