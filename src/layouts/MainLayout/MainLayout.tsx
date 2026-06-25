import { Alert, Layout } from 'antd';
import { Content } from 'antd/es/layout/layout';
import { Outlet } from 'react-router-dom';

import { AppFooter } from '../Footer.tsx';
import { AppHeader } from '../Header.tsx';
import styles from './MainLayout.module.scss';
import type { TournamentMatch } from '../../../shared/types/tournamentMatch.ts';
import { appStore } from '../../store/appStore.ts';

export default function MainLayout({
    refreshing,
}: {
    dashboard?: NonNullable<typeof appStore.dashboard>;
    onOpenMatch?: (match: TournamentMatch) => void;
    refreshing?: boolean;
}) {
    return (
        <Layout className={styles.appLayout}>
            <AppHeader />
            <Content className={styles.appContent}>
                {refreshing ? <Alert type="info" message="Đang đồng bộ dữ liệu..." showIcon className="mb-3" /> : null}
                <Outlet />
            </Content>
            <AppFooter />
        </Layout>
    );
}