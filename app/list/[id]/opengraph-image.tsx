
import { ImageResponse } from 'next/og';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export const alt = 'Rank and File List Preview';
export const size = {
    width: 1200,
    height: 630,
};

export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
    const supabase = await createClient();
    const { id } = await params;

    // Fetch List Data
    const { data: list } = await supabase
        .from('lists')
        .select(`
        *,
        profiles:user_id (username, display_name),
        list_items (*)
    `)
        .eq('id', id)
        .single();

    if (!list) {
        return new ImageResponse(
            (
                <div
                    style={{
                        fontSize: 40,
                        color: 'white',
                        background: 'black',
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    Rank and File
                </div>
            ),
            { ...size }
        );
    }

    // Sort and get top 3 items
    const topItems = (list.list_items || [])
        .sort((a: any, b: any) => a.rank - b.rank)
        .slice(0, 3);

    const categoryColors: Record<string, string> = {
        music: '#2563eb', // blue-600
        movies: '#9333ea', // purple-600
        food: '#16a34a', // green-600 (was restaurants)
        places: '#0ea5e9', // sky-500
        books: '#b45309', // amber-700
        more: '#475569', // slate-600
        other: '#475569', // slate-600
    };

    const accentColor = categoryColors[list.category] || categoryColors.other;

    return new ImageResponse(
        (
            <div
                style={{
                    background: 'white',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 60,
                    justifyContent: 'space-between',
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{
                            fontSize: 24,
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            color: accentColor,
                            marginBottom: 10
                        }}>
                            {list.category}
                        </div>
                        <div style={{
                            fontSize: 60,
                            fontWeight: 900,
                            color: 'black',
                            lineHeight: 1,
                            textTransform: 'uppercase',
                            letterSpacing: '-0.03em',
                            maxWidth: 900,
                        }}>
                            {list.title}
                        </div>
                    </div>
                    <div style={{
                        fontSize: 32,
                        fontWeight: 900,
                        color: '#94a3b8', // slate-400
                        textTransform: 'uppercase',
                    }}>
                        @{list.profiles?.username}
                    </div>
                </div>

                {/* Top Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {topItems.map((item: any, index: number) => (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                            <div style={{
                                fontSize: 40,
                                fontWeight: 900,
                                color: '#e2e8f0', // slate-200
                                width: 50,
                                textAlign: 'right'
                            }}>
                                #{index + 1}
                            </div>
                            {item.metadata?.imageUrl && (
                                <img
                                    src={item.metadata.imageUrl}
                                    width="60"
                                    height="60"
                                    style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0' }}
                                />
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{
                                    fontSize: 32,
                                    fontWeight: 900,
                                    color: 'black',
                                    textTransform: 'uppercase',
                                    maxWidth: 800,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {item.metadata?.name}
                                </div>
                                {item.metadata?.subtitle && (
                                    <div style={{
                                        fontSize: 16,
                                        fontWeight: 700,
                                        color: '#94a3b8',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}>
                                        {item.metadata.subtitle}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    borderTop: '4px solid black',
                    paddingTop: 20
                }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: 'black' }}>RANK & FILE</div>
                    <div style={{ fontSize: 20, color: '#64748b' }}>rankandfile.app</div>
                </div>
            </div>
        ),
        {
            ...size,
        }
    );
}
