import { useEffect } from 'react';
import { message } from 'antd';

import { appStore } from '../store/matchStore.ts';
import type { RefreshMode } from '../store/matchStore.types.ts';

export function refreshApp(mode: RefreshMode = 'background') {
    return appStore.loadShell(mode).catch((error) => {
        message.error(error instanceof Error ? error.message : 'KhÃ´ng táº£i Ä‘Æ°á»£c dá»¯ liá»‡u.');
        throw error;
    });
}

export function useAppBootstrap() {
    useEffect(() => {
        void refreshApp('initial');
    }, []);

    useEffect(() => {
        const POLL_MS = 60 * 1000;
        const id = window.setInterval(() => {
            void refreshApp('background');
        }, POLL_MS);

        return () => window.clearInterval(id);
    }, []);
}
