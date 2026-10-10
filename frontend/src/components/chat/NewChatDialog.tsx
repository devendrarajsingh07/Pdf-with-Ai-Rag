"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDocuments } from "@/hooks/useDocuments";
import { useCreateSession } from "@/hooks/useChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { getApiErrorMessage } from "@/lib/api";

export default function NewChatDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [title, setTitle] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const router = useRouter();
  const { data: documents, isLoading: isLoadingDocs } = useDocuments();
  const createSessionMutation = useCreateSession();
  const { toast } = useToast();

  const readyDocuments = documents?.filter(d => d.status === "ready") || [];

  const handleCreate = () => {
    if (!title.trim() || selectedDocs.length === 0) return;

    createSessionMutation.mutate({ title, documentIds: selectedDocs }, {
      onSuccess: (data) => {
        toast({ title: "Chat session created" });
        if (onSuccess) onSuccess();
        router.push(`/chat/${data.id}`);
      },
      onError: error => {
        toast({ title: "Failed to create chat session", description: getApiErrorMessage(error), variant: "destructive" });
      }
    });
  };

  const toggleDoc = (id: string) => {
    setSelectedDocs(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6 py-4">
      <div className="space-y-2">
        <Label htmlFor="title">Chat Title</Label>
        <Input 
          id="title" 
          placeholder="E.g., Analysis of Q3 Reports" 
          value={title} 
          onChange={(e) => setTitle(e.target.value)} 
        />
      </div>

      <div className="space-y-2">
        <Label>Select Documents ({selectedDocs.length} selected)</Label>
        <div className="border rounded-md overflow-hidden">
          <ScrollArea className="h-[200px] p-4">
            {isLoadingDocs ? (
              <div className="text-center text-sm text-muted-foreground py-8">Loading documents...</div>
            ) : readyDocuments.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                No ready documents found. Upload and wait for processing first.
              </div>
            ) : (
              <div className="space-y-3">
                {readyDocuments.map(doc => (
                  <div key={doc.id} className="flex items-start space-x-3">
                    <Checkbox 
                      id={`doc-${doc.id}`} 
                      checked={selectedDocs.includes(doc.id)}
                      onCheckedChange={() => toggleDoc(doc.id)}
                    />
                    <Label 
                      htmlFor={`doc-${doc.id}`} 
                      className="text-sm font-normal leading-none cursor-pointer flex-1"
                    >
                      {doc.originalName}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t">
        <Button 
          onClick={handleCreate} 
          disabled={!title.trim() || selectedDocs.length === 0 || createSessionMutation.isPending}
        >
          {createSessionMutation.isPending ? "Creating..." : "Start Chat"}
        </Button>
      </div>
    </div>
  );
}
