"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, FileText, MessageSquare, RefreshCw, CheckCircle2 } from "lucide-react";
import { useMe } from "@/hooks/useAuth";
import { useDocuments } from "@/hooks/useDocuments";
import { useChatSessions } from "@/hooks/useChat";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import DocumentCard from "@/components/documents/DocumentCard";
import { UploadDocumentAction, NewChatAction } from "@/components/workspace/WorkspaceActions";
import styles from "@/components/workspace/workspace.module.css";

export default function DashboardPage() {
  const { data: user } = useMe();
  const docs = useDocuments();
  const chats = useChatSessions();
  const stats = [
    { label: "Total Documents", value: docs.data?.length, icon: FileText, loading: docs.isLoading },
    { label: "Ready for Chat", value: docs.data?.filter(d => d.status === "ready").length, icon: CheckCircle2, loading: docs.isLoading },
    { label: "Processing", value: docs.data?.filter(d => d.status === "processing" || d.status === "pending").length, icon: RefreshCw, loading: docs.isLoading },
    { label: "Chat Sessions", value: chats.data?.length, icon: MessageSquare, loading: chats.isLoading },
  ];
  return <div className={styles.page}>
    <section className={styles.intro} aria-label="Workspace overview">
      <div><h1>Welcome back, {user?.name?.trim().split(/\s+/)[0] || "there"}!</h1>
        <p>Your documents. Your next discovery.</p>
        <div className={styles.actions}><UploadDocumentAction /><NewChatAction /></div>
      </div>
      <Image src="/editorial/workspace-welcome.webp" alt="" width={1536} height={1024} sizes="(max-width: 599px) 90vw, (max-width: 900px) 45vw, 35vw" quality={90} priority className={styles.introImage} />
    </section>
    <dl className={styles.stats} aria-label="Workspace statistics">
      {stats.map(({ label, value, icon: Icon, loading }) => <div className={styles.stat} key={label}>
        <Icon aria-hidden="true" strokeWidth={1.7} /><div><dt>{label}</dt><dd>{loading ? <Skeleton className="h-9 w-10" /> : value ?? "—"}</dd></div>
      </div>)}
    </dl>
    {chats.isError && <p role="alert" className="text-sm text-destructive mb-6">Chat sessions could not be loaded. <Button variant="link" onClick={() => chats.refetch()}>Retry</Button></p>}
    <section aria-labelledby="recent-documents-heading">
      <div className={styles.sectionHeading}><h2 id="recent-documents-heading">Recent Documents</h2>
        <Link className={styles.textLink} href="/documents">View all<ArrowRight aria-hidden="true" /></Link>
      </div>
      {docs.isLoading ? <div className={styles.loading} role="status" aria-label="Loading documents">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
        : docs.isError ? <div className={styles.error} role="alert"><h2>Documents could not be loaded</h2><p>Please try again.</p><Button variant="outline" onClick={() => docs.refetch()}>Retry</Button></div>
        : docs.data?.length ? <ul>{docs.data.slice(0, 5).map(doc => <li key={doc.id}><DocumentCard document={doc} compact /></li>)}</ul>
        : <div className={styles.empty}><h2>Your next discovery starts with a PDF.</h2><p>No documents uploaded yet. Add one to start reading and asking questions.</p></div>}
    </section>
  </div>;
}
