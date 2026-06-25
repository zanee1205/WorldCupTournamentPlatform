import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { OpenFootballJson } from '../types/OpenFootballJson';
import type { WorldCupData } from '../types/worldCupData';
import { normalizeWorldcupData } from '../utils/scoreResultFormat';

type WorldcupDataContextValue = {
    data: WorldCupData | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
};

const WorldcupDataContext = createContext<WorldcupDataContextValue | undefined>(undefined);

const WORLD_CUP_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function WorldcupDataProvider({ children }: { children: React.ReactNode }) {
    const [data, setData] = useState<WorldCupData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 8000);

        try {
            const response = await fetch(WORLD_CUP_URL, {
                signal: controller.signal,
                mode: 'cors',
            });

            if (!response.ok) {
                throw new Error(`Không thể tải dữ liệu World Cup: ${response.status}`);
            }

            const json = (await response.json()) as OpenFootballJson;
            const normalized = normalizeWorldcupData(json, WORLD_CUP_URL);
            setData(normalized);
        } catch (fetchError) {
            if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
                setError('Tải dữ liệu World Cup bị timeout, vui lòng thử lại.');
            } else {
                setError(fetchError instanceof Error ? fetchError.message : 'Không thể tải dữ liệu World Cup');
            }
        } finally {
            window.clearTimeout(timeoutId);
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchData();

        const timer = window.setInterval(() => {
            void fetchData();
        }, REFRESH_INTERVAL_MS);

        return () => window.clearInterval(timer);
    }, [fetchData]);

    const value = useMemo<WorldcupDataContextValue>(
        () => ({
            data,
            loading,
            error,
            refresh: fetchData,
        }),
        [data, error, fetchData, loading],
    );

    return <WorldcupDataContext.Provider value={value}>{children}</WorldcupDataContext.Provider>;
}

export function useWorldcupData() {
    const context = useContext(WorldcupDataContext);
    if (!context) {
        throw new Error('useWorldcupData must be used within WorldcupDataProvider');
    }
    return context;
}
