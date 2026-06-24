import { Card, Progress, Statistic, Table, Tag, Typography } from 'antd';
import { observer } from 'mobx-react-lite';

import { CountryFlag } from '../../components/CountryFlagIcon/CountryFlag.tsx';
import { appStore } from '../../stores/appStore.ts';
import { getStageScore } from '../../../shared/scoring.ts';

import styles from './DashboardPage.module.scss';

export const DashboardPage = observer(function DashboardPage() {
  const dashboard = appStore.dashboard;

  if (!dashboard) {
    return null;
  }

  const lockedMessage = dashboard.summary.locked
    ? 'Read-only mode đã bật: không thể chỉnh sửa dự đoán nữa.'
    : 'Người dùng vẫn có thể cập nhật dự đoán cho đến khi đủ 104 trận.';

  const resultMatches = dashboard.matches.filter((m) => Boolean(m.result));
  const maxPossiblePoints = resultMatches.reduce((acc, m) => {
    try {
      const s = getStageScore(m.stage as any);
      return acc + (s.stagePoints + s.exactPoints);
    } catch {
      return acc;
    }
  }, 0);

  const userPoints = dashboard.summary.totalPoints ?? 0;
  const progressPercent = maxPossiblePoints > 0 ? Math.round((userPoints / maxPossiblePoints) * 100) : 0;

  const ledger = dashboard.ledger ?? [];
  const exactCount = ledger.filter((e) => e.exactPoints > 0).length;
  const trendCount = ledger.filter((e) => e.exactPoints === 0 && e.stagePoints > 0).length;
  const wrongCount = ledger.filter((e) => e.stagePoints === 0 && e.exactPoints === 0).length;
  const totalCount = ledger.length || 1;
  const exactPct = Math.round((exactCount / totalCount) * 100);
  const trendPct = Math.round((trendCount / totalCount) * 100);
  const wrongPct = Math.max(0, 100 - exactPct - trendPct);

  return (
    <div className={styles.dashboardPage}>
      <Typography.Title
        level={2}
        className="mb-2"
        style={{
          color: '#ffffff',
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 48,
          fontWeight: 800,
          letterSpacing: 2,
        }}
      >
        Dashboard
      </Typography.Title>
      <Typography.Paragraph className="mb-3" style={{ color: '#e7e7e7' }}>
        Quản lý dự đoán, nhập kết quả thực tế, và theo dõi cách điểm được cộng cho từng trận.
      </Typography.Paragraph>
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <Card className={styles.userPointCard}>
            <Statistic
              title={<span style={{ color: 'rgba(183, 195, 52, 0.89)', fontSize: 20 }}> <b>Tổng điểm User</b> </span>}
              value={dashboard.summary.totalPoints}
            />
          </Card>
        </div>
        <div className="col-12 col-md-4">
          <Card className={styles.predictedMatchCard}>
            <Statistic
              title={<span style={{ color: 'rgba(168, 160, 221, 0.89)', fontSize: 20 }}><b> Đã dự đoán </b></span>}
              value={`${dashboard.summary.predictedMatches}/${dashboard.summary.totalMatches} trận`}
            />
          </Card>
        </div>
        <div className="col-12 col-md-4">
          <Card className={styles.resultMatchCard}>
            <Statistic
              title={<span style={{ color: 'rgba(49, 227, 243, 0.89)', fontSize: 20 }}> <b> Kết quả trận đã cập nhật </b> </span>}
              value={`${dashboard.summary.resultMatches} trận`}
            />
          </Card>
        </div>
      </div>

      <Card className={styles.summaryPointCard}>
        <Tag
          color={dashboard.summary.locked ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'}
          style={{
            color: dashboard.summary.locked ? '#6ee7b7' : '#fcd34d',
            border: `0.5px solid ${dashboard.summary.locked ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
            padding: 5,
          }}
        >
          {lockedMessage}
        </Tag>
        <div className={styles.pointDisplay}>
          Điểm xu hướng: {dashboard.summary.stagePoints}
          <br />
          Điểm tỉ số chính xác: {dashboard.summary.exactPoints}
        </div>
      </Card>

      <Card className={styles.historyStatsCard}>
        <div className={styles.statsGrid}>
          <div className={styles.statsPanel}>
            <div className={styles.statsPanelTitle}>
              So sánh điểm User với tổng điểm tối đa
              <span className={styles.textMuted}> · {resultMatches.length} trận đã có kết quả</span>
            </div>

            <Progress
              percent={progressPercent}
              strokeColor={{ '0%': '#60a5fa', '100%': '#10b981' }}
              trailColor="rgba(255,255,255,0.06)"
              strokeWidth={14}
              showInfo={false}
              className={styles.pointsProgress}
            />

            <div className={styles.chartSummary}>
              <div className={styles.chartStatBox}>
                <div className={styles.statValue}>{userPoints}</div>
                <div className={styles.statLabel}>Điểm User</div>
              </div>
              <div className={styles.chartStatBox}>
                <div className={styles.statValue}>{maxPossiblePoints}</div>
                <div className={styles.statLabel}>Tối đa</div>
              </div>
              <div className={styles.chartStatBox}>
                <div className={styles.statValue}>{progressPercent}%</div>
                <div className={styles.statLabel}>Tiến độ</div>
              </div>
            </div>
          </div>

          <div className={styles.statsPanel}>
            <div className={styles.statsPanelTitle}>Phân bố kết quả dự đoán</div>

            <div className={styles.stackBar}>
              <div className={styles.segmentExact} style={{ width: `${exactPct}%` }} />
              <div className={styles.segmentTrend} style={{ width: `${trendPct}%` }} />
              <div className={styles.segmentWrong} style={{ width: `${wrongPct}%` }} />
            </div>

            <div className={styles.legendRow}>
              <span><i className={styles.legendDotExact} />Đúng tỉ số <b>{exactCount}</b> ({exactPct}%)</span>
              <span><i className={styles.legendDotTrend} />Đúng xu hướng <b>{trendCount}</b> ({trendPct}%)</span>
              <span><i className={styles.legendDotWrong} />Sai xu hướng <b>{wrongCount}</b> ({wrongPct}%)</span>
            </div>
          </div>
        </div>
      </Card>

      <Card
        title={<span style={{ color: 'rgba(243, 49, 49, 0.89)', fontSize: 25 }}> <b> Lịch sử tính điểm </b> </span>}
        className={styles.scoreHistoryCard}
      >
        <Table
          rowKey="matchId"
          columns={[
            { title: 'Trận', dataIndex: 'matchId', width: 90 },
            { title: 'Ngày', dataIndex: 'dateKey', width: 120 },
            {
              title: 'Mô tả',
              dataIndex: 'title',
              render: (title: string) => {
                const parts = (title ?? '').split(/vs|VS|â€“|-|â€”/).map((p) => p.trim()).filter(Boolean);
                const home = parts[0] ?? title;
                const away = parts[1] ?? null;
                return (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CountryFlag name={home} showName={false} />
                    <span>{title}</span>
                    {away ? <CountryFlag name={away} showName={false} /> : null}
                  </span>
                );
              },
            },
            { title: 'Dự đoán', dataIndex: 'predictionText', width: 120 },
            { title: 'Kết quả', dataIndex: 'resultText', width: 120 },
            { title: 'Xu hướng', dataIndex: 'trendText', width: 160 },
            {
              title: 'Điểm',
              dataIndex: 'totalPoints',
              width: 100,
              render: (value) => <span className={styles.totalPointsCell}>{value}</span>,
            },
          ]}
          dataSource={ledger}
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </div>
  );
});
