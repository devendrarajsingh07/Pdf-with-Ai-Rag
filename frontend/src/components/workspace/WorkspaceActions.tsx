"use client";

import { useState } from "react";
import { MessageSquare, Plus, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import DocumentUpload from "@/components/documents/DocumentUpload";
import NewChatDialog from "@/components/chat/NewChatDialog";

export function UploadDocumentAction() {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="lg"><UploadCloud data-icon="inline-start" aria-hidden="true" />Upload Document</Button></DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>Upload Document</DialogTitle>
      <DialogDescription>Add a PDF to extract text, inspect summaries, and ask questions.</DialogDescription>
    </DialogHeader><DocumentUpload onSuccess={() => setOpen(false)} /></DialogContent>
  </Dialog>;
}

export function NewChatAction({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant={compact ? "ghost" : "outline"} size={compact ? "icon" : "lg"} aria-label={compact ? "Start a new chat" : undefined}>
      {compact ? <Plus aria-hidden="true" /> : <><MessageSquare data-icon="inline-start" aria-hidden="true" />Start New Chat</>}
    </Button></DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>Start New Chat</DialogTitle>
      <DialogDescription>Choose ready documents to start a source-grounded conversation.</DialogDescription>
    </DialogHeader><NewChatDialog onSuccess={() => setOpen(false)} /></DialogContent>
  </Dialog>;
}
