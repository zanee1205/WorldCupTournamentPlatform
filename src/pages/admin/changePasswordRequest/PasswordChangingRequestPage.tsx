import { Button, Card, Popconfirm, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';

import {
    approvePasswordChangeRequest,
    getPasswordChangeRequests,
    rejectPasswordChangeRequest,
} from '../../../services/apiService.ts';
import type { AdminPasswordChangeRequest } from '../../../types/admin.ts';

import styles from './PasswordChangingRequestPage.module.scss';

export const PasswordChangingRequestPage = observer(function PasswordChangingRequestPage() {
    const [requests, setRequests] = useState<AdminPasswordChangeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        void loadRequests();
    }, []);

    async function loadRequests() {
        setLoading(true);
        try {
            const response = await getPasswordChangeRequests();
            setRequests(response.requests);
        } catch (error) {
            message.error('Không thể tải danh sách yêu cầu đổi mật khẩu.');
        } finally {
            setLoading(false);
        }
    }

    async function handleApprove(requestId: string) {
        setActionLoading(requestId);
        try {
            await approvePasswordChangeRequest(requestId);
            message.success('Đã duyệt yêu cầu đổi mật khẩu.');
            await loadRequests();
        } catch (error) {
            message.error('Không thể duyệt yêu cầu.');
        } finally {
            setActionLoading(null);
        }
    }

    async function handleReject(requestId: string) {
        setActionLoading(requestId);
        try {
            await rejectPasswordChangeRequest(requestId);
            message.success('Đã từ chối yêu cầu đổi mật khẩu.');
            await loadRequests();
        } catch (error) {
            message.error('Không thể từ chối yêu cầu.');
        } finally {
            setActionLoading(null);
        }
    }

    const columns: ColumnsType<AdminPasswordChangeRequest> = [
        {
            title: 'Tài khoản',
            dataIndex: 'userAccount',
            key: 'userAccount',
            render: (value) => <strong style={{ color: '#fff' }}>{value}</strong>,
        },
        {
            title: 'Yêu cầu lúc',
            dataIndex: 'requestedAt',
            key: 'requestedAt',
            render: (value) => new Date(value).toLocaleString('vi-VN'),
            width: 220,
        },
        {
            title: 'Lý do',
            dataIndex: 'reason',
            key: 'reason',
            render: (value) => value || <span style={{ color: 'rgba(255,255,255,0.35)' }}>Không có</span>,
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (value) => {
                const color = value === 'pending' ? 'orange' : value === 'approved' ? 'green' : 'red';
                const label = value === 'pending' ? 'Đang chờ' : value === 'approved' ? 'Đã duyệt' : 'Đã từ chối';
                return <Tag color={color}>{label}</Tag>;
            },
            width: 140,
        },
        {
            title: 'Hành động',
            key: 'actions',
            width: 260,
            render: (_value, record) => (
                <Space wrap>
                    <Popconfirm
                        title="Duyệt yêu cầu này?"
                        okText="Duyệt"
                        cancelText="Hủy"
                        onConfirm={() => void handleApprove(record.id)}
                    >
                        <Button
                            type="primary"
                            size="small"
                            loading={actionLoading === record.id}
                            disabled={record.status !== 'pending'}
                        >
                            Duyệt
                        </Button>
                    </Popconfirm>
                    <Popconfirm
                        title="Từ chối yêu cầu này?"
                        okText="Từ chối"
                        cancelText="Hủy"
                        onConfirm={() => void handleReject(record.id)}
                    >
                        <Button
                            type="default"
                            danger
                            size="small"
                            loading={actionLoading === record.id}
                            disabled={record.status !== 'pending'}
                        >
                            Từ chối
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div className={styles.pageWrapper}>
            <Typography.Title level={2} className={styles.pageTitle}>
                Duyệt yêu cầu đổi mật khẩu
            </Typography.Title>
            <Typography.Paragraph className={styles.pageDescription}>
                Danh sách các yêu cầu đổi mật khẩu do người dùng gửi. Bạn có thể duyệt hoặc từ chối từng yêu cầu.
            </Typography.Paragraph>

            <Card className={styles.tableCard} bordered={false} loading={loading}>
                <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={requests}
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: 'Không có yêu cầu đổi mật khẩu.' }}
                />
            </Card>
        </div>
    );
});