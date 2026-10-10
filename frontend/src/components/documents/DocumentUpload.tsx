"use client";

import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { UploadCloud, File as FileIcon, X } from "lucide-react";
import { useUploadDocument } from "@/hooks/useDocuments";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { getApiErrorMessage } from "@/lib/api";
import styles from "@/components/workspace/workspace.module.css";

export default function DocumentUpload({ onSuccess }: { onSuccess?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadDocument();
  const { toast } = useToast();
  const validateAndSetFile = (candidate: File) => {
    if (candidate.type !== "application/pdf") {
      toast({ title: "Invalid file type", description: "Please upload a PDF file", variant: "destructive" }); return;
    }
    if (candidate.size > 50 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 50MB", variant: "destructive" }); return;
    }
    setFile(candidate);
  };
  const handleDrop = (event: DragEvent) => {
    event.preventDefault(); setIsDragging(false);
    if (!uploadMutation.isPending && event.dataTransfer.files[0]) validateAndSetFile(event.dataTransfer.files[0]);
  };
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) validateAndSetFile(event.target.files[0]);
    event.target.value = "";
  };
  const handleUpload = () => {
    if (!file || uploadMutation.isPending) return;
    const formData = new FormData(); formData.append("file", file);
    uploadMutation.mutate(formData, {
      onSuccess: () => { toast({ title: "Document uploaded successfully" }); setFile(null); onSuccess?.(); },
      onError: error => toast({ title: "Upload failed", description: getApiErrorMessage(error, "The document could not be uploaded"), variant: "destructive" }),
    });
  };
  return <div className="flex flex-col gap-5">
    <input type="file" ref={fileInputRef} className="hidden" aria-label="Choose PDF file" accept="application/pdf" onChange={handleFileChange} disabled={uploadMutation.isPending} />
    {!file ? <div className={styles.uploadDrop} data-dragging={isDragging} onDragOver={event => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}>
      <UploadCloud aria-hidden="true" /><h3>A PDF. A clearer picture.</h3><p>Drag your document here, or choose a file.</p>
      <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Choose PDF</Button><p>PDF files only, max 50MB</p>
    </div> : <div className={styles.uploadSelected}><FileIcon aria-hidden="true" /><div><p>{file.name}</p><small>{(file.size / 1024 / 1024).toFixed(2)} MB</small></div>
      <Button variant="ghost" size="icon" aria-label="Remove selected file" onClick={() => setFile(null)} disabled={uploadMutation.isPending}><X aria-hidden="true" /></Button>
    </div>}
    {uploadMutation.isPending && <p role="status" className="text-sm text-muted-foreground">Uploading your PDF. Please keep this dialog open.</p>}
    <div className="flex justify-end"><Button onClick={handleUpload} disabled={!file || uploadMutation.isPending}>{uploadMutation.isPending ? "Uploading..." : "Upload Document"}</Button></div>
  </div>;
}
