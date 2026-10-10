'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Brain, Menu, X } from 'lucide-react';
import styles from './home.module.css';

const links = [
  { href: '#applications', label: 'Applications' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#system', label: 'Under the hood' },
];

export function HomeNavigation() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  return (
    <header className={styles.header}>
      <div className={`${styles.container} ${styles.headerInner}`}>
        <Link href="/" className={styles.brand} aria-label="DocuMind home">
          <Brain aria-hidden="true" strokeWidth={1.7} />
          <span>DocuMind</span>
        </Link>
        <nav className={styles.desktopNav} aria-label="Homepage navigation">
          {links.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
        </nav>
        <div className={styles.headerActions}>
          <Link href="/login" className={styles.login}>Log in</Link>
          <Link href="/dashboard" className={styles.primaryLink}>Open workspace</Link>
          <button
            type="button"
            ref={menuButton}
            className={styles.menuButton}
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
            aria-controls="home-mobile-navigation"
            onClick={() => setOpen((current) => !current)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>
      <nav
        id="home-mobile-navigation"
        className={styles.mobileNav}
        hidden={!open}
        aria-label="Mobile homepage navigation"
      >
        {links.map((link) => (
          <a key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</a>
        ))}
        <Link href="/login" onClick={() => setOpen(false)}>Log in</Link>
      </nav>
    </header>
  );
}
