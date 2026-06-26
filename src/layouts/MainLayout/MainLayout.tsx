import { Alert, Layout } from 'antd';
import { Content } from 'antd/es/layout/layout';
import { observer } from 'mobx-react-lite';
import { Outlet } from 'react-router-dom';

import { MatchDrawer } from '../../components/MatchDrawer/MatchDrawer.tsx';
import { AppFooter } from '../footerSide.tsx';
import { AppHeader } from '../headerSide.tsx';
import styles from './MainLayout.module.scss';
import type { TournamentMatch } from '../../../shared/types/tournamentMatch.ts';
import { appStore } from '../../store/appStore.ts';

function MainLayout({
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
            <MatchDrawer
                open={Boolean(appStore.selectedMatch)}
                match={appStore.selectedMatch}
                readOnly={Boolean(appStore.dashboard?.summary.locked)}
                onClose={appStore.closeMatch}
                onSavePrediction={appStore.savePrediction}
            />
        </Layout>
    );
}

export default observer(MainLayout);
