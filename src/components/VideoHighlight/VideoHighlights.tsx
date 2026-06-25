import React, { useEffect, useState } from 'react';
import { Button, Spin } from 'antd';
import styles from './VideoHighlights.module.scss';
import { apiPath } from '../../services/api.ts';

type VideoItem = {
    embed?: string;
    embedId?: string;
    embedUrl?: string;
    url?: string;
    title?: string;
};

export function VideoHighlights({ matchId }: { matchId: number | null }) {
    const [loading, setLoading] = useState(false);
    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [redirectUrl, setRedirectUrl] = useState<string | undefined>();
    const [error, setError] = useState<string | undefined>();

    useEffect(() => {
        if (!matchId) return;
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError(undefined);
            try {
                const res = await fetch(apiPath(`/api/highlights/${matchId}`));
                if (!res.ok) {
                    setError('Không thể lấy highlight');
                    setVideos([]);
                    setLoading(false);
                    return;
                }
                const data = await res.json();
                if (cancelled) return;
                setVideos(data.videos || []);
                setRedirectUrl(data.redirectUrl);
            } catch (err) {
                if (cancelled) return;
                setError('Lỗi kết nối');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, [matchId]);

    function extractSrc(embed?: string): string | undefined {
        if (!embed) return undefined;
        if (/^https?:\/\//i.test(embed)) return embed;
        const m = embed.match(/src=(?:"|')([^"']+)(?:"|')/i);
        if (m && m[1]) return m[1].replace(/\\\//g, '/');
        const idMatch = embed.match(/embed\/v\/([A-Za-z0-9_-]+)/i);
        if (idMatch && idMatch[1]) return `https://www.scorebat.com/embed/v/${idMatch[1]}/`;
        return undefined;
    }

    const best = videos && videos.length ? videos[0] : null;
    const src = best ? (best.embedUrl || extractSrc(best.embed) || best.url) : undefined;

    if (!matchId) return null;

    return (
        <div className={styles.container}>
            {loading && <div className={styles.loading}><Spin /> Đang tải highlight...</div>}
            {!loading && error && <div className={styles.error}>{error}</div>}
            {!loading && !error && !src && (
                <div className={styles.noVideo}>
                    Không tìm thấy video highlight.
                    {redirectUrl && (
                        <Button type="link" href={redirectUrl} target="_blank" rel="noopener noreferrer">Xem trên Scorebat</Button>
                    )}
                </div>
            )}
            {!loading && src && (
                <div className={styles.iframeWrap}>
                    <iframe src={src} title="Video highlight" frameBorder={0} allowFullScreen style={{ width: '100%', height: 360 }} />
                </div>
            )}
        </div>
    );
}

export default VideoHighlights;
