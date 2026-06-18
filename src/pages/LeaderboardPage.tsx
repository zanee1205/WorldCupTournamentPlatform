import { Card, Table, Tag, Typography, Space } from 'antd';
import type { TableColumnsType } from 'antd';

import type { DashboardResponse } from '../../server/src/types/dashboardResponse.ts';
import type { GroupStandingTeam } from '../../server/src/types/groupStanding.ts';

import styles from './LeaderboardPage.module.scss';
import { CountryFlag } from '../components/CountryFlag';

type LeaderboardPageProps = {
  dashboard: DashboardResponse;
};

const columns: TableColumnsType<GroupStandingTeam> = [
  {
    title: 'Ranking',
    dataIndex: 'rank',
    width: 130,
    align: 'center',
    render: (rank: number) => <Tag style={{ fontSize: 14 }} color={rank <= 2 ? 'red' : rank === 3 ? 'gold' : 'default'}><b>{rank}</b></Tag>,
  },
  {
    title: 'Đội',
    dataIndex: 'teamName',
    render: (teamName: string) => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <CountryFlag name={teamName} size={24} showName={false} />
        <strong>{teamName}</strong>
      </span>
    ),
  },
  {
    title: 'Điểm',
    dataIndex: 'points',
    width: 78,
    align: 'center',
    render: (points: number) => <strong>{points}</strong>,
  },
  {
    title: 'Hiệu số',
    dataIndex: 'goalDifference',
    width: 70,
    align: 'center',
    render: (goalDifference: number) => (goalDifference > 0 ? `+${goalDifference}` : goalDifference),
  },
  {
    title: 'Thắng-Hòa-Thua',
    width: 150,
    align: 'center',
    render: (_, team) => `${team.wins} - ${team.draws} - ${team.losses}`,
  },
  {
    title: 'Bàn thắng',
    dataIndex: 'goalsFor',
    width: 120,
    align: 'center',
  },
  {
    title: 'Bàn thua',
    dataIndex: 'goalsAgainst',
    width: 120,
    align: 'center',
  },
];

export function LeaderboardPage({ dashboard }: LeaderboardPageProps) {
  return (
    <div>
      <Typography.Title level={2} style={{ color: 'white' }}>Leaderboard</Typography.Title>
      <Typography.Paragraph className={styles.description}>
        Bảng xếp hạng vòng bảng được tính từ kết quả thực tế: thắng 3 điểm, hòa 1 điểm, thua 0 điểm.
      </Typography.Paragraph>

      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {dashboard.standings.map((board) => (
          <Card key={board.groupLabel} title={board.groupLabel} className={styles.groupCard}>
            <Table
              rowKey="teamName"
              columns={columns}
              dataSource={board.teams}
              pagination={false}
              size="small"
              className={styles.table}
              scroll={{ x: 'max-content' }}
            />
          </Card>
        ))}
      </Space>
    </div>
  );
}
