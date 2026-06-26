import { useState } from 'react';
import { Button, Card, Form, Input, Typography, message } from 'antd';
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

export function LoginPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  return (
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
              if (isAxiosError(error) && error.response?.status === 401) {
                message.error('Tài khoản hoặc mật khẩu không đúng.');
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
  );
}
