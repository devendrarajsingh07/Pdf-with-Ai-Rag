"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight, FileText, Trash2, RefreshCw } from "lucide-react";
import type { Document } from "@/types";
import { Button } from "@/components/ui/button";
import { useDeleteDocument, useReindexDocument } from "@/hooks/useDocuments";
import { useToast } from "@/components/ui/use-toast";
import { getApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import DocumentStatus from "./DocumentStatus";
import styles from "@/components/workspace/workspace.module.css";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function formatBytes(bytes: number) {
  if (!bytes) return "0 Bytes";
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 4);
  return `${parseFloat((bytes / 1024 ** unit).toFixed(2))} ${["Bytes", "KB", "MB", "GB", "TB"][unit]}`;
}

export default function DocumentCard({ document, compact = false }: { document: Document; compact?: boolean }) {
  const deleteMutation = useDeleteDocument();
  const reindexMutation = useReindexDocument();
  const { toast } = useToast();
  const busy = document.status === "pending" || document.status === "processing";
  const handleDelete = () => deleteMutation.mutate(document.id, {
    onSuccess: () => toast({ title: "Document deleted" }),
    onError: error => toast({ title: "Could not delete document", description: getApiErrorMessage(error), variant: "destructive" }),
  });
  const handleReindex = () => reindexMutation.mutate(document.id, {
    onSuccess: () => toast({ title: "Reindexing started" }),
    onError: error => toast({ title: "Could not reindex document", description: getApiErrorMessage(error), variant: "destructive" }),
  });
  return <article className={cn(styles.documentRow, compact && styles.compactRow)} aria-label={document.originalName}>
    <div className={styles.documentInfo}><FileText className={styles.fileIcon} aria-hidden="true" />
      <div className={styles.fileText}><h3><Link href={`/documents/${document.id}`}>{document.originalName}</Link></h3>
        <p className={styles.fileMeta}><span>{formatBytes(document.fileSize)}</span><span aria-hidden="true">·</span><time dateTime={document.createdAt}>{format(new Date(document.createdAt), "MMM d, yyyy")}</time>
          {!compact && document.pageCount ? <><span aria-hidden="true">·</span><span>{document.pageCount} {document.pageCount === 1 ? "page" : "pages"}</span></> : null}
        </p>
      </div>
    </div>
    <div><DocumentStatus status={document.status} />
      {!compact && document.errorMessage ? <p className={styles.rowError}>{document.errorMessage}</p> : null}
    </div>
    <div className={styles.rowActions}>
      <Link href={`/documents/${document.id}`} className={styles.textLink} aria-label={`View ${document.originalName}`}>View{compact && <ArrowRight aria-hidden="true" />}</Link>
      {!compact && <><Button variant="ghost" size="icon" onClick={handleReindex} disabled={busy || reindexMutation.isPending || deleteMutation.isPending} title={busy ? "Processing in progress" : "Reindex document"} aria-label={`Reindex ${document.originalName}`}>
        <RefreshCw aria-hidden="true" className={cn(reindexMutation.isPending && "animate-spin")} />
      </Button>
      <Dialog><DialogTrigger asChild><Button variant="ghost" size="icon" disabled={deleteMutation.isPending} aria-label={`Delete ${document.originalName}`} title="Delete document"><Trash2 aria-hidden="true" /></Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>Delete Document</DialogTitle><DialogDescription>Are you sure you want to delete &quot;{document.originalName}&quot;? This action cannot be undone and will remove it from all chat sessions.</DialogDescription></DialogHeader>
          <DialogFooter><DialogClose asChild><Button variant="outline" disabled={deleteMutation.isPending}>Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? "Deleting..." : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog></>}
    </div>
  </article>;
}
