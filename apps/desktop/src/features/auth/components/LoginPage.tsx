import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, User as UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/authStore";
import logoSquareUrl from "@/assets/logo-square.png";
import { MicrosoftLoginCard } from "./MicrosoftLoginCard";

// ═══════════════════════════════════════════════════════════════════════════
// LoginPage — Écran d'accueil (login OU setup du premier utilisateur)
// Démontre : architecture feature, usage des stores, composants UI, animations
// ═══════════════════════════════════════════════════════════════════════════

export function LoginPage() {
  const navigate = useNavigate();
  const { login, setupFirstUser, needsSetup, isLoading } = useAuthStore();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Tous les champs sont requis");
      return;
    }

    if (needsSetup) {
      if (password !== confirmPassword) {
        setError("Les mots de passe ne correspondent pas");
        return;
      }
      if (password.length < 4) {
        setError("Mot de passe trop court (minimum 4 caractères)");
        return;
      }
      const ok = await setupFirstUser(username.trim(), password);
      if (ok) navigate("/");
      else setError("Impossible de créer l'utilisateur");
    } else {
      const ok = await login(username.trim(), password);
      if (ok) navigate("/");
      else setError("Identifiants incorrects");
    }
  };

  return (
    <>
      <Card className="shadow-soft-xl">
      <CardHeader className="space-y-4 text-center pt-8">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="mx-auto w-36 h-36 flex items-center justify-center"
        >
          <img
            src={logoSquareUrl}
            alt="BatiDesk"
            className="w-full h-full object-contain"
          />
        </motion.div>
        <CardDescription className="text-sm">
          {needsSetup
            ? "Créez votre compte administrateur"
            : "Connectez-vous à votre espace de travail"}
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Identifiant</Label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="username"
                type="text"
                placeholder={needsSetup ? "Choisissez un identifiant" : "Votre identifiant"}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-9"
                autoFocus
                autoComplete="username"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder={needsSetup ? "Minimum 4 caractères" : "Votre mot de passe"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
                autoComplete={needsSetup ? "new-password" : "current-password"}
              />
            </div>
          </div>

          {needsSetup && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-2"
            >
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Retapez le mot de passe"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-9"
                  autoComplete="new-password"
                />
              </div>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm"
            >
              {error}
            </motion.div>
          )}
        </CardContent>

        <CardFooter>
          <Button type="submit" className="w-full" loading={isLoading}>
            {needsSetup ? "Créer mon compte" : "Se connecter"}
          </Button>
        </CardFooter>
      </form>
    </Card>

    {/* Encart Microsoft sous le formulaire (Session iOS-1.7) */}
    <MicrosoftLoginCard />
    </>
  );
}
