import { Button, Card, Popconfirm, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';

import { deleteAdminUser, getAdminUsers, lockAdminUser, unlockAdminUser } from '../../../services/apiService.ts';
import type { AdminUser } from '../../../types/admin.ts';
import styles from './ManagingAccountPage.module.scss';

export const ManagingAccountPage = observer(function ManagingAccountPage() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        void loadUsers();
    }, []);

    async function loadUsers() {
        setLoading(true);
        try {
            const response = await getAdminUsers();
            setUsers(response.users);
        } catch (error) {
            message.error('Không thể tải danh sách người dùng.');
        } finally {
            setLoading(false);
        }
    }

    async function handleLock(userId: string) {
        setActionLoading(userId);

        try {
            await lockAdminUser(userId);
            message.success('Đã khóa tài khoản thành công.');
            await loadUsers();
        } catch (error) {
            message.error('Không thể khóa tài khoản.');
        } finally {
            setActionLoading(null);
        }
    }

    async function handleUnlock(userId: string) {
        setActionLoading(userId);

        try {
            await unlockAdminUser(userId);
            message.success('Đã mở khóa tài khoản thành công.');
            await loadUsers();
        } catch (error) {
            message.error('Không thể mở khóa tài khoản.');
        } finally {
            setActionLoading(null);
        }
    }

    async function handleDelete(userId: string) {
        setActionLoading(userId);

        try {
            await deleteAdminUser(userId);
            message.success('Đã xóa tài khoản.');
            await loadUsers();
        } catch (error) {
            message.error('Không thể xóa tài khoản.');
        } finally {
            setActionLoading(null);
        }
    }

    const columns: ColumnsType<AdminUser> = [
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
            render: (account) => <strong>{account}</strong>,
        },
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
            responsive: ['md'],
        },
        {
            title: 'Lượt sai',
            dataIndex: 'failedLoginAttempts',
            key: 'failedLoginAttempts',
            width: 110,
            align: 'center',
        },
        {
            title: 'Khóa đến',
            dataIndex: 'lockedUntil',
            key: 'lockedUntil',
            render: (value) => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa khóa',
            width: 220,
        },
        {
            title: 'Trạng thái',
            key: 'status',
            width: 140,
            render: (_value, record) => {
                const locked = record.lockedUntil ? new Date(record.lockedUntil).getTime() > Date.now() : false;
                return locked ? <Tag style={{ fontWeight: 600 }} color="error">Bị khóa</Tag> : <Tag style={{ fontWeight: 600 }} color="success">Hoạt động</Tag>;
            },
        },
        {
            title: 'Hành động',
            key: 'actions',
            width: 240,
            render: (_value, record) => {
                const locked = record.lockedUntil ? new Date(record.lockedUntil).getTime() > Date.now() : false;

                return (
                    <Space wrap>
                        {locked ? (
                            <Button
                                type="primary"
                                size="small"
                                loading={actionLoading === record.id}
                                onClick={() => void handleUnlock(record.id)}
                            >
                                Mở khóa
                            </Button>
                        ) : (
                            <Button
                                type="default"
                                size="small"
                                loading={actionLoading === record.id}
                                onClick={() => void handleLock(record.id)}
                            >
                                Khóa
                            </Button>
                        )}
                        <Popconfirm
                            title="Xóa tài khoản này?"
                            okText="Xóa"
                            cancelText="Hủy"
                            onConfirm={() => void handleDelete(record.id)}
                        >
                            <Button type="primary" danger size="small" loading={actionLoading === record.id}>
                                Xóa
                            </Button>
                        </Popconfirm>
                    </Space>
                );
            },
        },
    ];

    const lockedUsers = users.filter((user) => user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now());

    return (
        <div className={styles.managingAccountPage}>
            <div className={styles.headerBlock}>
                <Typography.Title level={2} className={styles.pageTitle}>Quản lý tài khoản</Typography.Title>
                <Typography.Paragraph className={styles.pageDescription}>
                    Khóa/mở khóa tài khoản, xóa người dùng và theo dõi những tài khoản đang bị khóa do đăng nhập thất bại.
                </Typography.Paragraph>
            </div>

            <Card className={styles.summaryCard} loading={loading} bordered={false}>
                <div className={styles.summaryGrid}>
                    <div>
                        <Typography.Text className={styles.summaryLabel}>Tổng tài khoản</Typography.Text>
                        <Typography.Title level={3} className={styles.summaryValue}>{users.length}</Typography.Title>
                    </div>
                    <div>
                        <Typography.Text className={styles.summaryLabel}>Tài khoản bị khóa</Typography.Text>
                        <Typography.Title level={3} className={styles.summaryValue}>{lockedUsers.length}</Typography.Title>
                    </div>
                    <div>
                        <Typography.Text className={styles.summaryLabel}>Tài khoản đang hoạt động</Typography.Text>
                        <Typography.Title level={3} className={styles.summaryValue}>{users.length - lockedUsers.length}</Typography.Title>
                    </div>
                </div>
            </Card>

            <Card className={styles.tableCard} bordered={false} loading={loading}>
                <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={users}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 900 }}
                />
            </Card>
        </div>
    );
});
