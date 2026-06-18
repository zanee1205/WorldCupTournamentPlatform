<link href="https://fonts.googleapis.com/css2?family=Oswald&display=swap" rel="stylesheet"></link>
import { useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Alert, Layout, Menu, Spin, message, Drawer, Button } from 'antd';
import { MenuOutlined } from '@ant-design/icons';

import { DashboardPage } from './pages/DashboardPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { LeaderboardPage } from './pages/LeaderboardPage.tsx';
import { MatchListPage } from './pages/MatchListPage.tsx';
import { MatchDrawer } from './components/MatchDrawer';
import { getDashboard, savePrediction } from './api.ts';


import type { DashboardResponse } from '../server/src/types/dashboardResponse.ts';
import type { TournamentMatch } from '../server/src/types/tournamentMatch.ts';
import { AIChatBubble } from './components/AIChatBubble.tsx';

import styles from './App.module.scss';

const { Header, Content, Footer } = Layout;

function Shell({
  dashboard,
  onOpenMatch,
  refreshing,
}: {
  dashboard: DashboardResponse;
  onOpenMatch: (match: TournamentMatch) => void;
  refreshing: boolean;
}) {
  const location = useLocation();
  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith('/dashboard')) {
      return 'dashboard';
    }

    if (location.pathname.startsWith('/leaderboard')) {
      return 'leaderboard';
    }

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

  const navItems = useMemo(() => [
    { key: 'home', label: <Link to="/">Homepage</Link> },
    { key: 'leaderboard', label: <Link to="/leaderboard">Leaderboard</Link> },
    { key: 'dashboard', label: <Link to="/dashboard">Dashboard</Link> },
    { key: 'matches', label: <Link to="/matches">Matches</Link> },
  ], []);

  return (
    <Layout className={styles.appShell}>
      <Header className={styles.appHeader}>
        <div className={styles.brand}>
          <img
            src='/logo.png'
            alt="logo"
            className={styles.brandMark}
          />
          <span className={styles.brandText}>Tournament Platform</span>
        </div>
        {/* Mobile menu button: render only on mobile viewport */}
        {isMobile ? (
          <Button type="text" className={styles.mobileMenuBtn} icon={<MenuOutlined style={{ color: '#fff', fontSize: 20 }} />} onClick={() => setMobileOpen(true)} />
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

        <Drawer
          title={null}
          placement="right"
          onClose={() => setMobileOpen(false)}
          open={mobileOpen}
          bodyStyle={{ padding: 0 }}
        >
          <Menu mode="inline" theme="dark" selectedKeys={[selectedKey]} items={navItems} onClick={() => setMobileOpen(false)} />
        </Drawer>
      </Header>
      <Content className={styles.appContent}>
        {refreshing ? <Alert type="info" message="Đang đồng bộ dữ liệu..." showIcon className="mb-3" /> : null}
        <Routes>
          <Route path="/" element={<HomePage dashboard={dashboard} onOpenMatch={onOpenMatch} />} />
          <Route path="/leaderboard" element={<LeaderboardPage dashboard={dashboard} />} />
          <Route path="/dashboard" element={<DashboardPage dashboard={dashboard} onOpenMatch={onOpenMatch} />} />
          <Route path="/matches" element={<MatchListPage matches={dashboard.matches} onOpenMatch={onOpenMatch} />} />
          <Route path="*" element={<Alert type="warning" message="Trang không tồn tại" showIcon />} />
        </Routes>
      </Content>
      <Footer style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.65)', background: 'transparent' }}>Demo Vite, TypeScript, Ant Design, Bootstrap, Node.js, MongoDB</Footer>
    </Layout>
  );
}

export default function App() {
  const location = useLocation();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<TournamentMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async (mode: 'initial' | 'background' = 'background') => {
    if (mode === 'initial') {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const data = await getDashboard();
      setDashboard(data);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được dữ liệu.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refresh('initial');
  }, []);

  useEffect(() => {
    const POLL_MS = 60 * 1000; // 1 minute
    const id = setInterval(() => {
      void refresh('background');
    }, POLL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!dashboard || !selectedMatch) {
      return;
    }

    const updatedMatch = dashboard.matches.find((match) => match.id === selectedMatch.id);
    if (updatedMatch && updatedMatch !== selectedMatch) {
      setSelectedMatch(updatedMatch);
    }
  }, [dashboard, selectedMatch]);

  const handleOpenMatch = (match: TournamentMatch) => {
    setSelectedMatch(match);
  };

  const handleSavePrediction = async (matchId: number, prediction: { predictedHomeScore: number; predictedAwayScore: number }) => {
    try {
      await savePrediction(matchId, prediction);
      message.success('Đã lưu dự đoán.');
      await refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể lưu dự đoán.');
    }
  };



  if (loading || !dashboard) {
    return (
      <div className={styles.loadingScreen}>
        <Spin size="large" tip="Đang tải dữ liệu lịch thi đấu..." />
      </div>
    );
  }

  return (
    <>
      <Shell dashboard={dashboard} onOpenMatch={handleOpenMatch} refreshing={refreshing} />
      <MatchDrawer
        open={Boolean(selectedMatch)}
        match={selectedMatch}
        readOnly={dashboard.summary.locked}
        onClose={() => setSelectedMatch(null)}
        onSavePrediction={handleSavePrediction}
      />
      <AIChatBubble />
    </>
  );
}

