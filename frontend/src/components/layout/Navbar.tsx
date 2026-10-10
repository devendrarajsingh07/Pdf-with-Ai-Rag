"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, Menu, X, LogOut, Settings } from "lucide-react";
import { useMe, useLogout } from "@/hooks/useAuth";
import { useChatSessions } from "@/hooks/useChat";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import styles from "@/components/workspace/workspace.module.css";
import ApiConnectionStatus from "./ApiConnectionStatus";

export default function Navbar() {
  const { data: user } = useMe();
  const { data: sessions } = useChatSessions();
  const logout = useLogout();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); menuButton.current?.focus(); } };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open]);
  const links = [{ href: "/dashboard", name: "Dashboard" }, { href: "/documents", name: "Documents" }];
  return <>
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="DocuMind home"><Brain strokeWidth={1.7} aria-hidden="true" /><span>DocuMind</span></Link>
      <nav className={styles.topNav} aria-label="Primary navigation">{links.map(link => <Link key={link.href} href={link.href} aria-current={pathname.startsWith(link.href) ? "page" : undefined}>{link.name}</Link>)}</nav>
      <div className={styles.account}>
        <div className="hidden sm:block"><ApiConnectionStatus /></div>
        <Button ref={menuButton} variant="ghost" size="icon" className={styles.menuButton} aria-expanded={open} aria-controls="workspace-mobile-navigation" aria-label={open ? "Close navigation" : "Open navigation"} onClick={() => setOpen(v => !v)}>{open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</Button>
        {user && <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-full" aria-label="Open account menu"><Avatar className="size-10"><AvatarFallback>{user.name?.charAt(0).toUpperCase() || "U"}</AvatarFallback></Avatar></Button></DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel><div className="flex flex-col gap-1"><p className="text-sm">{user.name}</p><p className="text-xs text-muted-foreground break-all">{user.email}</p></div></DropdownMenuLabel>
            <DropdownMenuSeparator /><DropdownMenuGroup>
              <DropdownMenuItem asChild><Link href="/settings"><Settings className="mr-2 size-4" aria-hidden="true" />Settings</Link></DropdownMenuItem>
              <DropdownMenuItem disabled={logout.isPending} onClick={() => logout.mutate()}><LogOut className="mr-2 size-4" aria-hidden="true" />Log out</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>}
      </div>
    </header>
    <nav id="workspace-mobile-navigation" hidden={!open} className={styles.mobileNav} aria-label="Mobile workspace navigation">
      {links.map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} aria-current={pathname.startsWith(link.href) ? "page" : undefined}>{link.name}</Link>)}
      <h2>Recent Chats</h2>
      {sessions?.length ? sessions.slice(0, 10).map(session => <Link key={session.id} href={`/chat/${session.id}`} onClick={() => setOpen(false)}>{session.title}</Link>) : <p className="text-sm text-muted-foreground py-3">No chat sessions yet</p>}
      <div className="mt-4 sm:hidden"><ApiConnectionStatus /></div>
    </nav>
  </>;
}
