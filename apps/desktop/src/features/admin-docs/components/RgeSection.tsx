import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Leaf, Plus, Search, ExternalLink, AlertTriangle, CheckCircle2, Calendar,
} from "lucide-react";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RGE_DOCUMENT_TYPE_META,
  type RgeDocument,
  type RgeDocumentType,
} from "@btp/types";
import { useAdministrativeDocsStore } from "@/stores/administrativeDocsStore";
import { RgeFormModal } from "./RgeFormModal";

// ═══════════════════════════════════════════════════════════════════════════
// RgeSection — Documents RGE / MaPrimeRénov' (qualifications, devis, factures,
// attestations fin de travaux). Conforme art. R. 181-38 Code de l'énergie.
// ═══════════════════════════════════════════════════════════════════════════

export function RgeSection() {
  const { rgeDocuments, stats, fetchRge, fetchStats } = useAdministrativeDocsStore();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<RgeDocumentType | "">("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRge();
    fetchStats();
  }, []);

  const qualifications = useMemo(
    () => rgeDocuments.filter((d) => d.type === "qualification"),
    [rgeDocuments]
  );

  const expiringSoon = useMemo(() => {
    const now = Date.now();
    const in60days = now + 60 * 24 * 3600 * 1000;
    return qualifications.filter((q) => {
      if (!q.rgeValidUntil) return false;
      const exp = new Date(q.rgeValidUntil).getTime();
      return exp > 0 && exp < in60days;
    });
  }, [qualifications]);

  const totalPrimeRenov = useMemo(
    () =>
      rgeDocuments.reduce((sum, d) => sum + (Number(d.primeRenovActual) || 0), 0),
    [rgeDocuments]
  );

  const filtered = useMemo(() => {
    return rgeDocuments.filter((d) => {
      if (filterType && d.type !== filterType) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const inRef = d.reference?.toLowerCase().includes(q);
        const inQualif = d.rgeQualification?.toLowerCase().includes(q);
        const inClient = d.clientName?.toLowerCase().includes(q);
        const inDesc = d.worksDescription?.toLowerCase().includes(q);
        if (!inRef && !inQualif && !inClient && !inDesc) return false;
      }
      return true;
    });
  }, [rgeDocuments, search, filterType]);

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label="Documents RGE"
          value={String(stats.rgeDocumentsTotal)}
          icon={Leaf}
          color="bg-emerald-500/15 text-emerald-500"
        />
        <StatCard
          label="Qualifications expirant à 60j"
          value={String(expiringSoon.length)}
          icon={AlertTriangle}
          color={
            expiringSoon.length > 0
              ? "bg-amber-500/15 text-amber-500"
              : "bg-slate-400/20 text-slate-600 dark:text-slate-200"
          }
        />
        <StatCard
          label="MaPrimeRénov' versée (total)"
          value={totalPrimeRenov.toLocaleString("fr-FR", {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 0,
          })}
          icon={CheckCircle2}
          color="bg-blue-500/15 text-blue-500"
        />
      </div>

      {/* Alertes expiration */}
      {expiringSoon.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-md p-3">
          <p className="text-sm font-semibold flex items-center gap-1.5 text-amber-800 mb-1">
            <AlertTriangle className="w-4 h-4" />
            {expiringSoon.length} qualification{expiringSoon.length > 1 ? "s" : ""} expire{expiringSoon.length > 1 ? "nt" : ""} dans moins de 60 jours
          </p>
          <ul className="text-xs text-amber-900 ml-5 list-disc">
            {expiringSoon.map((q) => (
              <li key={q.id}>
                <strong>{q.rgeQualification}</strong>
                {q.rgeQualificationNumber ? ` — ${q.rgeQualificationNumber}` : ""}
                {q.rgeValidUntil ? ` (valable jusqu'au ${new Date(q.rgeValidUntil).toLocaleDateString("fr-FR")})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Header section */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Leaf className="w-4 h-4 text-emerald-500" />
              Documents RGE / MaPrimeRénov'
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Qualifications, devis, factures et attestations de fin de travaux
            </p>
          </div>
          <Button onClick={() => { setEditingId(null); setFormOpen(true); }} size="sm">
            <Plus className="w-4 h-4" />
            Nouveau document
          </Button>
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par référence, qualification, client..."
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <FilterPill
              active={filterType === ""}
              onClick={() => setFilterType("")}
            >
              Tous
            </FilterPill>
            {(Object.keys(RGE_DOCUMENT_TYPE_META) as RgeDocumentType[]).map((t) => (
              <FilterPill
                key={t}
                active={filterType === t}
                onClick={() => setFilterType(t)}
              >
                {RGE_DOCUMENT_TYPE_META[t].label}
              </FilterPill>
            ))}
          </div>
        </div>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <EmptyState onCreate={() => { setEditingId(null); setFormOpen(true); }} />
      ) : (
        <div className="space-y-2">
          {filtered.map((d, idx) => (
            <RgeRow
              key={d.id}
              doc={d}
              delay={Math.min(idx * 0.03, 0.3)}
              onClick={() => { setEditingId(d.id); setFormOpen(true); }}
            />
          ))}
        </div>
      )}

      {/* Liens utiles (toujours en bas) */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-2">Liens utiles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <LinkRow
            href="https://www.france-renov.gouv.fr/aides/maprimerenov"
            label="MaPrimeRénov' — France Rénov'"
          />
          <LinkRow
            href="https://www.qualibat.com/devenir-rge/"
            label="Devenir RGE Qualibat"
          />
          <LinkRow
            href="https://www.faire.gouv.fr/annuaire-rge"
            label="Annuaire des artisans RGE"
          />
          <LinkRow
            href="https://www.economie.gouv.fr/cedef/aides-renovation-energetique"
            label="Aides à la rénovation énergétique"
          />
        </div>
      </div>

      <RgeFormModal
        open={formOpen}
        documentId={editingId}
        onClose={() => setFormOpen(false)}
      />
    </div>
  );
}

// ─── Composants UI ─────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }: {
  label: string;
  value: string;
  icon: typeof Leaf;
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

function FilterPill({ active, onClick, children }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
        active
          ? "bg-primary/10 text-primary border border-primary/30"
          : "bg-card border border-border text-muted-foreground hover:bg-accent"
      )}
    >
      {children}
    </button>
  );
}

function RgeRow({ doc, delay, onClick }: {
  doc: RgeDocument;
  delay: number;
  onClick: () => void;
}) {
  const typeMeta = RGE_DOCUMENT_TYPE_META[doc.type];
  const expired = doc.rgeValidUntil && new Date(doc.rgeValidUntil) < new Date();

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className="group flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-soft-sm transition-all cursor-pointer"
    >
      <div className="w-10 h-10 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
        <Leaf className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-sm font-semibold">{doc.reference}</span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 shrink-0">
            {typeMeta.label}
          </span>
          {expired && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 shrink-0">
              Expiré
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
          <span>{doc.rgeQualification}</span>
          {doc.rgeQualificationNumber && (<><span>·</span><span>{doc.rgeQualificationNumber}</span></>)}
          {doc.rgeValidUntil && (<><span>·</span><Calendar className="w-3 h-3" /><span>{new Date(doc.rgeValidUntil).toLocaleDateString("fr-FR")}</span></>)}
          {doc.clientName && (<><span>·</span><span className="truncate">{doc.clientName}</span></>)}
        </div>
      </div>
      {doc.primeRenovExpected > 0 && (
        <div className="text-right text-xs">
          <p className="font-semibold tabular-nums">
            {Number(doc.primeRenovActual || doc.primeRenovExpected).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
          </p>
          <p className="text-muted-foreground">
            {doc.primeRenovActual > 0 ? "versée" : "estimée"}
          </p>
        </div>
      )}
    </motion.div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="text-center py-12 bg-card border border-dashed border-border rounded-lg">
      <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
        <Leaf className="w-6 h-6 text-emerald-500" />
      </div>
      <h3 className="text-base font-semibold mb-1">Aucun document RGE</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
        Référencez vos qualifications RGE (Qualibat, Qualifelec…) et générez les
        devis/factures et attestations de fin de travaux MaPrimeRénov'.
      </p>
      <Button onClick={onCreate}>
        <Plus className="w-4 h-4" />
        Ajouter une qualification
      </Button>
    </div>
  );
}

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-xs text-primary hover:underline"
    >
      <ExternalLink className="w-3 h-3" />
      {label}
    </a>
  );
}
