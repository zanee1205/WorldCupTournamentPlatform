import { useEffect, useState } from 'react';
import { Button, Spin } from 'antd';
import styles from './VideoHighlights.module.scss';
import { getMatchHighlights, resolveHighlightEmbedUrl, type HighlightVideo } from '../../services/highlightService.ts';

export function VideoHighlights({ matchId }: { matchId: number }) {
    const [loading, setLoading] = useState(false);
    const [videos, setVideos] = useState<HighlightVideo[]>([]);
    const [redirectUrl, setRedirectUrl] = useState<string | undefined>();
    const [error, setError] = useState<string | undefined>();

    useEffect(() => {
        if (!matchId) return;
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError(undefined);
            try {
                const data = await getMatchHighlights(matchId);
                if (cancelled) return;
                setVideos(data.videos || []);
                setRedirectUrl(data.redirectUrl);
            } catch (err) {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'Lỗi kết nối');
                setVideos([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [matchId]);

    const best = videos && videos.length ? videos[0] : null;
    const src = resolveHighlightEmbedUrl(best);

    if (!matchId) return null;

    return (
        <div className={styles.container}>
            {loading && <div className={styles.loading}><Spin /> Đang tải highlight...</div>}
            {!loading && error && <div className={styles.error}>{error}</div>}
            {!loading && !error && !src && (
                <div className={styles.noVideo}>
                    Không tìm thấy video highlight.
                    {redirectUrl && (
                        <Button type="link" href={redirectUrl} target="_blank" rel="noopener noreferrer">
                            Xem trên Scorebat
                        </Button>
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
