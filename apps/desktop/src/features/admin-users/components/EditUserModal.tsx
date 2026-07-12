import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";

import { SideDrawer } from "@/components/shared/SideDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usersAdminApi, type AdminUser } from "../api/usersAdminApi";

// ═══════════════════════════════════════════════════════════════════════════
// EditUserModal — édition du profil d'un utilisateur par l'admin
// (prénom, nom, email). Le rôle et l'activation se gèrent inline dans la
// liste ; le mot de passe via « Régénérer » ; l'identifiant ne se change que
// par l'utilisateur lui-même (Mon compte).
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  user: AdminUser | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EditUserModal({ user, onClose, onSaved }: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? "");
      setLastName(user.lastName ?? "");
      setEmail(user.email ?? "");
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!user) return;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Adresse email invalide");
      return;
    }
    setSaving(true);
    try {
      // Le serveur (UpdateUserSchema) refuse un email vide non-mail : on
      // n'envoie l'email que s'il est renseigné ou a changé vers non-vide.
      const payload: { firstName: string; lastName: string; email?: string } = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      };
      if (email.trim()) payload.email = email.trim();
      await usersAdminApi.update(user.id, payload);
      toast.success("Utilisateur mis à jour");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
        Annuler
      </Button>
      <Button type="submit" form="edit-user-form" loading={saving}>
        Enregistrer
      </Button>
    </div>
  );

  return (
    <SideDrawer
      open={!!user}
      onClose={onClose}
      widthClass="max-w-xl"
      title="Modifier l'utilisateur"
      subtitle={user ? `@${user.username}` : undefined}
      footer={footer}
    >
      <form id="edit-user-form" onSubmit={handleSubmit}>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-firstname">Prénom</Label>
              <Input
                id="edit-firstname"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Prénom"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-lastname">Nom</Label>
              <Input
                id="edit-lastname"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Nom"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-email">Adresse email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="utilisateur@exemple.fr"
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Utilisée pour « Mot de passe oublié » et le renvoi d'invitation.
            </p>
          </div>
        </div>
      </form>
    </SideDrawer>
  );
}
