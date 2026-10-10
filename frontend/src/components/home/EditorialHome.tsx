import Image from 'next/image';
import Link from 'next/link';
import {
  AlignLeft, ArrowRight, Brain, Database, FileScan, FileSearch, FileText,
  Info, LayoutPanelTop, ListOrdered, MessagesSquare, ScanLine,
  type LucideIcon,
} from 'lucide-react';
import { HomeNavigation } from './HomeNavigation';
import styles from './home.module.css';

type Detail = { title: string; description: string; icon: LucideIcon; tone: string };

const applications = [
  { title: 'Read & extract', description: 'Turn complex PDFs into clean, readable pages with key content extracted for you.', href: '#reading', label: 'Explore reading', icon: FileText, tone: 'blue' },
  { title: 'Summarize & discover', description: 'Get clear summaries and find what matters, even in long or complex documents.', href: '#insights', label: 'Explore summaries', icon: AlignLeft, tone: 'yellow' },
  { title: 'Ask with sources', description: 'Get answers from your PDFs with clear citations you can trace back to the source.', href: '#answers', label: 'Explore Q&A', icon: MessagesSquare, tone: 'green' },
];

const readingDetails: Detail[] = [
  { title: 'Native + scanned pages', description: 'Read text from digital, scanned, and mixed PDFs.', icon: FileScan, tone: 'blue' },
  { title: 'Layout-aware extraction', description: 'Retain word geometry, text blocks, and reading structure.', icon: LayoutPanelTop, tone: 'coral' },
  { title: 'Quality you can inspect', description: 'Review OCR confidence and low-confidence words alongside page summaries.', icon: ScanLine, tone: 'yellow' },
];

const orchestrationDetails: Detail[] = [
  { title: 'Priority, then shortest estimate', description: 'Chat jobs are prioritized; smaller estimated jobs run first within each tier. Aging promotes waiting work.', icon: ListOrdered, tone: 'coral' },
  { title: 'Cache before another API call', description: 'Owner-scoped encrypted Redis caches reduce repeated work. Shared budgets still apply to permitted model fallbacks.', icon: Database, tone: 'blue' },
  { title: 'A request you can trace', description: 'Idempotency keys, source checks, and fenced completion track each job.', icon: FileSearch, tone: 'yellow' },
];

const steps = [
  { title: 'Upload', description: 'Add your PDFs to a workspace.' },
  { title: 'Read & analyze', description: 'Read the pages and surface important details.' },
  { title: 'Index', description: 'Make document passages searchable for your questions.' },
  { title: 'Ask & verify', description: 'Get grounded answers with sources you can check.' },
];

function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  if (href.endsWith('.pdf')) {
    return <a href={href} className={styles.textLink}>{children}<ArrowRight size={20} aria-hidden="true" /></a>;
  }
  return <Link href={href} className={styles.textLink}>{children}<ArrowRight size={20} aria-hidden="true" /></Link>;
}

function Illustration({ name, alt, priority = false }: { name: string; alt: string; priority?: boolean }) {
  return (
    <div className={styles.illustration}>
      <Image
        src={`/editorial/${name}.webp`}
        alt={alt}
        width={1536}
        height={1024}
        priority={priority}
        quality={90}
        sizes="(max-width: 767px) 100vw, (max-width: 1200px) 50vw, 700px"
      />
    </div>
  );
}

function DetailRows({ items }: { items: Detail[] }) {
  return (
    <ul className={styles.detailRows}>
      {items.map(({ title, description, icon: Icon, tone }) => (
        <li key={title}>
          <span className={`${styles.detailIcon} ${styles[tone]}`}><Icon size={25} strokeWidth={1.8} aria-hidden="true" /></span>
          <div><h3>{title}</h3><p>{description}</p></div>
        </li>
      ))}
    </ul>
  );
}

export function EditorialHome() {
  return (
    <div className={styles.home}>
      <a href="#main-content" className={styles.skipLink}>Skip to content</a>
      <HomeNavigation />
      <main id="main-content" className={styles.container}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <h1 id="hero-title"><span>Less searching.</span><span>More understanding.</span></h1>
            <p>Turn your PDFs into readable pages, useful insights, and answers you can trace back to the source.</p>
            <div className={styles.heroActions}>
              <Link href="/documents" className={styles.primaryLink}>Explore your PDFs</Link>
              <a href="#how-it-works" className={styles.secondaryLink}>See how it works<ArrowRight size={21} aria-hidden="true" /></a>
            </div>
          </div>
          <Illustration name="hero" alt="Layered PDF pages with a blue magnifying glass, yellow highlights, and a green source bookmark." priority />
        </section>

        <section id="applications" className={styles.applications} aria-labelledby="applications-title">
          <h2 id="applications-title">One workspace. A clearer picture.</h2>
          <div className={styles.applicationRail}>
            {applications.map(({ title, description, href, label, icon: Icon, tone }) => (
              <article key={title} className={styles.application}>
                <Icon className={styles[tone]} size={41} strokeWidth={1.6} aria-hidden="true" />
                <div><h3>{title}</h3><p>{description}</p><TextLink href={href}>{label}</TextLink></div>
              </article>
            ))}
          </div>
        </section>

        <section id="reading" className={styles.feature} aria-labelledby="reading-title">
          <div className={styles.copy}>
            <h2 id="reading-title">Every page deserves<br className={styles.desktopBreak} /> a clear reading.</h2>
            <p className={styles.lead}>Native text and neural OCR work together to read digital, scanned, and mixed PDFs. Inspect the words, layout, and extraction quality—not just the final answer.</p>
            <DetailRows items={readingDetails} />
            <p className={styles.note}>Optional cGAN enhancement needs a trained checkpoint. Original readings are retained and checked.</p>
            <TextLink href="/documents">Explore document reading</TextLink>
          </div>
          <Illustration name="reading" alt="A faded scanned page beside a structured reading with blue word boxes and a magnifying glass. Conceptual illustration, not a restoration guarantee." />
        </section>

        <section id="insights" className={`${styles.feature} ${styles.imageFirst}`} aria-labelledby="insights-title">
          <Illustration name="insights" alt="An illustrative document highlights a date and place and connects to slips for Summary, Key dates, and Important terms." />
          <div className={styles.copy}>
            <h2 id="insights-title">Find the details.<br />Keep the bigger picture.</h2>
            <p className={styles.lead}>Every-page summaries, important terms, dates, and labeled PNR values make a long PDF easier to explore.</p>
            <p className={styles.note}>Extractive summaries keep selected passages from the document. PNR lookup reads the PDF; it does not check live train status.</p>
            <TextLink href="/documents">See document insights</TextLink>
          </div>
        </section>

        <section id="answers" className={styles.feature} aria-labelledby="answers-title">
          <div className={styles.copy}>
            <h2 id="answers-title">An answer is better<br />with a source.</h2>
            <p className={styles.lead}>Ask across selected documents. Relevant passages are retrieved, reranked, and sent to Gemini with recent conversation context. Page citations help you return to the evidence.</p>
            <TextLink href="/dashboard">Start a document chat</TextLink>
          </div>
          <Illustration name="answers" alt="A green answer bubble connects to two source pages with page-number citation markers. Illustrative, not a live answer." />
        </section>

        <section id="how-it-works" className={styles.orchestration} aria-labelledby="orchestration-title">
          <h2 id="orchestration-title">Small questions.<br />Thoughtful orchestration.</h2>
          <p className={styles.lead}>Behind a simple workspace: durable jobs, owner-scoped request keys, and shared API budgets.</p>
          <ol className={styles.steps}>
            {steps.map(({ title, description }, index) => (
              <li key={title}><span className={styles.stepNumber}>{index + 1}</span><div><h3>{title}</h3><p>{description}</p></div></li>
            ))}
          </ol>
          <div className={styles.queueDetails}>
            <Illustration name="queue" alt="Paper stacks of different heights on a coral queue rail, beside a blue cache drawer and a waiting clock." />
            <DetailRows items={orchestrationDetails} />
          </div>
          <p className={styles.boundaryNote}><Info size={22} aria-hidden="true" /><span>Running jobs are not interrupted. Remote API calls are not a distributed ACID transaction.</span></p>
        </section>

        <section id="security" className={`${styles.feature} ${styles.security}`} aria-labelledby="security-title">
          <div className={styles.copy}>
            <h2 id="security-title">Clear boundaries.<br />Not blanket promises.</h2>
            <p className={styles.lead}>Owner checks, authenticated PDF access, rate limits, and encrypted workflow data protect the processing path.</p>
            <p className={styles.note}>Jobs and Redis values are encrypted. Original files and all database/vector content are not encrypted by the application. Public deployment still needs TLS, managed secrets, and workload isolation.</p>
          </div>
          <Illustration name="security" alt="A document folder, green shield, and coral key represent scoped workflow protection, not a security certification." />
        </section>

        <section id="system" className={styles.system} aria-labelledby="system-title">
          <h2 id="system-title">Built as a connected system.</h2>
          <div className={styles.stackRail}>
            <div><h3>Interface</h3><p>Next.js · React · TypeScript</p></div>
            <div><h3>Application</h3><p>Express · PostgreSQL · Drizzle</p></div>
            <div><h3>Intelligence</h3><p>FastAPI · docTR · Gemini · Qdrant</p></div>
            <div><p>Redis coordinates caches and budgets; PostgreSQL owns durable jobs.</p><TextLink href="/guides/project-architecture.pdf">Read the architecture</TextLink></div>
          </div>
        </section>

        <section className={styles.closing} aria-labelledby="closing-title">
          <h2 id="closing-title">Make room for understanding.</h2>
          <Link href="/dashboard" className={styles.primaryLink}>Open your workspace<ArrowRight size={20} aria-hidden="true" /></Link>
          <Link href="/register" className={styles.createAccount}>New here? Create an account</Link>
        </section>
      </main>
      <footer className={`${styles.container} ${styles.footer}`}>
        <div><Link href="/" className={styles.brand}><Brain aria-hidden="true" strokeWidth={1.7} /><span>DocuMind</span></Link><p>Smart PDF Orchestrator</p></div>
        <nav aria-label="Footer navigation"><a href="#applications">Applications</a><a href="/guides/project-architecture.pdf">Architecture</a><Link href="/login">Log in</Link></nav>
      </footer>
    </div>
  );
}
