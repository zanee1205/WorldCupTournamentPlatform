import React, { useMemo, useState, useEffect } from 'react';
import styles from './CountryFlag.module.scss';
import { COUNTRY_FLAG_CODE } from '../../../server/src/mappings/countryFlagCode.ts';
import { apiPath } from '../../services/api.ts';

type CountryFlagProps = {
    name?: string | null;
    // height in px for the flag frame
    size?: number;
    showName?: boolean;
    className?: string;
};

function normalizeName(s: string) {
    return s
        .replace(/\s*\(.*?\)\s*/g, ' ')
        .replace(/&/g, ' and ')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

const NORMALIZED_MAP: Record<string, string> = {};
Object.keys(COUNTRY_FLAG_CODE).forEach((k) => {
    try {
        const nk = normalizeName(k);
        NORMALIZED_MAP[nk] = COUNTRY_FLAG_CODE[k];
    } catch {
        // ignore
    }
});

const ENGLISH_NAME_MAP: Record<string, string> = {
    'united states': 'us',
    'united states of america': 'us',
    'usa': 'us',
    'south africa': 'za',
    'south korea': 'kr',
    'korea republic': 'kr',
    'czech republic': 'cz',
    'czechia': 'cz',
    'england': 'gb-eng',
    'ivory coast': 'ci',
    "cote divoire": 'ci',
    "cote d'ivoire": 'ci',
    'côte d\'ivoire': 'ci',
    'dr congo': 'cd',
    'democratic republic of the congo': 'cd',
    'cape verde': 'cv',
    'austria': 'at',
    'norway': 'no',
    'scotland': 'gb-sct',
    'bosnia herzegovina': 'ba',
    'switzerland': 'ch',
    'portugal': 'pt',
    'egypt': 'eg',
    'belgium': 'be',
    'spain': 'es',
    'france': 'fr',
    'turkey': 'tr',
    'netherlands': 'nl',
    'sweden': 'se',
    'japan': 'jp',
    'germany': 'de',
};

function findCodeForName(name?: string | null) {
    if (!name) return null;

    const direct = COUNTRY_FLAG_CODE[name];
    if (direct) return direct;

    const n = normalizeName(name);
    if (NORMALIZED_MAP[n]) return NORMALIZED_MAP[n];
    if (ENGLISH_NAME_MAP[n]) return ENGLISH_NAME_MAP[n];

    const parts = name.split(/vs|VS|–|-|—/).map((p) => p.trim()).filter(Boolean);
    for (const p of parts) {
        const nn = normalizeName(p);
        const d = COUNTRY_FLAG_CODE[p] || NORMALIZED_MAP[nn] || ENGLISH_NAME_MAP[nn];
        if (d) return d;
    }

    const first = name.split(' ')[0];
    const nf = normalizeName(first);
    return COUNTRY_FLAG_CODE[first] || NORMALIZED_MAP[nf] || ENGLISH_NAME_MAP[nf] || null;
}

export function CountryFlag({ name, size, showName = true, className }: CountryFlagProps) {
    const [errored, setErrored] = useState(false);
    const code = useMemo(() => findCodeForName(name ?? undefined), [name]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            // eslint-disable-next-line no-console
            console.debug('[CountryFlag] name=', name, 'code=', code);
        }
    }, [name, code]);

    const [isMobile, setIsMobile] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth <= 480 : false);
    useEffect(() => {
        function onResize() {
            setIsMobile(window.innerWidth <= 480);
        }
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const computedSize = size ?? (isMobile ? 18 : 24);
    const displayHeight = Math.max(16, Math.round(computedSize));
    const displayWidth = Math.max(24, Math.round(displayHeight * 1.6));

    // Prefer serving local assets from `public/flags/*.svg` (served at `/flags/` by Vite).
    // If the local SVG is missing or fails, fall back to the server proxy `/api/flag`,
    // then to the CDN PNG as a last resort.
    const [imgSrc, setImgSrc] = useState<string | null>(() => (code ? `../../assets/flags/${code}.svg` : null));

    useEffect(() => {
        if (!code) {
            setImgSrc(null);
            return;
        }
        setImgSrc(`../../assets/flags/${code}.svg`);
        setErrored(false);
    }, [code, displayWidth]);

    const emoji = useMemo(() => {
        if (!code) return null;
        const iso = code.split('-')[0];
        if (!iso || iso.length < 2) return null;
        const up = iso.slice(0, 2).toUpperCase();
        try {
            return Array.from(up).map((c) => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');
        } catch {
            return null;
        }
    }, [code]);

    const handleImgError = () => {
        if (!imgSrc) return;
        if (imgSrc.startsWith('/flags/')) {
            // local public SVG missing or blocked — try proxy
            if (code) {
                setImgSrc(apiPath(`/api/flag/${code}?size=${displayWidth}`));
                return;
            }
        }
        if (imgSrc.includes('/api/flag')) {
            // proxy failed — try CDN PNG
            if (code) {
                setImgSrc(`https://flagcdn.com/w${displayWidth}/${code}.png`);
                return;
            }
        }
        setErrored(true);
    };

    if (!name) return null;

    return (
        <span className={`${styles.flagLabel} ${className ?? ''}`}>
            <span className={styles.flagFrame} style={{ width: displayWidth, height: displayHeight }}>
                {imgSrc && !errored ? (
                    <img src={imgSrc} className={styles.flag} alt={`${name} flag`} onError={handleImgError} />
                ) : emoji ? (
                    <span className={styles.flagEmoji} aria-hidden="true" style={{ fontSize: displayHeight - 4 }}>{emoji}</span>
                ) : (
                    <span className={styles.flagPlaceholder} />
                )}
            </span>
            {showName ? <span className={styles.label}>{name}</span> : null}
        </span>
    );
}

export default CountryFlag;
