import { useState, useEffect } from 'react';
import { Button, Card, Form, Input, Typography, message, Modal } from 'antd';
import { Link, useNavigate } from 'react-router-dom';

import { authStore } from '../../store/authStore.ts';
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

  return (
    <>
      <Modal
        open={lockedUntil !== null}
        title="Tài khoản bị khóa"
        okText="Đóng"
        cancelButtonProps={{ style: { display: 'none' } }}
        onOk={() => setLockedUntil(null)}
        onCancel={() => setLockedUntil(null)}
      >
        <LockCountdown until={lockedUntil} />
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
                await authStore.login(values);
                message.success('Đăng nhập thành công.');
                navigate('/', { replace: true });
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
                    message.error('Tài khoản bị khóa tạm thời.');
                    setLockedUntil(locked);
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