import { Spin } from 'antd';

import styles from '../../App.module.scss';

type AppLoadingStateProps = {
    message?: string;
};

export function AppLoadingState({ message = 'Đang tải dữ liệu lịch thi đấu...' }: AppLoadingStateProps) {
    return (
        <div className={styles.loadingScreen}>
            <Spin size="large" tip={message} />
        </div>
    );
}
