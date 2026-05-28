// ═══════════════════════════════════════════════════════════════════════════
// Client API Qonto (thirdparty.qonto.com/v2)
//
// Authentification par clé API : header  Authorization: <login>:<secret>
// (clé générée dans Qonto → Paramètres → Intégrations → API).
//
// IMPORTANT : ce module ne s'exécute QUE côté serveur. La secret key n'est
// jamais transmise au front.
// ═══════════════════════════════════════════════════════════════════════════

const QONTO_BASE = "https://thirdparty.qonto.com/v2";

export interface QontoCredentials {
  login: string;
  secretKey: string;
}

export interface QontoBankAccount {
  slug: string;
  id?: string;
  name: string;
  iban: string;
  bic: string;
  currency: string;
  balance: number;          // en euros
  authorizedBalance: number;
  updatedAt: string;
}

export interface QontoTransaction {
  id: string;
  amount: number;           // toujours positif ; le sens est dans `side`
  currency: string;
  side: "debit" | "credit";
  operationType: string;    // transfer, card, direct_debit, income, qonto_fee...
  status: string;           // pending, completed, declined
  label: string;
  reference: string;
  note: string;
  emittedAt: string;
  settledAt: string;
  vatAmount: number;
  counterpartyName: string;
}

function authHeader(creds: QontoCredentials): Record<string, string> {
  return {
    Authorization: `${creds.login}:${creds.secretKey}`,
    "Content-Type": "application/json",
    "User-Agent": "BatiDesk/1.0 (compta artisan BTP)",
  };
}

async function qontoFetch<T>(path: string, creds: QontoCredentials): Promise<T> {
  const res = await fetch(`${QONTO_BASE}${path}`, { headers: authHeader(creds) });
  if (res.status === 401) {
    throw new Error("Identifiants Qonto invalides (login ou secret key incorrects).");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Qonto API ${res.status} : ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Récupère l'organisation et ses comptes bancaires (test de connexion inclus). */
export async function fetchOrganization(creds: QontoCredentials): Promise<{
  legalName: string;
  slug: string;
  accounts: QontoBankAccount[];
}> {
  const data = await qontoFetch<{
    organization: {
      slug: string;
      legal_name?: string;
      bank_accounts?: Array<{
        slug: string;
        id?: string;
        name?: string;
        iban?: string;
        bic?: string;
        currency?: string;
        balance?: number;
        balance_cents?: number;
        authorized_balance?: number;
        authorized_balance_cents?: number;
        updated_at?: string;
      }>;
    };
  }>("/organization", creds);

  const org = data.organization;
  const accounts: QontoBankAccount[] = (org.bank_accounts || []).map((a) => ({
    slug: a.slug,
    id: a.id,
    name: a.name || a.slug,
    iban: a.iban || "",
    bic: a.bic || "",
    currency: a.currency || "EUR",
    balance: a.balance ?? (a.balance_cents != null ? a.balance_cents / 100 : 0),
    authorizedBalance:
      a.authorized_balance ??
      (a.authorized_balance_cents != null ? a.authorized_balance_cents / 100 : 0),
    updatedAt: a.updated_at || "",
  }));

  return { legalName: org.legal_name || org.slug, slug: org.slug, accounts };
}

/**
 * Récupère les transactions d'un compte. Pagination automatique (jusqu'à
 * maxPages pour éviter les boucles infinies). `settledFrom` = date ISO min.
 */
export async function fetchTransactions(
  creds: QontoCredentials,
  bankAccountSlug: string,
  opts: { settledFrom?: string; maxPages?: number } = {}
): Promise<QontoTransaction[]> {
  const maxPages = opts.maxPages ?? 10;
  const out: QontoTransaction[] = [];
  let page = 1;

  while (page <= maxPages) {
    const params = new URLSearchParams({
      bank_account_id: bankAccountSlug,
      per_page: "100",
      current_page: String(page),
      sort_by: "settled_at:desc",
    });
    if (opts.settledFrom) params.set("settled_at_from", opts.settledFrom);

    const data = await qontoFetch<{
      transactions: Array<{
        transaction_id?: string;
        id?: string;
        amount?: number;
        amount_cents?: number;
        currency?: string;
        side?: "debit" | "credit";
        operation_type?: string;
        status?: string;
        label?: string;
        reference?: string;
        note?: string;
        emitted_at?: string;
        settled_at?: string;
        vat_amount?: number;
        vat_amount_cents?: number;
        counterparty_name?: string;
      }>;
      meta?: { next_page?: number | null; total_pages?: number };
    }>(`/transactions?${params.toString()}`, creds);

    for (const t of data.transactions || []) {
      out.push({
        id: t.transaction_id || t.id || "",
        amount: t.amount ?? (t.amount_cents != null ? t.amount_cents / 100 : 0),
        currency: t.currency || "EUR",
        side: t.side === "credit" ? "credit" : "debit",
        operationType: t.operation_type || "",
        status: t.status || "",
        label: t.label || "",
        reference: t.reference || "",
        note: t.note || "",
        emittedAt: t.emitted_at || "",
        settledAt: t.settled_at || "",
        vatAmount: t.vat_amount ?? (t.vat_amount_cents != null ? t.vat_amount_cents / 100 : 0),
        counterpartyName: t.counterparty_name || "",
      });
    }

    const next = data.meta?.next_page;
    if (!next) break;
    page = next;
  }

  return out;
}
