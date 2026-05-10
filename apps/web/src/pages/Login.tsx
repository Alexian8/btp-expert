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

export function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[Login] handleSubmit fired", { username, hasPassword: !!password });
    setError("");

    if (!username.trim() || !password) {
      console.warn("[Login] champs vides");
      setError("Tous les champs sont requis");
      return;
    }

    try {
      console.log("[Login] appel store login()…");
      const res = await login(username.trim(), password);
      console.log("[Login] résultat:", res);
      if (res.ok) {
        console.log("[Login] navigate /");
        navigate("/", { replace: true });
      } else {
        setError(res.error ?? "Identifiants incorrects");
      }
    } catch (e) {
      console.error("[Login] EXCEPTION:", e);
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-background">
      <div className="w-full max-w-sm">
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
              Connectez-vous à votre espace de travail
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
                    placeholder="Votre identifiant"
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
                    placeholder="Votre mot de passe"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    autoComplete="current-password"
                  />
                </div>
              </div>

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
                Se connecter
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
