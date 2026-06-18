import { useState, useEffect } from 'react';

import { Button, Card, Calendar, Empty, List, Progress, Space, Tag, Tooltip, Typography, Drawer } from 'antd';
import type { CalendarProps } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { formatDateTime } from '../../shared/date';
import styles from './HomePage.module.scss';

import type { DashboardResponse } from '../../server/src/types/dashboardResponse.ts';
import type { TournamentMatch } from '../../server/src/types/tournamentMatch.ts';
import { CountryFlag } from '../components/CountryFlag';

type HomePageProps = {
  dashboard: DashboardResponse;
  onOpenMatch: (match: TournamentMatch) => void;
};

export function HomePage({ dashboard, onOpenMatch }: HomePageProps) {
  const [monthValue, setMonthValue] = useState(dayjs());
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth <= 480 : false);
  const [drawerMatches, setDrawerMatches] = useState<TournamentMatch[] | null>(null);

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth <= 480);
    }
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const lockedProgress = Math.round((dashboard.summary.predictedMatches / dashboard.summary.totalMatches) * 100);

  const renderMatchTitle = (match: TournamentMatch) => {
    const parts = (match.title ?? '').split(/vs|VS|–|-|—/).map((p) => p.trim()).filter(Boolean);
    const home = match.homeLabel ?? parts[0] ?? match.title ?? '';
    const away = match.awayLabel ?? parts[1] ?? null;
    return (
      <span style={{ color: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <CountryFlag name={home} showName={false} />
        <span style={{ margin: '0 8px' }}>{match.title}</span>
        {away ? <CountryFlag name={away} showName={false} /> : null}
      </span>
    );
  };

  const renderMatchLabelShort = (match: TournamentMatch) => {
    const parts = (match.title ?? '').split(/vs|VS|–|-|—/).map((p) => p.trim()).filter(Boolean);
    const home = match.homeLabel ?? parts[0] ?? '';
    const away = match.awayLabel ?? parts[1] ?? '';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', overflow: 'hidden' }}>
        <CountryFlag name={home} size={isMobile ? 14 : 18} showName={false} />
        <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{home}</span>
        <span style={{ color: 'rgba(156,163,175,0.9)', fontSize: 11, margin: '0 6px' }}>vs</span>
        <CountryFlag name={away} size={isMobile ? 14 : 18} showName={false} />
        <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{away}</span>
      </div>
    );
  };


  const renderDayItems = (dateKey: string) => {
    const items = dashboard.calendar[dateKey] ?? [];

    const maxVisible = isMobile ? 1 : 2;
    const visible = items.slice(0, maxVisible);

    return (
      <>
        {visible.map((match) => (
          <div key={match.id} className={styles.calendarItem}>
            <Tooltip title={`${match.title} • ${match.stageLabel}`}>
              <button
                type="button"
                className={styles.calendarLink}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onOpenMatch(match);
                }}
              >
                <div className={styles.calendarTitle}>{renderMatchLabelShort(match)}</div>
                <div className={styles.calendarMeta}>
                  {match.timeLabel ? `${match.timeLabel} • ` : ''}
                  {match.stageLabel}
                </div>
              </button>
            </Tooltip>
          </div>
        ))}

        {items.length > maxVisible ? (
          <div
            className={styles.moreBadge}
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDrawerMatches(items);
            }}
          >
            +{items.length - maxVisible} trận
          </div>
        ) : null}
      </>
    );
  };

  const cellRender: CalendarProps<Dayjs>['cellRender'] = (current, info) => {
    if (info.type !== 'date') {
      return info.originNode;
    }

    const key = current.format('YYYY-MM-DD');
    const matches = dashboard.calendar[key] ?? [];

    return (
      <div className={styles.calendarCell}>
        <div className={styles.calendarDayBody}>{matches.length > 0 ? renderDayItems(key) : null}</div>
      </div>
    );
  };

  return (
    <Space direction="vertical" size="large" className={`w-100 ${styles.pageWrapper}`}>
      <div className={styles.heroCard}>
        <Typography.Title
          level={2}
          className="mb-2"
          style={{
            color: '#ffffff',
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 42,
            letterSpacing: 2,
          }}
        >
          Trang chủ lịch thi đấu
        </Typography.Title>
        <Typography.Paragraph
          className="mb-3"
          style={{ color: '#d2d2d2' }}
        >
          Xem các trận diễn ra trong ngày, mở chi tiết để dự đoán tỉ số, và theo dõi lịch thi đấu theo tháng.
        </Typography.Paragraph>
        <Space wrap>
          <Tag
            color={dashboard.summary.locked ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'}
            style={{
              color: dashboard.summary.locked ? '#6ee7b7' : '#fcd34d',
              border: `0.5px solid ${dashboard.summary.locked ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
            }}
          >
            {dashboard.summary.locked ? 'Đã khóa dự đoán' : 'Chưa khóa dự đoán'}
          </Tag>
          <Tag color="#0f1923" style={{ color: '#0ade57', border: '0.5px solid rgba(125,211,252,0.3)' }}>Tổng {dashboard.summary.totalMatches} trận</Tag>
          <Tag color="#0f1923" style={{ color: '#7dd3fc', border: '0.5px solid rgba(125,211,252,0.3)' }}>Đã dự đoán {dashboard.summary.predictedMatches} trận</Tag>
        </Space>
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-4">
          <Card
            title={<span style={{ color: 'rgba(145, 136, 203, 0.89)' }}>Tiến độ dự đoán</span>}
            className={styles.progressCard}
          >
            <Progress
              percent={lockedProgress}
              status={dashboard.summary.locked ? 'success' : 'active'}
              strokeColor={dashboard.summary.locked
                ? '#6ee7b7'
                : { from: '#6366f1', to: '#a5b4fc' }
              }
              trailColor="rgba(255,255,255,0.08)"
            />
            <div className={styles.progressMeta}>
              <span className={styles.progressCount}>
                {dashboard.summary.predictedMatches}
              </span>
              <span className={styles.progressTotal}>
                /{dashboard.summary.totalMatches}
              </span>
              {' '}trận đã có dự đoán.
            </div>
          </Card>
        </div>
        <div className="col-12 col-lg-4">
          <Card
            title={<span style={{ color: 'rgba(49, 227, 243, 0.89)' }}>Điểm hiện tại</span>}
            className={styles.scoreCard}
          >
            <div className={styles.scoreValue}>{dashboard.summary.totalPoints}</div>
            <div className={styles.textMuted}>Điểm được tính tự động từ dự đoán và kết quả thực tế.</div>
          </Card>
        </div>

        <div className="col-12 col-lg-4">
          <Card
            title={<span style={{ color: 'rgba(183, 195, 52, 0.89)' }}>Trận trong ngày</span>}
            className={styles.todayMatchesCard}
          >
            {dashboard.todayMatches.length === 0 ? (
              <Empty description="Chưa có trận nào trong ngày" />
            ) : (
              <List
                size="small"
                dataSource={dashboard.todayMatches}
                renderItem={(match) => (
                  <List.Item
                    actions={[
                      <Button
                        key="open"
                        type="primary"
                        onClick={() => onOpenMatch(match)}
                        className={styles.viewDetailBtn}
                      >
                        Xem chi tiết
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={renderMatchTitle(match)}
                      description={`${match.stageLabel} • ${formatDateTime(match.dateKey, match.timeLabel)}`}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </div>
      </div>

      <Card
        title={
          <div style={{ textAlign: 'center' }}>
            <span className={styles.calendarTitle}>
              🔥 Lịch thi đấu theo tháng 🔥
            </span>
          </div>
        }
        className={styles.calendarCard}
      >
        <Calendar
          fullscreen={false}
          value={monthValue}
          onPanelChange={(nextValue) => setMonthValue(nextValue)}
          onSelect={(nextValue) => {
            if (nextValue.month() === monthValue.month() && nextValue.year() === monthValue.year()) {
              setMonthValue(nextValue);
            }
          }}
          cellRender={cellRender}
        />
      </Card>

      <Drawer
        title={drawerMatches && drawerMatches.length > 0 ? `Trận ngày ${drawerMatches[0].dateKey}` : 'Trận trong ngày'}
        placement="bottom"
        height={isMobile ? '60%' : 360}
        onClose={() => setDrawerMatches(null)}
        open={drawerMatches !== null}
      >
        <List
          size="small"
          dataSource={drawerMatches ?? []}
          renderItem={(match) => (
            <List.Item
              key={match.id}
              onClick={() => {
                setDrawerMatches(null);
                onOpenMatch(match);
              }}
              style={{ cursor: 'pointer' }}
            >
              <List.Item.Meta
                title={renderMatchLabelShort(match)}
                description={`${match.stageLabel} • ${formatDateTime(match.dateKey, match.timeLabel)}`}
              />
            </List.Item>
          )}
        />
      </Drawer>
    </Space>
  );
}
