import { useEffect } from "react";
import { useRouteError, useNavigate, isRouteErrorResponse } from "react-router-dom";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

import { Button } from "@/components/ui/button";
import { captureException } from "@/lib/sentry";

// ═══════════════════════════════════════════════════════════════════════════
// RouteErrorBoundary — errorElement pour les routes React Router.
//
// POURQUOI : quand un composant crashe pendant le rendu, React Router
// l'attrape avec son error boundary intégré et NE LAISSE PAS l'erreur
// remonter jusqu'à window.onerror. Du coup Sentry (qui écoute window.onerror)
// ne la voit jamais.
//
// Ce composant sert d'errorElement : il récupère l'erreur via useRouteError(),
// la pousse explicitement à Sentry via captureException(), et affiche une UI
// propre (au lieu de l'écran brut "Unexpected Application Error!").
// ═══════════════════════════════════════════════════════════════════════════

export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  // Pousse l'erreur à Sentry une seule fois au montage.
  useEffect(() => {
    // On ignore les réponses HTTP 404/403 etc. (isRouteErrorResponse) :
    // ce ne sont pas des bugs, juste des routes/ressources absentes.
    if (!isRouteErrorResponse(error)) {
      captureException(error);
    }
    // eslint-disable-next-line no-console
    console.error("[RouteErrorBoundary] erreur de rendu capturée :", error);
  }, [error]);

  const message =
    isRouteErrorResponse(error)
      ? `${error.status} — ${error.statusText}`
      : error instanceof Error
        ? error.message
        : "Une erreur inattendue est survenue.";

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-lg shadow-soft-xl p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-destructive" />
        </div>
        <h2 className="text-lg font-semibold mb-1">Oups, un problème est survenu</h2>
        <p className="text-sm text-muted-foreground mb-1">
          Cette page a rencontré une erreur. L'incident a été signalé
          automatiquement à l'équipe technique.
        </p>
        <p className="text-xs text-muted-foreground/70 font-mono break-words mb-5">
          {message}
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" onClick={() => navigate("/")}>
            <Home className="w-4 h-4" />
            Accueil
          </Button>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4" />
            Recharger
          </Button>
        </div>
      </div>
    </div>
  );
}
