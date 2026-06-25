import { Alert, Layout } from "antd";
import { AppFooter } from "../Footer";
import { AppHeader } from "../Header";
import { Content } from "antd/es/layout/layout";
import styles from "./MainLayout.module.scss";
import { TournamentMatch } from "../../../shared/types/tournamentMatch";
import { appStore } from "../../store/appStore";
import { Outlet } from "react-router-dom";

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