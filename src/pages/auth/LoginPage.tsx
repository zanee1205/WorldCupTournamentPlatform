import { useState, useEffect } from 'react';
import { Button, Card, Form, Input, Typography, message, Modal } from 'antd';
import { Link, useNavigate } from 'react-router-dom';

import { authStore } from '../../store/authStore.ts';
import { createUnlockRequest } from '../../services/apiService.ts';
import styles from './AuthPage.module.scss';
import { isAxiosError } from 'axios';

type LoginFormValues = {
  identifier: string;
  password: string;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Không thể đăng nhập.';
}

function LockCountdown({ until }: { until: Date | null }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    function update() {
      if (!until) {
        setRemaining('vui lòng thử lại sau');
        return;
      }
      const ms = Math.max(0, until.getTime() - Date.now());
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      setRemaining(`${minutes} phút ${seconds} giây`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [until]);

  return (
    <div>
      Tài khoản của bạn bị khóa tạm thời. Thời gian mở khóa còn khoảng{' '}
      <strong>{remaining}</strong>
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [failedInfo, setFailedInfo] = useState<{ failedAttempts?: number; remainingAttempts?: number } | null>(null);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
  const [lockType, setLockType] = useState<'temporary' | 'permanent' | null>(null);
  const [unlockRequestIdentifier, setUnlockRequestIdentifier] = useState('');
  const [unlockRequestReason, setUnlockRequestReason] = useState('');
  const [unlockRequestSubmitting, setUnlockRequestSubmitting] = useState(false);
  const [unlockRequestSent, setUnlockRequestSent] = useState(false);

  const isPermanentLock = lockType === 'permanent';
  const isLockModalOpen = lockedUntil !== null;

  const resetLockModal = () => {
    setLockedUntil(null);
    setLockType(null);
    setUnlockRequestReason('');
    setUnlockRequestIdentifier('');
    setUnlockRequestSent(false);
  };

  const handleSendUnlockRequest = async () => {
    if (!unlockRequestIdentifier) {
      message.error('Không xác định được tài khoản cần mở khóa.');
      return;
    }

    setUnlockRequestSubmitting(true);
    try {
      await createUnlockRequest({ identifier: unlockRequestIdentifier, reason: unlockRequestReason });
      setUnlockRequestSent(true);
      message.success('Yêu cầu mở khóa đã được gửi. Admin sẽ xem xét.');
    } catch (error) {
      if (isAxiosError(error) && error.response?.data?.message) {
        message.error(error.response.data.message);
      } else {
        message.error('Không thể gửi yêu cầu mở khóa.');
      }
    } finally {
      setUnlockRequestSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        open={isLockModalOpen}
        title={isPermanentLock ? 'Tài khoản bị vô hiệu hóa' : 'Tài khoản bị khóa'}
        onCancel={resetLockModal}
        footer={
          isPermanentLock
            ? [
              <Button key="close" onClick={resetLockModal}>
                Đóng
              </Button>,
              <Button
                key="submit"
                type="primary"
                loading={unlockRequestSubmitting}
                disabled={unlockRequestSent}
                onClick={handleSendUnlockRequest}
              >
                {unlockRequestSent ? 'Đã gửi yêu cầu' : 'Gửi yêu cầu mở khóa'}
              </Button>,
            ]
            : [
              <Button key="close" type="primary" onClick={resetLockModal}>
                Đóng
              </Button>,
            ]
        }
      >
        {isPermanentLock ? (
          <>
            <Typography.Paragraph>
              Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng gửi yêu cầu mở khóa để Admin xem xét.
            </Typography.Paragraph>
            <Form layout="vertical">
              <Form.Item label="Tài khoản" required>
                <Input value={unlockRequestIdentifier} disabled />
              </Form.Item>
              <Form.Item label="Lý do mở khóa (tùy chọn)" help="Admin sẽ dựa vào lý do này khi xét duyệt">
                <Input.TextArea
                  rows={4}
                  value={unlockRequestReason}
                  onChange={(event) => setUnlockRequestReason(event.target.value)}
                  placeholder="Nhập lý do yêu cầu mở khóa..."
                  disabled={unlockRequestSent}
                />
              </Form.Item>
              {unlockRequestSent ? (
                <Typography.Paragraph type="success">
                  Yêu cầu mở khóa đã được gửi. Vui lòng chờ Admin phê duyệt.
                </Typography.Paragraph>
              ) : null}
            </Form>
          </>
        ) : (
          <LockCountdown until={lockedUntil} />
        )}
      </Modal>

      <div className={styles.authPage}>
        <Card className={styles.authCard} bordered={false}>
          <div className={styles.authHeader}>
            <Typography.Text className={styles.authSubtitle}>Tournament Platform</Typography.Text>
            <div className={styles.authTitle}>Đăng nhập</div>
            <Typography.Paragraph className={styles.authSubtitle}>
              Đăng nhập bằng tài khoản hoặc email để tiếp tục sử dụng hệ thống.
            </Typography.Paragraph>
          </div>

          <Form<LoginFormValues>
            layout="vertical"
            requiredMark={false}
            onFinish={async (values) => {
              setSubmitting(true);
              try {
                const user = await authStore.login(values);
                message.success('Đăng nhập thành công.');
                if (user?.role === 'admin') {
                  navigate('/admin', { replace: true });
                } else {
                  navigate('/', { replace: true });
                }
              } catch (error) {
                if (isAxiosError(error) && error.response) {
                  const status = error.response.status;

                  if (status === 401) {
                    const data = error.response.data as any;
                    if (data?.failedAttempts !== undefined) {
                      setFailedInfo({
                        failedAttempts: data.failedAttempts,
                        remainingAttempts: data.remainingAttempts,
                      });
                    }
                    message.error('Tài khoản hoặc mật khẩu không đúng.');
                  } else if (status === 423) {
                    const data = error.response.data as any;
                    const locked = data?.lockedUntil ? new Date(data.lockedUntil) : null;
                    const type = data?.lockType === 'permanent' ? 'permanent' : 'temporary';
                    setLockedUntil(locked);
                    setLockType(type);
                    if (type === 'permanent' && data?.allowUnlockRequest) {
                      setUnlockRequestIdentifier(values.identifier.trim());
                    }
                    message.error(
                      type === 'permanent'
                        ? 'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng gửi yêu cầu mở khóa.'
                        : 'Tài khoản bị khóa tạm thời.',
                    );
                  } else {
                    message.error(getErrorMessage(error));
                  }
                } else {
                  message.error(getErrorMessage(error));
                }
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <Form.Item
              label="Tài khoản hoặc email"
              name="identifier"
              rules={[
                { required: true, message: 'Vui lòng nhập tài khoản hoặc email.' },
                { min: 3, message: 'Tài khoản tối thiểu 3 ký tự.' },
              ]}
            >
              <Input autoComplete="username" placeholder="Nhập tài khoản hoặc email" />
            </Form.Item>
            <Form.Item
              label="Mật khẩu"
              name="password"
              rules={[
                { required: true, message: 'Vui lòng nhập mật khẩu.' },
                { min: 6, message: 'Mật khẩu tối thiểu 6 ký tự.' },
              ]}
            >
              <Input.Password autoComplete="current-password" placeholder="Nhập mật khẩu" />
            </Form.Item>
            {failedInfo ? (
              <div style={{ marginBottom: 12 }}>
                <Typography.Text type="danger">
                  Mật khẩu không đúng. Bạn đã nhập {failedInfo.failedAttempts} lần. Sai 5 lần sẽ bị khóa tài khoản. Còn {failedInfo.remainingAttempts} lần nữa.
                </Typography.Text>
              </div>
            ) : null}
            <Button type="primary" htmlType="submit" block loading={submitting}>
              Đăng nhập
            </Button>
          </Form>

          <div className={styles.authLinkRow}>
            <Typography.Text className={styles.authSubtitle}>Chưa có tài khoản?</Typography.Text>
            <Link to="/register">Tạo tài khoản</Link>
          </div>
        </Card>
      </div>
    </>
  );
}