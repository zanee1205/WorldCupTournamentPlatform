import React, { useEffect, useMemo, useState } from 'react';
import styles from './CountryFlag.module.scss';
import { useBreakpoint } from '../../hooks/useViewport.ts';
import { createFlagAssetPlan } from '../../services/countryFlagService.ts';

type CountryFlagProps = {
    name?: string | null;
    size?: number;
    showName?: boolean;
    className?: string;
};

export function CountryFlag({ name, size, showName = true, className }: CountryFlagProps) {
    const isMobile = useBreakpoint(480);

    const computedSize = size ?? (isMobile ? 18 : 24);
    const displayHeight = Math.max(16, Math.round(computedSize));
    const displayWidth = Math.max(24, Math.round(displayHeight * 1.6));
    const flagPlan = useMemo(() => createFlagAssetPlan(name, displayWidth), [name, displayWidth]);
    const [sourceIndex, setSourceIndex] = useState(0);

    useEffect(() => {
        setSourceIndex(0);
    }, [flagPlan.code, displayWidth]);

    if (!name) return null;

    const imgSrc = flagPlan.sources[sourceIndex] ?? null;

    return (
        <span className={`${styles.flagLabel} ${className ?? ''}`}>
            <span className={styles.flagFrame} style={{ width: displayWidth, height: displayHeight }}>
                {imgSrc ? (
                    <img
                        src={imgSrc}
                        className={styles.flag}
                        alt={`${name} flag`}
                        onError={() => setSourceIndex((index) => index + 1)}
                    />
                ) : flagPlan.emoji ? (
                    <span className={styles.flagEmoji} aria-hidden="true" style={{ fontSize: displayHeight - 4 }}>
                        {flagPlan.emoji}
                    </span>
                ) : (
                    <span className={styles.flagPlaceholder} />
                )}
            </span>
            {showName ? <span className={styles.label}>{name}</span> : null}
        </span>
    );
}

export default CountryFlag;
