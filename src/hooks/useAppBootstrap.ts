import { useEffect } from 'react';
import { message } from 'antd';

import { authStore } from '../store/authStore.ts';

export function refreshApp() {
    return authStore.bootstrap().catch((error) => {
        message.error(error instanceof Error ? error.message : 'Không thể xác thực phiên đăng nhập.');
        throw error;
    });
}

export function useAppBootstrap() {
    useEffect(() => {
        void refreshApp();
    }, []);
}
