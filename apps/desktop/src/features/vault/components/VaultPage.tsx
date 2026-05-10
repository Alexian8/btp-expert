import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plus, Search, Upload, Lock, AlertCircle, Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@btp/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVaultStore } from "@/stores/vaultStore";
import { formatFileSize, type VaultFolder, type VaultDocumentWithTags } from "@btp/types";
import { FolderTree } from "./FolderTree";
import { DocumentsList } from "./DocumentsList";
import { PreviewModal } from "./PreviewModal";
import { UploadModal } from "./UploadModal";
import { EditDocumentModal } from "./EditDocumentModal";
import { EditFolderModal } from "./EditFolderModal";
import { TrashView } from "./TrashView";
import { getFolderIcon, FOLDER_BG_TW } from "../vaultIcons";

// ═══════════════════════════════════════════════════════════════════════════
// VaultPage — Coffre-fort principal
// ═══════════════════════════════════════════════════════════════════════════

export function VaultPage() {
  const {
    folders, documents, stats, isLoading,
    fetchFolders, fetchTags, fetchStats, fetchDocuments, searchDocuments,
  } = useVaultStore();

  const [searchParams] = useSearchParams();
  const filterClientId = searchParams.get("clientId");
  const filterChantierId = searchParams.get("chantierId");

  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [showTrash, setShowTrash] = useState(false);

  const [previewDoc, setPreviewDoc] = useState<VaultDocumentWithTags | null>(null);
  const [editDoc, setEditDoc] = useState<VaultDocumentWithTags | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<VaultFolder | null>(null);
  const [createParentId, setCreateParentId] = useState<string>("");

  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // ─── Initial load ───
  useEffect(() => {
    fetchFolders();
    fetchTags();
    fetchStats();
  }, []);

  // ─── Auto-sélection du dossier client/chantier si filtre URL ───
  useEffect(() => {
    if (folders.length === 0) return;
    if (filterClientId) {
      const f = folders.find((x) => x.clientId === filterClientId);
      if (f) setSelectedFolderId(f.id);
    } else if (filterChantierId) {
      const f = folders.find((x) => x.chantierId === filterChantierId);
      if (f) setSelectedFolderId(f.id);
    }
  }, [folders, filterClientId, filterChantierId]);

  // ─── Recharger documents quand le dossier change ou suite à recherche ───
  useEffect(() => {
    if (searchActive && searchQuery.trim()) {
      searchDocuments(searchQuery, { folderId: selectedFolderId || undefined });
    } else {
      fetchDocuments(selectedFolderId || undefined);
    }
  }, [selectedFolderId, searchActive, searchQuery]);

  const currentFolder = useMemo(
    () => folders.find((f) => f.id === selectedFolderId),
    [folders, selectedFolderId]
  );

  const breadcrumb = useMemo(() => {
    const result: VaultFolder[] = [];
    let cur: VaultFolder | undefined = currentFolder;
    while (cur) {
      result.unshift(cur);
      cur = cur.parentId ? folders.find((f) => f.id === cur!.parentId) : undefined;
    }
    return result;
  }, [currentFolder, folders]);

  // ─── Drag & Drop handlers ───
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    if (!selectedFolderId) {
      toast.error("Sélectionnez un dossier d'abord");
      return;
    }

    setUploadFiles(files);
    setUploadOpen(true);
  };

  const handleClickAdd = (): void => {
    if (!selectedFolderId) {
      toast.error("Sélectionnez un dossier d'abord");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploadFiles(files);
    setUploadOpen(true);
  };

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    setSearchActive(q.trim().length > 0);
  };

  const Icon = currentFolder ? getFolderIcon(currentFolder.iconKey) : null;
  const headerBg = currentFolder ? (FOLDER_BG_TW[currentFolder.colorKey] || FOLDER_BG_TW.default) : "";

  return (
    <div className="h-full flex">
      {/* Sidebar gauche : arborescence — s'étend jusqu'en bas */}
      <aside className="w-64 border-r border-border bg-gradient-to-b from-card via-card to-card/40 overflow-y-auto shrink-0 flex flex-col">
        <div className="p-3 flex flex-col h-full">
          {/* Header avec icône colorée */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold tracking-tight">Coffre-fort</h2>
                <p className="text-[10.5px] text-muted-foreground tabular-nums leading-none mt-0.5">
                  {stats.totalDocuments} doc · {formatFileSize(stats.totalSize)}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => { setEditingFolder(null); setCreateParentId(""); setFolderModalOpen(true); }}
              title="Nouveau dossier racine"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Alertes */}
          {stats.expiringIn30Days > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 mb-3 text-xs"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span>
                <strong>{stats.expiringIn30Days}</strong> document{stats.expiringIn30Days > 1 ? "s expirent" : " expire"} dans les 30 jours
              </span>
            </motion.div>
          )}

          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            <FolderTree
              selectedFolderId={selectedFolderId}
              onSelectFolder={setSelectedFolderId}
              onCreateFolder={(parentId) => {
                setEditingFolder(null);
                setCreateParentId(parentId);
                setFolderModalOpen(true);
              }}
              onEditFolder={(folder) => {
                setEditingFolder(folder);
                setCreateParentId("");
                setFolderModalOpen(true);
              }}
            />
          </div>

          {/* Pied : lien corbeille */}
          <div className="border-t border-border pt-2 mt-2 -mx-3 px-3">
            <button
              onClick={() => setShowTrash(true)}
              className={cn(
                "w-full flex items-center gap-2 py-2 px-2 rounded-md text-sm transition-colors",
                stats.trashCount > 0
                  ? "hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500"
                  : "hover:bg-accent/50 text-muted-foreground/60 hover:text-muted-foreground"
              )}
            >
              <Trash2 className="w-4 h-4" />
              <span className="flex-1 text-left">Corbeille</span>
              {stats.trashCount > 0 && (
                <span className="text-[10.5px] bg-rose-500/15 text-rose-500 font-semibold px-1.5 py-0.5 rounded tabular-nums">
                  {stats.trashCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content : liste des documents OU corbeille */}
      <main
        className="flex-1 overflow-hidden flex flex-col relative"
        onDragEnter={!showTrash ? handleDragEnter : undefined}
        onDragLeave={!showTrash ? handleDragLeave : undefined}
        onDragOver={!showTrash ? handleDragOver : undefined}
        onDrop={!showTrash ? handleDrop : undefined}
      >
        {showTrash ? (
          <TrashView onBack={() => { setShowTrash(false); fetchStats(); }} />
        ) : (
          <>
            {/* Header sticky */}
            <div className="border-b border-border bg-background/80 backdrop-blur-sm p-4 shrink-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {Icon && (
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", headerBg)}>
                      <Icon className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h1 className="text-xl font-bold tracking-tight truncate">
                      {currentFolder ? currentFolder.name : (selectedFolderId === "" ? "Tous les documents" : "Dossier")}
                    </h1>
                    {breadcrumb.length > 0 && breadcrumb.length > 1 && (
                      <p className="text-xs text-muted-foreground truncate">
                        {breadcrumb.slice(0, -1).map((f) => f.name).join(" / ")}
                      </p>
                    )}
                    {currentFolder?.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{currentFolder.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {selectedFolderId && (
                    <Button onClick={handleClickAdd} size="sm">
                      <Plus className="w-4 h-4" />
                      Ajouter
                    </Button>
                  )}
                </div>
              </div>

              {/* Barre recherche */}
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Rechercher dans les noms, descriptions, tags, contenu PDF..."
                  className="pl-9"
                />
              </div>
            </div>

            {/* Liste des documents */}
            <div className="flex-1 overflow-y-auto p-4">
              <DocumentsList
                documents={documents}
                isLoading={isLoading}
                onPreview={setPreviewDoc}
                onEdit={setEditDoc}
              />
            </div>

            {/* Overlay drag & drop */}
            {isDragging && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-primary/15 backdrop-blur-sm border-4 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none z-30"
              >
                <div className="text-center">
                  <Upload className="w-12 h-12 mx-auto text-primary mb-3" />
                  <p className="text-lg font-semibold text-primary">Déposez vos fichiers ici</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ils seront chiffrés et ajoutés au dossier "{currentFolder?.name || "Tous les documents"}"
                  </p>
                </div>
              </motion.div>
            )}
          </>
        )}
      </main>

      {/* Modaux */}
      <PreviewModal
        open={!!previewDoc}
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />
      <EditDocumentModal
        open={!!editDoc}
        document={editDoc}
        onClose={() => setEditDoc(null)}
        onSuccess={() => fetchDocuments(selectedFolderId || undefined)}
      />
      <UploadModal
        open={uploadOpen}
        folderId={selectedFolderId}
        files={uploadFiles}
        onClose={() => { setUploadOpen(false); setUploadFiles([]); }}
        onSuccess={() => fetchDocuments(selectedFolderId || undefined)}
      />
      <EditFolderModal
        open={folderModalOpen}
        folder={editingFolder}
        parentId={createParentId}
        onClose={() => setFolderModalOpen(false)}
        onSuccess={() => {}}
      />
      {/* Input file caché — déclenché par handleClickAdd */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
      />
    </div>
  );
}
