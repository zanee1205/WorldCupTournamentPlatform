import { Button, Card, Table, Tag, Input, Space, Typography, Statistic } from 'antd';
import type { TableColumnsType } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';

import { formatDateTime } from '../../../shared/date.js';
import type { PaginationState } from '../../types/paginationstate.ts';
import type { TournamentMatch } from '../../../shared/types/tournamentMatch.ts';
import { appStore } from '../../store/matchStore.ts';

import styles from './MatchListPage.module.scss';
import { TeamLineupTrigger } from '../../components/MatchLineup/TeamLineupTrigger.tsx';

export const MatchListPage = observer(function MatchListPage() {
  const dashboard = appStore.dashboard;
  const matches = dashboard?.matches ?? [];

  const resultMatchesCount = useMemo(
    () => matches.filter((m) => Boolean(m.result)).length,
    [matches],
  );

  const [pagination, setPagination] = useState<PaginationState>({
    current: 1,
    pageSize: 12,
    total: matches.length,
  });

  const [stageFilter, setStageFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');

  const columns: TableColumnsType<TournamentMatch> = [
    {
      title: 'Trận',
      dataIndex: 'id',
      width: 80,
      render: (value, match) => (
        <Button type="link" onClick={() => appStore.openMatch(match)}>
          #{value}
        </Button>
      ),
    },
    {
      title: 'Lịch',
      render: (_, match) => (
        <div>
          <div>{formatDateTime(match.dateKey, match.timeLabel)}</div>
          <div className={styles.textMuted}>{match.stageLabel}</div>
        </div>
      ),
    },
    {
      title: 'Cặp đấu',
      dataIndex: 'title',
      render: (value, match) => {
        const home = match.homeLabel ?? (match.title?.split(' vs ')[0] ?? '');
        const away = match.awayLabel ?? (match.title?.split(' vs ')[1] ?? '');
        return (
          <div>
            <div>
              <TeamLineupTrigger name={home} size={24} />
              <span style={{ margin: '0 8px', color: '#9CA3AF' }}>vs</span>
              <TeamLineupTrigger name={away} size={24} />
            </div>
            <div className={styles.textMuted}>{match.note ?? 'Chưa có ghi chú'}</div>
          </div>
        );
      },
    },
    {
      title: 'Dự đoán',
      render: (_, match) => (match.prediction ? `${match.prediction.predictedHomeScore} - ${match.prediction.predictedAwayScore}` : 'Chưa có'),
    },
    {
      title: 'Kết quả',
      render: (_, match) => (match.result ? `${match.result.actualHomeScore} - ${match.result.actualAwayScore}` : 'Chưa nhập'),
    },
    {
      title: 'Điểm',
      render: (_, match) =>
        match.score ? (
          <Tag
            color="#0f1923"
            style={{ color: '#7dd3fc', border: '0.5px solid rgba(125,211,252,0.3)', fontSize: 12, fontStyle: 'bold' }}
          >
            {`${match.score.totalPoints} điểm`}
          </Tag>
        ) : (
          <Tag
            color="rgba(245,158,11,0.15)"
            style={{ color: '#f59e0b', border: '0.5px solid rgba(245,158,11,0.3)', fontSize: 12, fontStyle: 'bold' }}
          >
            Chưa tính
          </Tag>
        ),
    },
    {
      title: 'Hành động',
      render: (_, match) => (
        <Button
          type="dashed"
          onClick={() => appStore.openMatch(match)}
          className={styles.viewDetailBtn}
          style={{ color: '#ffffff', border: '0.5px solid rgba(125,211,252,0.3)', fontSize: 12, fontStyle: 'bold' }}
        >
          Chi tiết
        </Button>
      ),
    },
  ];

  const filteredMatches = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    const byStage = stageFilter === 'all' ? matches : matches.filter((m) => m.stage === stageFilter);

    const bySearch = q
      ? byStage.filter((m) =>
        (m.homeLabel ?? '').toLowerCase().includes(q) ||
        (m.awayLabel ?? '').toLowerCase().includes(q) ||
        (m.title ?? '').toLowerCase().includes(q),
      )
      : byStage.slice();

    const dateKey = (m: TournamentMatch) => `${m.dateKey} ${m.timeLabel ?? '00:00'}`;

    bySearch.sort((a, b) => {
      const ka = dateKey(a);
      const kb = dateKey(b);
      if (ka < kb) return -1;
      if (ka > kb) return 1;
      return a.id - b.id;
    });

    const allEarliest = matches.slice().sort((a, b) => {
      const ka = `${a.dateKey} ${a.timeLabel ?? '00:00'}`;
      const kb = `${b.dateKey} ${b.timeLabel ?? '00:00'}`;
      if (ka < kb) return -1;
      if (ka > kb) return 1;
      return a.id - b.id;
    })[0];

    if (allEarliest) {
      const idx = bySearch.findIndex((m) => m.id === allEarliest.id);
      if (idx > 0) {
        const [om] = bySearch.splice(idx, 1);
        bySearch.unshift(om);
      }
    }

    return bySearch;
  }, [matches, stageFilter, searchText]);

  useEffect(() => {
    setPagination((p) => ({ ...p, total: filteredMatches.length, current: 1 }));
  }, [filteredMatches.length]);

  if (!dashboard) {
    return null;
  }

  return (
    <div>
      <Typography.Title
        level={2}
        className="mb-2"
        style={{
          color: '#ffffff',
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 45,
          fontWeight: 800,
          letterSpacing: 2,
          textAlign: 'center',
          marginTop: 20,
          marginBottom: 20,
        }}
      >
        Danh sách các trận cầu World Cup 2026
      </Typography.Title>
      <div className="row">
        <div className="col-12 col-md-6">
          <Card className={styles.resultMatchCard}>
            <Statistic
              title={<span style={{ color: 'rgba(49, 227, 243, 0.89)', fontSize: 20 }}> <b>Kết quả trận đã cập nhật (ghi nhận theo lịch đá quốc tế)</b> </span>}
              value={`${resultMatchesCount}/104 trận đấu`}
            />
          </Card>
        </div>

        <div className="col-12 col-md-6">
          <Card className={styles.notificationCard}>
            <Tag
              color="rgba(245,158,11,0.15)"
              style={{
                color: '#fcd34d',
                border: `0.5px solid rgba(245,158,11,0.3)`,
                padding: 5,
              }}
            >
              Note: Điểm số sẽ được cập nhật liên tục sau khi các trận đấu kết thúc.
            </Tag>
            <div className={styles.pointDisplay}>
              Xem thứ hạng các đội tuyển trên trang Leaderboard, được tính toán trực tiếp dựa trên kết quả thực tế.
            </div>
          </Card>
        </div>
      </div>
      <Card className={styles.tableCard}>
        <div className={`mb-3 ${styles.searchBar}`}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <Input.Search
                placeholder="Tìm theo tên đội (ví dụ: Australia)"
                allowClear
                onSearch={(v) => setSearchText(v)}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ minWidth: 320 }}
              />
            </Space>
          </Space>
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredMatches}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: (page, pageSize) => setPagination((prev) => ({ ...prev, current: page, pageSize })),
          }}
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </div>
  );
});
