<link href="https://fonts.googleapis.com/css2?family=Oswald&display=swap" rel="stylesheet"></link>
import { useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Alert, Layout, Menu, Spin, message, Drawer, Button } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import { observer } from 'mobx-react-lite';

import NotificationBell from './components/NotificationSide/NotificationBell.tsx';
import { AIChatBubble } from './components/AiChatBubble/AIChatBubble.tsx';
import { MatchDrawer } from './components/MatchDrawer/MatchDrawer.tsx';
import { DashboardPage } from './pages/dashboard/DashboardPage.tsx';
import { HomePage } from './pages/homepage/HomePage.tsx';
import { LeaderboardPage } from './pages/leaderboard/LeaderboardPage.tsx';
import { MatchListPage } from './pages/matchlist/MatchListPage.tsx';
import { PlayerListPage } from './pages/playerlist/PlayerListPage.tsx';
import styles from './App.module.scss';
import { appStore } from './stores/appStore.ts';

import type { TournamentMatch } from '../server/src/types/tournamentMatch.ts';

const { Header, Content, Footer } = Layout;

function Shell({
  dashboard,
  onOpenMatch,
  refreshing,
}: {
  dashboard: NonNullable<typeof appStore.dashboard>;
  onOpenMatch: (match: TournamentMatch) => void;
  refreshing: boolean;
}) {
  const location = useLocation();
  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith('/dashboard')) return 'dashboard';
    if (location.pathname.startsWith('/leaderboard')) return 'leaderboard';
    if (location.pathname.startsWith('/list')) return 'list';
    return 'home';
  }, [location.pathname]);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth <= 768);
    }

    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const navItems = useMemo(
    () => [
      { key: 'home', label: <Link to="/">Homepage</Link> },
      { key: 'leaderboard', label: <Link to="/leaderboard">Leaderboard</Link> },
      { key: 'list', label: <Link style={{ padding: '0 35px ' }} to="/list">List</Link> },
      { key: 'dashboard', label: <Link to="/dashboard">Dashboard</Link> },
      { key: 'matches', label: <Link to="/matches">Matches</Link> },
    ],
    [],
  );

  return (
    <Layout className={styles.appShell}>
      <Header className={styles.appHeader}>
        <div className={styles.brand}>
          <img src="/logo.png" alt="logo" className={styles.brandMark} />
          <span className={styles.brandText}>Tournament Platform</span>
        </div>

        {isMobile ? (
          <Button
            type="text"
            className={styles.mobileMenuBtn}
            icon={<MenuOutlined style={{ color: '#fff', fontSize: 20 }} />}
            onClick={() => setMobileOpen(true)}
          />
        ) : null}

        {!isMobile ? (
          <Menu
            style={{ flex: 1, justifyContent: 'flex-end', minWidth: 300 }}
            theme="dark"
            mode="horizontal"
            selectedKeys={[selectedKey]}
            items={navItems}
          />
        ) : null}

        <div className={styles.headerActions}>
          <NotificationBell matches={dashboard.todayMatches} onOpenMatch={onOpenMatch} />
        </div>

        <Drawer
          title={null}
          placement="right"
          onClose={() => setMobileOpen(false)}
          open={mobileOpen}
          bodyStyle={{ padding: 0 }}
        >
          <Menu
            mode="inline"
            theme="dark"
            selectedKeys={[selectedKey]}
            items={navItems}
            onClick={() => setMobileOpen(false)}
          />
        </Drawer>
      </Header>

      <Content className={styles.appContent}>
        {refreshing ? <Alert type="info" message="Đang đồng bộ dữ liệu..." showIcon className="mb-3" /> : null}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/list" element={<PlayerListPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/matches" element={<MatchListPage />} />
          <Route path="*" element={<Alert type="warning" message="Trang không tồn tại" showIcon />} />
        </Routes>
      </Content>

      <Footer style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.65)', background: 'transparent' }}>
        Demo Vite, TypeScript, Ant Design, Bootstrap, Node.js, MongoDB
      </Footer>
    </Layout>
  );
}

export default observer(function App() {
  useEffect(() => {
    void appStore.refresh('initial').catch((error) => {
      message.error(error instanceof Error ? error.message : 'Không tải được dữ liệu.');
    });
  }, []);

  useEffect(() => {
    const POLL_MS = 60 * 1000;
    const id = setInterval(() => {
      void appStore.refresh('background').catch((error) => {
        message.error(error instanceof Error ? error.message : 'Không tải được dữ liệu.');
      });
    }, POLL_MS);

    return () => clearInterval(id);
  }, []);

  const handleOpenMatch = (match: TournamentMatch) => {
    appStore.openMatch(match);
  };

  const handleSavePrediction = async (
    matchId: number,
    prediction: { predictedHomeScore: number; predictedAwayScore: number },
  ) => {
    try {
      await appStore.savePrediction(matchId, prediction);
      message.success('Đã lưu dự đoán.');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể lưu dự đoán.');
    }
  };

  if (appStore.loading && !appStore.dashboard) {
    return (
      <div className={styles.loadingScreen}>
        <Spin size="large" tip="Đang tải dữ liệu lịch thi đấu..." />
      </div>
    );
  }

  if (!appStore.dashboard) {
    return (
      <div className={styles.loadingScreen}>
        <Alert
          type="error"
          showIcon
          message="Không tải được dữ liệu."
          description={appStore.errorMessage ?? 'Vui lòng thử lại.'}
          action={
            <Button
              type="primary"
              onClick={() => {
                void appStore.refresh('initial').catch((error) => {
                  message.error(error instanceof Error ? error.message : 'Không tải được dữ liệu.');
                });
              }}
            >
              Thử lại
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <>
      <Shell dashboard={appStore.dashboard} onOpenMatch={handleOpenMatch} refreshing={appStore.refreshing} />
      {appStore.errorMessage && !appStore.loading ? (
        <div style={{ padding: '0 24px 12px' }}>
          <Alert type="warning" showIcon message={appStore.errorMessage} />
        </div>
      ) : null}
      <MatchDrawer
        open={Boolean(appStore.selectedMatch)}
        match={appStore.selectedMatch}
        readOnly={appStore.dashboard.summary.locked}
        onClose={appStore.closeMatch}
        onSavePrediction={handleSavePrediction}
      />
      <AIChatBubble />
    </>
  );
});
