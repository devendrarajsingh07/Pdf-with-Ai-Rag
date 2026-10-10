"use client";

import { useState } from "react";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Citation } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CitationCard({ citation }: { citation: Citation }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden bg-background/50 text-sm">
      <button
        type="button"
        aria-expanded={expanded}
        className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 font-medium overflow-hidden">
          <FileText className="h-4 w-4 shrink-0 text-blue-500" />
          <span className="truncate">{citation.documentName}</span>
          <span className="text-muted-foreground text-xs shrink-0 bg-muted px-1.5 py-0.5 rounded">
            Pg {citation.pageNumber}
          </span>
          {citation.relevanceScore != null && (
            <span className="text-muted-foreground text-xs shrink-0">
              Score: {citation.relevanceScore.toFixed(2)}
            </span>
          )}
        </div>
        <span className="h-6 w-6 shrink-0 flex items-center justify-center" aria-hidden="true">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      
      {expanded && (
        <div className="px-3 py-2 border-t text-muted-foreground text-xs leading-relaxed italic">
          &quot;{citation.excerpt}&quot;
        </div>
      )}
    </Card>
  );
}
