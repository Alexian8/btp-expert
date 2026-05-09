import { motion } from "framer-motion";
import { Construction } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

// ═══════════════════════════════════════════════════════════════════════════
// PlaceholderPage — Affichée pour les features pas encore migrées
// ═══════════════════════════════════════════════════════════════════════════

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="p-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-md mx-auto mt-24"
      >
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <div className="w-14 h-14 mx-auto rounded-xl bg-warning/10 flex items-center justify-center mb-4">
              <Construction className="w-7 h-7 text-warning" />
            </div>
            <h2 className="text-xl font-bold mb-2">{title}</h2>
            <p className="text-muted-foreground text-sm">
              {description || "Cette section sera migrée depuis v15.11 dans une session future."}
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
