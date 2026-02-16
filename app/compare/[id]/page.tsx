/* ── FEATURE FLAG ──────────────────────────────────────────────
   To disable, delete or rename this folder.
   ──────────────────────────────────────────────────────────── */

import { getThread } from '@/app/actions';
import { ComparisonGallery } from '@/components/comparison-gallery';
import { redirect } from 'next/navigation';

export default async function ComparePage(props: { params: Promise<{ id: string }> }) {
    const { id } = await props.params;
    const thread = await getThread(id);

    if (!thread || thread.length === 0) {
        redirect('/');
    }

    return <ComparisonGallery thread={thread} />;
}
