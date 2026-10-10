import type { Metadata } from 'next';
import { EditorialHome } from '@/components/home/EditorialHome';

export const metadata: Metadata = {
  title: 'DocuMind — Less searching. More understanding.',
  description:
    'Meet the Smart PDF Orchestrator: layout-aware reading, every-page summaries, important details, and document answers with page citations.',
};

export default function RootPage() {
  return <EditorialHome />;
}
