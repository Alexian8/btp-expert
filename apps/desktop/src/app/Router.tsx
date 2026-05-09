import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";

import { AuthLayout } from "@/app/layouts/AuthLayout";
import { DashboardLayout } from "@/app/layouts/DashboardLayout";
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
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { useAuthStore } from "@/stores/authStore";

// ═══════════════════════════════════════════════════════════════════════════
// Router — Configuration des routes de l'app
// ═══════════════════════════════════════════════════════════════════════════

// Guard : route protégée (nécessite un user)
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Guard : si déjà loggé, rediriger vers dashboard
function PublicRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
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
      children: [{ index: true, element: <LoginPage /> }],
    },
    {
      path: "/",
      element: (
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      ),
      children: [
        { index: true, element: <DashboardPage /> },
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
