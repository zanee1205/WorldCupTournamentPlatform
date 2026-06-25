import { useEffect } from 'react';
import { message } from 'antd';

import { appStore, type RefreshMode } from '../store/matchStore.ts';

export function refreshApp(mode: RefreshMode = 'background') {
    return appStore.refresh(mode).catch((error) => {
        message.error(error instanceof Error ? error.message : 'Không tải được dữ liệu.');
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
