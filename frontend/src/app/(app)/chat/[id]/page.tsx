"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2, FileText } from "lucide-react";
import { useChatSession, useDeleteSession } from "@/hooks/useChat";
import { useDocuments } from "@/hooks/useDocuments";
import { Button } from "@/components/ui/button";
import ChatInterface from "@/components/chat/ChatInterface";
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

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const { data: session, isLoading } = useChatSession(id);
  const { data: allDocuments } = useDocuments();
  const deleteMutation = useDeleteSession();

  const handleDelete = () => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        router.push("/dashboard");
      }
    });
  };

  if (isLoading) return <div className="p-6">Loading chat...</div>;
  if (!session) return <div className="p-6">Chat session not found.</div>;

  const sessionDocs = allDocuments?.filter(d => session.documentIds.includes(d.id)) || [];

  return (
    <div className="flex h-full min-h-0">
      <div className="w-64 border-r bg-muted/10 hidden lg:flex flex-col">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">Referenced Documents</h3>
          <div className="space-y-2">
            {sessionDocs.map(doc => (
              <div key={doc.id} className="flex items-center gap-2 text-sm bg-background border p-2 rounded-md shadow-sm">
                <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="truncate" title={doc.originalName}>{doc.originalName}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1 flex flex-col">
        <header className="h-14 border-b bg-background flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" asChild>
              <Link href="/dashboard" aria-label="Back to dashboard" title="Back to dashboard"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <h2 className="font-semibold truncate max-w-[200px] sm:max-w-md">{session.title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-destructive" aria-label="Delete chat session" title="Delete chat session">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Chat Session</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete &quot;{session.title}&quot;? This will permanently remove all messages.
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
        </header>

        <div className="flex-1 overflow-hidden relative">
          <ChatInterface sessionId={id} />
        </div>
      </div>
    </div>
  );
}
