"use client";

import { useState } from "react";
import Image from "next/image";
import { Search } from "lucide-react";
import { useDocuments } from "@/hooks/useDocuments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import DocumentCard from "@/components/documents/DocumentCard";
import { UploadDocumentAction } from "@/components/workspace/WorkspaceActions";
import styles from "@/components/workspace/workspace.module.css";

const filters = ["all", "ready", "processing", "failed"] as const;
export default function DocumentsPage() {
  const { data: documents, isLoading, isError, refetch } = useDocuments();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<typeof filters[number]>("all");
  const filteredDocs = documents?.filter(doc => {
    const matchesSearch = doc.originalName.toLowerCase().includes(search.trim().toLowerCase());
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter || (statusFilter === "processing" && doc.status === "pending");
    return matchesSearch && matchesStatus;
  });
  return <div className={styles.page}>
    <section className={styles.intro} aria-label="Document library">
      <div><h1>Documents</h1><p>All your PDFs. Ready for a closer look.</p><UploadDocumentAction /></div>
      <Image src="/editorial/document-library.webp" alt="" width={1536} height={1024} sizes="(max-width: 599px) 90vw, (max-width: 900px) 45vw, 35vw" quality={90} priority className={styles.introImage} />
    </section>
    <div className={styles.search}><Search aria-hidden="true" /><Input aria-label="Search documents" placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} /></div>
    <div className={styles.filters} role="group" aria-label="Filter documents by status">
      {filters.map(status => <button key={status} type="button" className={styles.filter} aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)}>{status.charAt(0).toUpperCase() + status.slice(1)}</button>)}
    </div>
    {isLoading ? <div className={styles.loading} role="status" aria-label="Loading documents">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
      : isError ? <div className={styles.error} role="alert"><h2>Documents could not be loaded</h2><p>Please try again.</p><Button variant="outline" onClick={() => refetch()}>Retry</Button></div>
      : !filteredDocs?.length ? <div className={styles.empty} role="status">
        <h2>{search || statusFilter !== "all" ? "No documents found" : "A little space for your next PDF."}</h2>
        <p>{search || statusFilter !== "all" ? "Try adjusting your search or filters." : "Upload your first PDF document to get started."}</p>
        {(search || statusFilter !== "all") && <Button variant="outline" onClick={() => { setSearch(""); setStatusFilter("all"); }}>Clear filters</Button>}
      </div>
      : <><div className={styles.listHeader} aria-hidden="true"><span>Document</span><span>Status</span><span>Actions</span></div>
        <ul aria-label="Uploaded documents">{filteredDocs.map(doc => <li key={doc.id}><DocumentCard document={doc} /></li>)}</ul>
      </>}
  </div>;
}
