import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { AuthLayout } from "@/app/layouts/AuthLayout";
import { DashboardLayout } from "@/app/layouts/DashboardLayout";
import { SuperAdminLayout } from "@/app/layouts/SuperAdminLayout";
import { LoginPage } from "@/features/auth/components/LoginPage";
import { DashboardPage } from "@/features/dashboard/components/DashboardPage";
import { SettingsPage } from "@/features/settings/components/SettingsPage";
import { ClientsPage } from "@/features/clients/components/ClientsPage";
import { SuppliersPage } from "@/features/suppliers/components/SuppliersPage";
import { ChantiersPage } from "@/features/chantiers/components/ChantiersPage";
import { ChantierDetailPage } from "@/features/chantiers/components/ChantierDetailPage";
import { QuotesAndInvoicesPage } from "@/features/quotes/components/QuotesAndInvoicesPage";
import { QuoteEditorPage } from "@/features/quotes/components/QuoteEditorPage";
import { InvoiceEditorPage } from "@/features/invoices/components/InvoiceEditorPage";
import { VaultPage } from "@/features/vault/components/VaultPage";
import { AgendaPage } from "@/features/agenda/components/AgendaPage";
import { ExpensesPage } from "@/features/expenses/components/ExpensesPage";
import { FinancesPage } from "@/features/finances/components/FinancesPage";
import { ExpenseNotesPage } from "@/features/expense-notes/components/ExpenseNotesPage";
import { SubcontractorsPage } from "@/features/subcontractors/components/SubcontractorsPage";
import { SubcontractorDetailPage } from "@/features/subcontractors/components/SubcontractorDetailPage";
import { PurchaseOrdersPage } from "@/features/purchase-orders/components/PurchaseOrdersPage";
import { PurchaseOrderEditorPage } from "@/features/purchase-orders/components/PurchaseOrderEditorPage";
import { PurchaseOrderDetailPage } from "@/features/purchase-orders/components/PurchaseOrderDetailPage";
import { StatisticsPage } from "@/features/stats/components/StatisticsPage";
import { AdminDocsPage } from "@/features/admin-docs/components/AdminDocsPage";
import { AccountingHubPage } from "@/features/accounting/components/AccountingHubPage";
import { UsersAdminPage } from "@/features/admin-users/components/UsersAdminPage";
import { LogsPage } from "@/features/admin-logs/components/LogsPage";
import { CompaniesAdminPage } from "@/features/super-admin/components/CompaniesAdminPage";
import { RouteErrorBoundary } from "@/components/shared/RouteErrorBoundary";
import { useAuthStore } from "@/stores/authStore";

// ═══════════════════════════════════════════════════════════════════════════
// Router — Configuration des routes de l'app
// ═══════════════════════════════════════════════════════════════════════════

// Petit splash affiché tant qu'on n'a pas tenté de restaurer la session
// (évite le flash "/login" → "/" après refresh quand le JWT est valide).
function BootSplash() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

// Guard : route protégée (nécessite un user)
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isBooting = useAuthStore((s) => s.isBooting);
  if (isBooting) return <BootSplash />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Guard : si déjà loggé, rediriger vers dashboard
function PublicRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isBooting = useAuthStore((s) => s.isBooting);
  if (isBooting) return <BootSplash />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Guard : route réservée admin (sécurité côté serveur, ce guard est juste pour l'UX)
function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user) as { role?: string } | null;
  const isBooting = useAuthStore((s) => s.isBooting);
  if (isBooting) return <BootSplash />;
  if (!user) return <Navigate to="/login" replace />;
  // super_admin n'est pas un admin de company, mais on lui laisse l'accès
  // (il peut tout voir cross-tenant si besoin)
  if (user.role !== "admin" && user.role !== "super_admin") {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

// Guard : route réservée au super_admin (éditeur SaaS BatiDesk)
function SuperAdminOnlyRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user) as { role?: string } | null;
  const isBooting = useAuthStore((s) => s.isBooting);
  if (isBooting) return <BootSplash />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "super_admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Si super_admin atterrit sur "/", le rediriger vers /super-admin/companies
// (il n'a pas de company, le dashboard normal lui afficherait du vide)
function SuperAdminLanding() {
  const user = useAuthStore((s) => s.user) as { role?: string } | null;
  if (user?.role === "super_admin") {
    return <Navigate to="/super-admin/companies" replace />;
  }
  return <DashboardPage />;
}

// Wrapper qui choisit le layout selon le rôle :
// - super_admin → SuperAdminLayout (minimal, sans sidebar)
// - autres rôles → DashboardLayout (sidebar complète)
function RoleAwareLayout() {
  const user = useAuthStore((s) => s.user) as { role?: string } | null;
  if (user?.role === "super_admin") return <SuperAdminLayout />;
  return <DashboardLayout />;
}

const router = createBrowserRouter(
  [
    {
      path: "/login",
      element: (
        <PublicRoute>
          <AuthLayout />
        </PublicRoute>
      ),
      errorElement: <RouteErrorBoundary />,
      children: [{ index: true, element: <LoginPage /> }],
    },
    {
      path: "/",
      element: (
        <ProtectedRoute>
          <RoleAwareLayout />
        </ProtectedRoute>
      ),
      // errorElement : attrape les erreurs de rendu de TOUTES les pages
      // enfants, les pousse à Sentry et affiche une UI propre au lieu de
      // l'écran brut "Unexpected Application Error!".
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          index: true,
          element: <SuperAdminLanding />,
        },
        {
          path: "invoices",
          element: <QuotesAndInvoicesPage />,
        },
        {
          path: "invoices/new",
          element: <InvoiceEditorPage />,
        },
        {
          path: "invoices/:id",
          element: <InvoiceEditorPage />,
        },
        {
          path: "quotes",
          element: <QuotesAndInvoicesPage />,
        },
        {
          path: "quotes/new",
          element: <QuoteEditorPage />,
        },
        {
          path: "quotes/:id",
          element: <QuoteEditorPage />,
        },
        {
          path: "chantiers",
          element: <ChantiersPage />,
        },
        {
          path: "chantiers/:id",
          element: <ChantierDetailPage />,
        },
        {
          path: "clients",
          element: <ClientsPage />,
        },
        {
          path: "suppliers",
          element: <SuppliersPage />,
        },
        {
          path: "calendar",
          element: <AgendaPage />,
        },
        {
          path: "vault",
          element: <VaultPage />,
        },
        {
          path: "expenses",
          element: <ExpensesPage />,
        },
        {
          path: "expense-notes",
          element: <ExpenseNotesPage />,
        },
        {
          path: "finances",
          element: <FinancesPage />,
        },
        {
          path: "accounting",
          element: <AccountingHubPage />,
        },
        {
          path: "subcontractors",
          element: <SubcontractorsPage />,
        },
        {
          path: "subcontractors/:id",
          element: <SubcontractorDetailPage />,
        },
        {
          path: "purchase-orders",
          element: <PurchaseOrdersPage />,
        },
        {
          path: "purchase-orders/new",
          element: <PurchaseOrderEditorPage />,
        },
        {
          path: "purchase-orders/:id",
          element: <PurchaseOrderDetailPage />,
        },
        {
          path: "purchase-orders/:id/edit",
          element: <PurchaseOrderEditorPage />,
        },
        {
          path: "statistics",
          element: <StatisticsPage />,
        },
        {
          path: "admin-docs",
          element: <AdminDocsPage />,
        },
        {
          path: "admin/users",
          element: (
            <AdminOnlyRoute>
              <UsersAdminPage />
            </AdminOnlyRoute>
          ),
        },
        {
          path: "admin/logs",
          element: (
            <AdminOnlyRoute>
              <LogsPage />
            </AdminOnlyRoute>
          ),
        },
        {
          path: "super-admin/companies",
          element: (
            <SuperAdminOnlyRoute>
              <CompaniesAdminPage />
            </SuperAdminOnlyRoute>
          ),
        },
        {
          path: "settings",
          element: <SettingsPage />,
        },
      ],
    },
    {
      path: "*",
      element: <Navigate to="/" replace />,
    },
  ],
  {
    // v7 future flags — supprime le warning de la console
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    } as any,
  }
);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
