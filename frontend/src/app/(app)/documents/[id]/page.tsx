"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Trash2, RefreshCw, MessageSquare, AlertCircle } from "lucide-react";
import { useDocument, useDocumentStatus, useDeleteDocument, useReindexDocument } from "@/hooks/useDocuments";
import { Button } from "@/components/ui/button";
import styles from "@/components/workspace/workspace.module.css";
import DocumentStatus from "@/components/documents/DocumentStatus";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { getApiErrorMessage } from "@/lib/api";
import { useCreateSession } from "@/hooks/useChat";
import DocumentAnalysis from "@/components/documents/DocumentAnalysis";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
const PDFViewer = dynamic(() => import("@/components/documents/PDFViewer"), { ssr: false });

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { toast } = useToast();
  
  const { data: document, isLoading } = useDocument(id);
  const { data: statusData } = useDocumentStatus(id);
  const deleteMutation = useDeleteDocument();
  const reindexMutation = useReindexDocument();
  const createSession = useCreateSession();

  const currentStatus = statusData?.status || document?.status;
  const errorMessage = statusData?.errorMessage || document?.errorMessage;

  const handleDelete = () => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast({ title: "Document deleted" });
        router.push("/documents");
      },
      onError: error => toast({ title: "Could not delete document", description: getApiErrorMessage(error), variant: "destructive" }),
    });
  };

  const handleReindex = () => {
    reindexMutation.mutate(id, {
      onSuccess: () => {
        toast({ title: "Reindexing started" });
      },
      onError: error => toast({ title: "Could not reindex document", description: getApiErrorMessage(error), variant: "destructive" }),
    });
  };

  if (isLoading) {
    return <div className={styles.page} role="status">Loading document details...</div>;
  }

  if (!document) {
    return <div className={styles.page}><h1 className="text-2xl font-bold mb-4">Document unavailable</h1><p className="text-muted-foreground mb-6">This document could not be loaded or is no longer available.</p><Link href="/documents" className={styles.textLink}>Back to documents<ArrowLeft aria-hidden="true" /></Link></div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.detailHeading}>
        <div className={styles.detailTitle}>
          <Link href="/documents" className={cn(styles.textLink, styles.backLink)}><ArrowLeft aria-hidden="true" />Back to documents</Link>
          <div>
            <h1>{document.originalName}</h1>
            <div className={styles.detailMeta}>
              <span>{format(new Date(document.createdAt), "MMM d, yyyy")}</span>
              <DocumentStatus status={currentStatus!} />
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          {currentStatus === 'ready' && (
            <Button size="lg" variant="default" disabled={createSession.isPending} onClick={() => createSession.mutate({ title: document.originalName, documentIds: [id] }, {
              onSuccess: session => router.push(`/chat/${session.id}`),
              onError: error => toast({ title: "Could not start chat", description: getApiErrorMessage(error), variant: "destructive" }),
            })}>
              <MessageSquare data-icon="inline-start" aria-hidden="true" /> Start Chat
            </Button>
          )}
          
          <Button 
            variant="outline" 
            size="lg"
            onClick={handleReindex} 
            disabled={reindexMutation.isPending || currentStatus === 'processing' || currentStatus === 'pending'}
          >
            <RefreshCw data-icon="inline-start" aria-hidden="true" className={cn(reindexMutation.isPending && 'animate-spin')} />
            Reindex
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg" variant="destructive-outline">
                <Trash2 data-icon="inline-start" aria-hidden="true" />
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Document</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete &quot;{document.originalName}&quot;? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={deleteMutation.isPending}>Cancel</Button>
                </DialogClose>
                <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
                  {deleteMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {(currentStatus === 'processing' || currentStatus === 'pending') && (
        <div className={styles.notice}>
          <h3 className="font-medium flex items-center gap-2 mb-2">
            <RefreshCw className="h-4 w-4 animate-spin text-yellow-600" />
            Processing Document
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            We&apos;re extracting text and creating embeddings for this document. This may take a few minutes.
          </p>
          <p className="text-xs text-muted-foreground">Status updates automatically.</p>
        </div>
      )}

      {currentStatus === 'failed' && (
        <div className={cn(styles.notice, styles.failedNotice)}>
          <h3 className="font-medium flex items-center gap-2 mb-1">
            <AlertCircle className="h-4 w-4" />
            Processing Failed
          </h3>
          <p className="text-sm">{errorMessage || "An unknown error occurred while processing the document."}</p>
        </div>
      )}

      {(statusData?.analysis || document.analysis) && <DocumentAnalysis analysis={(statusData?.analysis || document.analysis)!} />}
      {currentStatus === 'ready' && !statusData?.analysis && !document.analysis && <p className="mb-4 text-sm text-muted-foreground">Reindex this document to generate an upload summary and OCR quality metrics.</p>}
      <div>
        <PDFViewer url={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/documents/${document.id}/file`} />
      </div>
    </div>
  );
}
