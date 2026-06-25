import { apiPath } from './api.ts';

export type HighlightVideo = {
  embed?: string;
  embedId?: string;
  embedUrl?: string;
  url?: string;
  title?: string;
  thumbnail?: string;
  competition?: string;
  date?: string;
  side1?: string;
  side2?: string;
  description?: string;
};

export type HighlightResponse = {
  videos: HighlightVideo[];
  redirectUrl?: string;
  debug?: unknown;
};

function normalizeHighlightResponse(data: unknown): HighlightResponse {
  if (!data || typeof data !== 'object') {
    return { videos: [] };
  }

  const payload = data as Partial<HighlightResponse>;
  return {
    videos: Array.isArray(payload.videos) ? payload.videos : [],
    redirectUrl: typeof payload.redirectUrl === 'string' ? payload.redirectUrl : undefined,
    debug: payload.debug,
  };
}

export function resolveHighlightEmbedUrl(video?: Pick<HighlightVideo, 'embed' | 'embedUrl' | 'url'> | null): string | undefined {
  if (!video) return undefined;
  if (video.embedUrl) return video.embedUrl;
  if (!video.embed) return video.url;

  if (/^https?:\/\//i.test(video.embed)) {
    return video.embed;
  }

  const srcMatch = video.embed.match(/src=(?:"|')([^"']+)(?:"|')/i);
  if (srcMatch?.[1]) {
    return srcMatch[1].replace(/\\\//g, '/');
  }

  const embedIdMatch = video.embed.match(/embed\/v\/([A-Za-z0-9_-]+)/i);
  if (embedIdMatch?.[1]) {
    return `https://www.scorebat.com/embed/v/${embedIdMatch[1]}/`;
  }

  return video.url;
}

export async function getMatchHighlights(matchId: number): Promise<HighlightResponse> {
  const response = await fetch(apiPath(`/api/highlights/${matchId}`));
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = typeof data?.message === 'string' ? data.message : 'Không thể lấy highlight';
    throw new Error(message);
  }

  return normalizeHighlightResponse(data);
}
