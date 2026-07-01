import { Card, Col, Row, Statistic, Table, Typography, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';

import { getAdminDashboard } from '../../../services/apiService.ts';
import type { AdminDashboardResponse, AdminLeaderboardUser } from '../../../types/admin.ts';
import styles from './DashboardPage.module.scss';

export const AdminDashboardPage = observer(function AdminDashboardPage() {
    const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        void loadDashboard();
    }, []);

    async function loadDashboard() {
        setLoading(true);

        try {
            const response = await getAdminDashboard();
            setDashboard(response);
        } catch (error) {
            message.error('Không thể tải dữ liệu admin dashboard.');
        } finally {
            setLoading(false);
        }
    }

    const columns: ColumnsType<AdminLeaderboardUser> = [
        {
            title: 'STT',
            key: 'index',
            width: 80,
            render: (_value, _record, index) => index + 1,
        },
        {
            title: 'Tên đăng nhập',
            dataIndex: 'account',
            key: 'account',
            render: (account) => <span className={styles.username}>{account}</span>,
        },
        {
            title: 'Họ tên',
            dataIndex: 'fullName',
            key: 'fullName',
            render: (fullName) => fullName || 'Chưa đặt tên',
        },
        {
            title: 'Điểm xu hướng',
            dataIndex: 'stagePoints',
            key: 'stagePoints',
            width: 120,
            align: 'right',
        },
        {
            title: 'Điểm dự đoán',
            dataIndex: 'exactPoints',
            key: 'exactPoints',
            width: 120,
            align: 'right',
        },
        {
            title: 'Điểm tổng',
            dataIndex: 'totalPoints',
            key: 'totalPoints',
            width: 120,
            align: 'right',
            render: (value) => <strong>{value}</strong>,
        },
        {
            title: 'Số dự đoán',
            dataIndex: 'predictedMatches',
            key: 'predictedMatches',
            width: 130,
            align: 'right',
        },
    ];

    return (
        <div className={styles.adminDashboardPage}>
            <div className={styles.headerBlock}>
                <Typography.Title level={2} className={styles.pageTitle}>Admin Dashboard</Typography.Title>
                <Typography.Paragraph className={styles.pageDescription}>
                    Theo dõi nhanh số lượng tài khoản, mức độ tham gia dự đoán và bảng điểm người chơi theo xu hướng, dự đoán chính xác và tổng điểm.
                </Typography.Paragraph>
            </div>

            <Row gutter={[24, 24]}>
                <Col xs={24} md={6}>
                    <Card className={styles.statCard} loading={loading} bordered={false}>
                        <Statistic title="Tổng người dùng" value={dashboard?.stats.totalUsers ?? 0} />
                    </Card>
                </Col>
                <Col xs={24} md={6}>
                    <Card className={styles.statCard} loading={loading} bordered={false}>
                        <Statistic title="Người dùng có dự đoán" value={dashboard?.stats.usersWithPredictions ?? 0} />
                    </Card>
                </Col>
                <Col xs={24} md={6}>
                    <Card className={styles.statCard} loading={loading} bordered={false}>
                        <Statistic title="Tổng dự đoán" value={dashboard?.stats.totalPredictions ?? 0} />
                    </Card>
                </Col>
                <Col xs={24} md={6}>
                    <Card className={styles.statCard} loading={loading} bordered={false}>
                        <Statistic title="Tài khoản bị khóa" value={dashboard?.stats.lockedUsers ?? 0} />
                    </Card>
                </Col>
            </Row>

            <Card className={styles.leaderboardCard} loading={loading} bordered={false}>
                <div className={styles.cardHeader}>
                    <div>
                        <Typography.Title level={4} className={styles.cardTitle}>Bảng điểm người dùng</Typography.Title>
                        <Typography.Text className={styles.cardSubtitle}>
                            Danh sách xếp hạng theo điểm tổng, điểm xu hướng và điểm dự đoán chính xác.
                        </Typography.Text>
                    </div>
                    <Tag color="cyan" style = {{ fontWeight: 700 }}>{dashboard?.leaderboard.length ?? 0} người dùng</Tag>
                </div>

                <Table
                    className={styles.leaderboardTable}
                    rowKey="id"
                    columns={columns}
                    dataSource={dashboard?.leaderboard ?? []}
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 760 }}
                />
            </Card>
        </div>
    );
});
