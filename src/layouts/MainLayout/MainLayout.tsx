import { Alert, Layout } from 'antd';
import { Content } from 'antd/es/layout/layout';
import { observer } from 'mobx-react-lite';
import { Outlet } from 'react-router-dom';

import { AIChatBubble } from '../../components/AiChatBubble/AIChatBubble.tsx';
import { MatchDrawer } from '../../components/MatchDrawer/MatchDrawer.tsx';
import { AppFooter } from '../footerSide.tsx';
import { AppHeader } from '../headerSide.tsx';
import styles from './MainLayout.module.scss';
import { appStore } from '../../store/appStore.ts';

function MainLayout({
    refreshing,
}: {
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
                readOnly={Boolean(appStore.summary?.locked)}
                onClose={appStore.closeMatch}
                onSavePrediction={appStore.savePrediction}
            />
            <AIChatBubble />
        </Layout>
    );
}

export default observer(MainLayout);
