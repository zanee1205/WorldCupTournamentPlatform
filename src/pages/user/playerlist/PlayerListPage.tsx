import { useEffect, useMemo, useState } from 'react';

import { Alert, Card, Empty, Input, Pagination, Select, Skeleton, Space, Tag, Typography } from 'antd';
import { observer } from 'mobx-react-lite';

import { TeamLineupTrigger } from '../../../components/MatchLineup/TeamLineupTrigger.tsx';
import { useDebounce } from '../../../hooks/useDebounce.ts';
import { playerStore } from '../../../store/playerStore.ts';
import type { PlayerListItem } from '../../../types/playerListItem.ts';
import styles from './PlayerListPage.module.scss';

type PlayerCardMediaProps = {
  name: string;
  photo: string;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function PlayerCardMedia({ name, photo }: PlayerCardMediaProps) {
  const [errored, setErrored] = useState(false);

  if (!photo || errored) {
    return <div className={styles.photoFallback}>{initials(name)}</div>;
  }

  return <img src={photo} alt={name} className={styles.playerPhoto} onError={() => setErrored(true)} />;
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export const PlayerListPage = observer(function PlayerListPage() {
  const players: PlayerListItem[] = playerStore.players;
  const loading = playerStore.playersLoading && players.length === 0;
  const error = playerStore.playersError;
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 250);
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    void playerStore.loadPlayers().catch(() => undefined);
  }, []);

  const teamOptions = useMemo(
    () =>
      Array.from(new Set(players.map((player) => player.teamName)))
        .sort((a, b) => a.localeCompare(b, 'vi'))
        .map((teamName) => ({ label: teamName, value: teamName })),
    [players],
  );

  const filteredPlayers = useMemo(() => {
    const q = normalize(debouncedQuery);

    return players.filter((player) => {
      const matchesTeam = teamFilter === 'all' || player.teamName === teamFilter;
      const matchesQuery =
        !q ||
        normalize(player.name).includes(q) ||
        normalize(player.teamName).includes(q) ||
        normalize(player.position).includes(q) ||
        normalize(String(player.number ?? '')).includes(q);

      return matchesTeam && matchesQuery;
    });
  }, [players, debouncedQuery, teamFilter]);

  const totalTeams = teamOptions.length;
  const teamCountLabel = teamFilter === 'all' ? `${totalTeams} đội` : '1 đội';

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, teamFilter]);

  const pagePlayers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredPlayers.slice(start, start + pageSize);
  }, [filteredPlayers, page]);

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.heroCard}>
        <Typography.Title level={2} className={styles.pageTitle}>
          Player List
        </Typography.Title>
        <Typography.Paragraph className={styles.heroText}>
          Danh sách cầu thủ theo phong cách card, có tìm kiếm theo tên và lọc theo đội tuyển.
        </Typography.Paragraph>

        <Space wrap>
          <Tag color="rgba(16,185,129,0.15)" style={{ color: '#6ee7b7', border: '0.5px solid rgba(16,185,129,0.3)' }}>
            {players.length} cầu thủ
          </Tag>
          <Tag color="rgba(125,211,252,0.12)" style={{ color: '#7dd3fc', border: '0.5px solid rgba(125,211,252,0.3)' }}>
            {teamCountLabel}
          </Tag>
          <Tag color="rgba(245,158,11,0.12)" style={{ color: '#fcd34d', border: '0.5px solid rgba(245,158,11,0.3)' }}>
            {filteredPlayers.length} kết quả
          </Tag>
        </Space>
      </div>

      <Card className={styles.toolbarCard}>
        <div className={styles.toolbar}>
          <Input.Search
            allowClear
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên cầu thủ, số áo, vị trí hoặc đội"
            className={styles.searchInput}
          />

          <Select
            value={teamFilter}
            onChange={setTeamFilter}
            options={[{ label: 'Tất cả đội tuyển', value: 'all' }, ...teamOptions]}
            className={styles.teamSelect}
            popupClassName={styles.teamSelectDropdown}
          />
        </div>
      </Card>

      {error ? <Alert type="warning" showIcon message={error} className={styles.alertBox} /> : null}

      <Card className={styles.listCard}>
        {loading ? (
          <div className={styles.skeletonGrid}>
            {Array.from({ length: pageSize }).map((_, index) => (
              <Card key={index} className={styles.playerCard} bordered={false}>
                <Skeleton active paragraph={{ rows: 4 }} />
              </Card>
            ))}
          </div>
        ) : filteredPlayers.length === 0 ? (
          <Empty description="Không tìm thấy cầu thủ phù hợp" />
        ) : (
          <>
            <div className={styles.cardGrid}>
              {pagePlayers.map((player) => (
                <Card key={player.playerId} className={styles.playerCard} bordered={false}>
                  <div className={styles.cardGlow} />
                  <div className={styles.cardTop}>
                    <div className={styles.cardNumber}>{player.number != null ? `#${player.number}` : 'N/A'}</div>
                    <Tag className={styles.positionTag}>{player.position}</Tag>
                  </div>

                  <div className={styles.cardMedia}>
                    <div className={styles.photoRing}>
                      <PlayerCardMedia name={player.name} photo={player.photo} />
                    </div>
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.playerName}>{player.name}</div>
                    <div className={styles.playerMeta}>
                      <span>Tuổi: {player.age ?? 'Chưa rõ'}</span>
                      <span>Group {player.group}</span>
                      <TeamLineupTrigger name={player.teamName} size={20} showName className={styles.teamTrigger} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className={styles.paginationWrap}>
              <Pagination
                current={page}
                pageSize={pageSize}
                total={filteredPlayers.length}
                onChange={(nextPage) => setPage(nextPage)}
                showSizeChanger={false}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
});
