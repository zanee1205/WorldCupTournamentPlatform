import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Alert, Button, Layout, Spin, message } from 'antd';
import { observer } from 'mobx-react-lite';

import { AIChatBubble } from './components/AiChatBubble/AIChatBubble.tsx';
import { MatchDrawer } from './components/MatchDrawer/MatchDrawer.tsx';
import { AppFooter } from './layouts/footer.tsx';
import { AppHeader } from './layouts/header.tsx';
import { DashboardPage } from './pages/dashboard/DashboardPage.tsx';
import { HomePage } from './pages/homepage/HomePage.tsx';
import { LeaderboardPage } from './pages/leaderboard/LeaderboardPage.tsx';
import { MatchListPage } from './pages/matchlist/MatchListPage.tsx';
import { PlayerListPage } from './pages/playerlist/PlayerListPage.tsx';
import styles from './App.module.scss';
import { appStore } from './store/matchStore.ts';

import type { TournamentMatch } from '../server/src/types/tournamentMatch.ts';

const { Content } = Layout;

function Shell({
  dashboard,
  onOpenMatch,
  refreshing,
}: {
  dashboard: NonNullable<typeof appStore.dashboard>;
  onOpenMatch: (match: TournamentMatch) => void;
  refreshing: boolean;
}) {
  return (
    <Layout className={styles.appShell}>
      <AppHeader dashboard={dashboard} onOpenMatch={onOpenMatch} />

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

      <AppFooter />
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
