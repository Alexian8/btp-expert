import { motion } from "framer-motion";
import { ChevronRight, Users, Building2, Hammer } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { cn } from "@btp/ui";
import { formatEuro, type TopClient, type TopSupplier, type ChantierMargin } from "@btp/types";

// ═══════════════════════════════════════════════════════════════════════════
// TopList — Composants de listes top 5 (clients / fournisseurs / chantiers)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Top Clients ──────────────────────────────────────────────────────────
export function TopClientsList({ clients }: { clients: TopClient[] }) {
  const navigate = useNavigate();

  if (clients.length === 0) {
    return (
      <div className="text-center py-6 text-xs text-muted-foreground">
        Aucun client avec facture pour l'instant.
      </div>
    );
  }

  const maxCa = Math.max(...clients.map((c) => c.totalCa), 1);

  return (
    <div className="space-y-1.5">
      {clients.map((client, idx) => {
        const pct = (client.totalCa / maxCa) * 100;
        return (
          <motion.div
            key={client.clientId}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.04 }}
            onClick={() => navigate("/clients")}
            className="group cursor-pointer relative overflow-hidden rounded-md p-2 hover:bg-accent/50 transition-colors"
          >
            {/* Barre fond proportionnelle */}
            <div
              className="absolute inset-y-0 left-0 bg-violet-500/8"
              style={{ width: `${pct}%` }}
            />

            <div className="relative flex items-center gap-3">
              <div className="w-7 h-7 rounded-md bg-violet-500/15 text-violet-500 flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{client.clientName}</p>
                  <p className="text-sm font-semibold tabular-nums shrink-0">{formatEuro(client.totalCa)}</p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {client.invoicesCount} facture{client.invoicesCount > 1 ? "s" : ""}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Top Suppliers ─────────────────────────────────────────────────────────
export function TopSuppliersList({ suppliers }: { suppliers: TopSupplier[] }) {
  const navigate = useNavigate();

  if (suppliers.length === 0) {
    return (
      <div className="text-center py-6 text-xs text-muted-foreground">
        Aucune dépense pour l'instant.
      </div>
    );
  }

  const maxSpent = Math.max(...suppliers.map((s) => s.totalSpent), 1);

  return (
    <div className="space-y-1.5">
      {suppliers.map((supplier, idx) => {
        const pct = (supplier.totalSpent / maxSpent) * 100;
        return (
          <motion.div
            key={supplier.supplierId || supplier.supplierName + idx}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.04 }}
            onClick={() => navigate("/expenses")}
            className="group cursor-pointer relative overflow-hidden rounded-md p-2 hover:bg-accent/50 transition-colors"
          >
            <div
              className="absolute inset-y-0 left-0 bg-rose-500/8"
              style={{ width: `${pct}%` }}
            />
            <div className="relative flex items-center gap-3">
              <div className="w-7 h-7 rounded-md bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0">
                <Building2 className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{supplier.supplierName}</p>
                  <p className="text-sm font-semibold tabular-nums shrink-0">{formatEuro(supplier.totalSpent)}</p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {supplier.expensesCount} dépense{supplier.expensesCount > 1 ? "s" : ""}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Chantier Margins ─────────────────────────────────────────────────────
export function ChantierMarginsList({ margins }: { margins: ChantierMargin[] }) {
  const navigate = useNavigate();
  const visible = margins.filter((m) => m.ca > 0 || m.expenses > 0).slice(0, 8);

  if (visible.length === 0) {
    return (
      <div className="text-center py-6 text-xs text-muted-foreground">
        Aucun chantier avec opérations financières.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {visible.map((m, idx) => {
        // Garde-fous : le serveur peut renvoyer des champs numériques
        // undefined/null (chantier sans données complètes) — on évite le
        // crash "Cannot read properties of undefined (reading 'toFixed')".
        const marge = m.marge ?? 0;
        const ca = m.ca ?? 0;
        const margePct = m.margePct ?? 0;
        const margePositive = marge >= 0;
        return (
          <motion.div
            key={m.chantierId}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.04 }}
            onClick={() => navigate(`/chantiers/${m.chantierId}`)}
            className="group cursor-pointer rounded-md p-2 hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-md bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
                <Hammer className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium truncate">{m.chantierTitle}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                    {m.chantierReference}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>CA <span className="tabular-nums text-emerald-500 font-semibold">{formatEuro(m.ca)}</span></span>
                  <span>·</span>
                  <span>Dép. <span className="tabular-nums text-rose-500 font-semibold">{formatEuro(m.expenses)}</span></span>
                  <span>·</span>
                  <span>
                    Marge{" "}
                    <span className={cn(
                      "tabular-nums font-semibold",
                      margePositive ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {formatEuro(marge)}
                    </span>
                    {ca > 0 && (
                      <span className={cn(
                        "ml-1 text-[10px]",
                        margePositive ? "text-emerald-500" : "text-rose-500"
                      )}>
                        ({margePct.toFixed(0)}%)
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
