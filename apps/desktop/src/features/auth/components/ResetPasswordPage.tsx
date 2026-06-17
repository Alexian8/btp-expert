import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lock, ShieldCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ═══════════════════════════════════════════════════════════════════════════
// ResetPasswordPage — page publique ouverte depuis le lien email
// (/reset-password?token=...). Définit un nouveau mot de passe via le token.
// Politique alignée sur ChangePasswordModal (≥10, maj, min, chiffre).
// ═══════════════════════════════════════════════════════════════════════════

function policyError(pw: string): string | null {
  if (pw.length < 10) return "Au moins 10 caractères";
  if (!/[A-Z]/.test(pw)) return "Au moins une majuscule";
  if (!/[a-z]/.test(pw)) return "Au moins une minuscule";
  if (!/[0-9]/.test(pw)) return "Au moins un chiffre";
  return null;
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError("");
    const pe = policyError(password);
    if (pe) {
      setError(pe);
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    if (!window.btpAPI?.authResetPassword) {
      setError("Fonction indisponible sur cette plateforme");
      return;
    }
    setLoading(true);
    const r = await window.btpAPI.authResetPassword(token, password);
    setLoading(false);
    if (r.success) {
      toast.success("Mot de passe réinitialisé", { description: "Connectez-vous avec votre nouveau mot de passe." });
      navigate("/login", { replace: true });
    } else {
      setError(r.error || "Lien invalide ou expiré. Refaites une demande.");
    }
  };

  if (!token) {
    return (
      <Card className="shadow-soft-xl">
        <CardHeader className="space-y-3 text-center pt-8">
          <div className="mx-auto w-14 h-14 rounded-full bg-destructive/15 text-destructive flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>
          <CardDescription>Lien de réinitialisation invalide</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>
            Retour à la connexion
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft-xl">
      <CardHeader className="space-y-3 text-center pt-8">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/15 text-primary flex items-center justify-center">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <CardDescription className="text-sm">Choisissez un nouveau mot de passe</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="np">Nouveau mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="np"
                type="password"
                placeholder="10+ caractères, maj, min, chiffre"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
                autoFocus
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp">Confirmer le mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="cp"
                type="password"
                placeholder="Retapez le mot de passe"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="pl-9"
                autoComplete="new-password"
              />
            </div>
          </div>
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              {error}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" loading={loading}>
            Réinitialiser le mot de passe
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
