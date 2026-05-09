import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Plus, Edit, Trash2, MoreVertical, FileText } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useVaultStore } from "@/stores/vaultStore";
import type { VaultFolder } from "@btp/types";
import { getFolderIcon, getFolderColorClass } from "../vaultIcons";

// ═══════════════════════════════════════════════════════════════════════════
// FolderTree — Arborescence des dossiers du coffre-fort
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  selectedFolderId: string;
  onSelectFolder: (folderId: string) => void;
  onCreateFolder: (parentId: string) => void;
  onEditFolder: (folder: VaultFolder) => void;
}

interface FolderNode extends VaultFolder {
  children: FolderNode[];
}

export function FolderTree({ selectedFolderId, onSelectFolder, onCreateFolder, onEditFolder }: Props) {
  const folders = useVaultStore((s) => s.folders);
  const deleteFolder = useVaultStore((s) => s.deleteFolder);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    root_company: true, root_clients: true, root_chantiers: true,
  });

  // Construire l'arbre
  const tree = useMemo<FolderNode[]>(() => {
    const map: Record<string, FolderNode> = {};
    folders.forEach((f) => { map[f.id] = { ...f, children: [] }; });
    const roots: FolderNode[] = [];
    folders.forEach((f) => {
      if (f.parentId && map[f.parentId]) {
        map[f.parentId].children.push(map[f.id]);
      } else {
        roots.push(map[f.id]);
      }
    });
    // Tri
    const sortRec = (nodes: FolderNode[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name, "fr"));
      nodes.forEach((n) => sortRec(n.children));
    };
    sortRec(roots);
    return roots;
  }, [folders]);

  const toggleExpand = (id: string) => {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  };

  const handleDelete = async (folder: VaultFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Supprimer le dossier "${folder.name}" ?\n\n(Le dossier doit être vide)`)) return;
    const r = await deleteFolder(folder.id);
    if (r.success) toast.success("Dossier supprimé");
    else toast.error(r.error || "Erreur");
  };

  const renderNode = (node: FolderNode, depth: number) => {
    const Icon = getFolderIcon(node.iconKey);
    const colorCls = getFolderColorClass(node.colorKey);
    const isSelected = node.id === selectedFolderId;
    const isExpanded = expanded[node.id] !== false;
    const hasChildren = node.children.length > 0;
    const isRoot = node.id === "root_company" || node.id === "root_clients" || node.id === "root_chantiers";

    return (
      <div key={node.id}>
        <motion.div
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          onClick={() => onSelectFolder(node.id)}
          className={cn(
            "group flex items-center gap-1.5 py-1.5 pr-1 rounded-md cursor-pointer transition-all",
            isSelected
              ? "bg-primary/15 text-primary shadow-sm"
              : "hover:bg-accent/60 hover:translate-x-0.5"
          )}
          style={{ paddingLeft: `${depth * 16 + 6}px` }}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }}
            className={cn(
              "shrink-0 w-4 h-4 flex items-center justify-center rounded transition-transform",
              hasChildren ? "" : "invisible"
            )}
          >
            <ChevronRight className={cn("w-3.5 h-3.5 transition-transform duration-200", isExpanded && "rotate-90")} />
          </button>
          <Icon className={cn("w-4 h-4 shrink-0 transition-colors", isSelected ? "text-primary" : colorCls)} />
          <span className="text-sm truncate flex-1">{node.name}</span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 h-6 w-6 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCreateFolder(node.id); }}>
                <Plus className="w-3.5 h-3.5" />
                Nouveau sous-dossier
              </DropdownMenuItem>
              {!isRoot && (
                <>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditFolder(node); }}>
                    <Edit className="w-3.5 h-3.5" />
                    Renommer
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => handleDelete(node, e)} className="text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                    Supprimer
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </motion.div>

        <AnimatePresence initial={false}>
          {isExpanded && hasChildren && (
            <motion.div
              key="content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              {node.children.map((c) => renderNode(c, depth + 1))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="space-y-0.5">
      {/* Item "Tous les documents" */}
      <motion.div
        initial={{ opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => onSelectFolder("")}
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-all",
          selectedFolderId === ""
            ? "bg-primary/15 text-primary shadow-sm"
            : "hover:bg-accent/60 hover:translate-x-0.5"
        )}
      >
        <FileText className={cn("w-4 h-4 shrink-0", selectedFolderId === "" ? "text-primary" : "text-muted-foreground")} />
        <span className="text-sm font-medium">Tous les documents</span>
      </motion.div>

      <div className="border-t border-border my-2" />

      {/* Arbre */}
      {tree.map((node) => renderNode(node, 0))}
    </div>
  );
}
