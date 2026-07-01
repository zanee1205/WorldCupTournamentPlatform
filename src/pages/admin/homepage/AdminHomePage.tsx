import { Card, Col, Row, Typography } from 'antd';
import { observer } from 'mobx-react-lite';

import styles from './AdminHomePage.module.scss';

export const AdminHomePage = observer(function AdminHomePage() {
    return (
        <div>
            <Typography.Title level={2} style={{ color: '#fff', marginBottom: 8 }}>
                Welcome to Admin Homepage.
            </Typography.Title>
            <Typography.Paragraph style={{ color: '#9ca3af', fontSize: 16, marginBottom: 40 }}>
                Đây là lần đầu bạn truy cập trang quản trị? Bài viết dưới đây sẽ giúp bạn nắm nhanh các khu vực
                chính của hệ thống và những việc bạn có thể làm ở từng nơi. Toàn bộ điều hướng đã được đặt sẵn
                ở thanh sidebar bên trái, bạn chỉ cần đọc qua một lượt là có thể bắt đầu làm việc.
            </Typography.Paragraph>

            <Row gutter={[20, 20]}>
                <Col xs={24} md={12}>
                    <Card className={styles.featureCard} bordered={false} hoverable bodyStyle={{ background: 'transparent', padding: 24 }} style={{ height: '100%' }}>
                        <Typography.Title level={4} style={{ color: '#eeeb2a', fontWeight: 700, marginBottom: 8 }}>
                            📊 Dashboard
                        </Typography.Title>
                        <Typography.Paragraph style={{ color: 'rgba(255,255,255,0.85)', marginBottom: 0 }}>
                            Đây là nơi bạn theo dõi tổng quan hệ thống: số tài khoản người dùng đã được tạo,
                            số tài khoản đã tham gia dự đoán tỉ số, và điểm số của từng người chơi. Bên dưới là
                            bảng xếp hạng chi tiết gồm số thứ tự, tên người dùng, điểm xu hướng, điểm dự đoán và
                            điểm tổng — giúp bạn nắm được ai đang hoạt động tích cực và ai đang dẫn đầu.
                        </Typography.Paragraph>
                    </Card>
                </Col>

                <Col xs={24} md={12}>
                    <Card className={styles.featureCard} bordered={false} hoverable bodyStyle={{ background: 'transparent', padding: 24 }} style={{ height: '100%' }}>
                        <Typography.Title level={4} style={{ color: '#eeeb2a', fontWeight: 700, marginBottom: 8 }}>
                            👤 Quản lý tài khoản
                        </Typography.Title>
                        <Typography.Paragraph style={{ color: 'rgba(255,255,255,0.85)', marginBottom: 0 }}>
                            Tại đây bạn có thể khóa hoặc mở khóa tài khoản người dùng, hoặc xóa vĩnh viễn nếu
                            cần thiết. Hệ thống cũng tự động hiển thị những tài khoản đã nhập sai mật khẩu 5 lần
                            liên tiếp và đang bị khóa tạm thời trong 15 phút, giúp bạn dễ dàng theo dõi và hỗ trợ
                            người dùng khi cần.
                        </Typography.Paragraph>
                    </Card>
                </Col>

                <Col xs={24} md={12}>
                    <Card className={styles.featureCard} bordered={false} hoverable bodyStyle={{ background: 'transparent', padding: 24 }} style={{ height: '100%' }}>
                        <Typography.Title level={4} style={{ color: '#eeeb2a', fontWeight: 700, marginBottom: 8 }}>
                            🪪 Hồ sơ quản trị viên
                        </Typography.Title>
                        <Typography.Paragraph style={{ color: 'rgba(255,255,255,0.85)', marginBottom: 0 }}>
                            Trang hiển thị thông tin tài khoản admin của bạn, tương tự trang hồ sơ của người
                            dùng thông thường. Điểm khác biệt duy nhất là tài khoản admin không thể chỉnh sửa
                            thông tin trực tiếp tại đây — mọi thay đổi cần được thực hiện qua kênh quản trị riêng.
                        </Typography.Paragraph>
                    </Card>
                </Col>

                <Col xs={24} md={12}>
                    <Card className={styles.featureCard} bordered={false} hoverable bodyStyle={{ background: 'transparent', padding: 24 }} style={{ height: '100%' }}>
                        <Typography.Title level={4} style={{ color: '#eeeb2a', fontWeight: 700, marginBottom: 8 }}>
                            💡 Mẹo nhỏ khi bắt đầu
                        </Typography.Title>
                        <Typography.Paragraph style={{ color: 'rgba(255,255,255,0.85)', marginBottom: 0 }}>
                            Hãy ghé qua Dashboard mỗi ngày để cập nhật tình hình hoạt động của người dùng,
                            và kiểm tra mục Quản lý tài khoản định kỳ để xử lý sớm các trường hợp đăng nhập
                            bất thường. Mọi thao tác điều hướng đều nằm sẵn ở sidebar bên trái.
                        </Typography.Paragraph>
                    </Card>
                </Col>
            </Row>
        </div>
    );
});