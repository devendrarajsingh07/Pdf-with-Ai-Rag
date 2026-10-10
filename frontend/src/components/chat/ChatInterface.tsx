"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Send } from "lucide-react";
import { useChatMessages, useSendMessage } from "@/hooks/useChat";
import { Citation, Message } from "@/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import CitationCard from "./CitationCard";
import { useToast } from "@/components/ui/use-toast";
import { getApiErrorMessage } from "@/lib/api";

export default function ChatInterface({ sessionId }: { sessionId: string }) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: messages, isLoading } = useChatMessages(sessionId);
  const sendMessageMutation = useSendMessage();
  const { toast } = useToast();

  const scrollToBottom = () => {
    const viewport = scrollRef.current?.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]');
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sendMessageMutation.isPending]);

  const handleSend = () => {
    if (!input.trim() || sendMessageMutation.isPending) return;
    
    sendMessageMutation.mutate({ id: sessionId, question: input.trim() }, {
      onSuccess: () => {
        setInput("");
      },
      onError: error => toast({ title: "Could not send message", description: getApiErrorMessage(error), variant: "destructive" }),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="max-w-3xl mx-auto space-y-6 pb-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <span className="loading-dots flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></span>
              </span>
            </div>
          ) : messages?.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
              <p>Start a conversation to query your documents.</p>
            </div>
          ) : (
            messages?.map((msg: Message) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg p-4 ${
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  {msg.role === "user" ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}

                  {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                    <div className="mt-4 space-y-2 pt-4 border-t border-border/50">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sources</p>
                      <div className="flex flex-col gap-2">
                        {msg.citations.map((cit, i) => (
                          <CitationCard key={i} citation={cit} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {sendMessageMutation.isPending && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-lg p-4 bg-muted">
                <span className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></span>
                </span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-background">
        <div className="max-w-3xl mx-auto relative flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your documents... (Enter to send, Shift+Enter for new line)"
            className="min-h-[60px] max-h-[200px] resize-none pb-12"
            disabled={sendMessageMutation.isPending}
          />
          <Button 
            size="icon" 
            className="absolute right-3 bottom-3 h-8 w-8" 
            onClick={handleSend}
            disabled={!input.trim() || sendMessageMutation.isPending}
            aria-label="Send message"
            title="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
