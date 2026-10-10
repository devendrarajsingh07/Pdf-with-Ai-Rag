"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FileText, MessageSquare } from "lucide-react";
import { useChatSessions } from "@/hooks/useChat";
import { Separator } from "@/components/ui/separator";
import { NewChatAction } from "@/components/workspace/WorkspaceActions";
import styles from "@/components/workspace/workspace.module.css";

export default function Sidebar() {
  const pathname = usePathname();
  const { data: sessions, isError } = useChatSessions();
  const links = [{ name: "Dashboard", href: "/dashboard", icon: Home }, { name: "Documents", href: "/documents", icon: FileText }];
  return <aside className={styles.sidebar} aria-label="Workspace sidebar">
    <nav className={styles.sideLinks} aria-label="Workspace navigation">{links.map(({ name, href, icon: Icon }) => <Link className={styles.sideLink} key={href} href={href} aria-current={pathname.startsWith(href) ? "page" : undefined}><Icon strokeWidth={1.7} aria-hidden="true" />{name}</Link>)}</nav>
    <Separator />
    <div className={styles.chatList}>
      <div className={styles.recentHeading}><h2>Recent Chats</h2><NewChatAction compact /></div>
      {sessions?.slice(0, 10).map(session => <Link key={session.id} href={`/chat/${session.id}`} className={styles.sideLink} aria-current={pathname === `/chat/${session.id}` ? "page" : undefined}><MessageSquare strokeWidth={1.7} aria-hidden="true" /><span className="truncate">{session.title}</span></Link>)}
      {sessions?.length === 0 && <p>No chat sessions yet</p>}
      {isError && <p role="alert">Chat sessions unavailable</p>}
    </div>
  </aside>;
}
