import React from 'react';
import { observer } from 'mobx-react-lite';
import { Badge, Popover, List, Button, Empty } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import styles from './NotificationBell.module.scss';
import { CountryFlag } from '../CountryFlagIcon/CountryFlag';
import { useToggle } from '../../hooks/useToggle';
import { appStore } from '../../store/matchStore';

export default observer(function NotificationBell() {
    const { value: open, setValue: setOpen } = useToggle(false);
    const matches = appStore.dashboard?.todayMatches ?? [];
    const count = matches.length;

    const content = count === 0 ? (
        <div style={{ padding: 12, minWidth: 220 }}>
            <Empty description="Không có thông báo" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
    ) : (
        <div style={{ minWidth: 280 }}>
            <List
                size="small"
                dataSource={matches}
                renderItem={(match) => (
                    <List.Item
                        key={match.id}
                        actions={[
                            <Button
                                key="open"
                                type="link"
                                onClick={() => {
                                    setOpen(false);
                                    appStore.openMatch(match);
                                }}
                            >
                                Xem
                            </Button>,
                        ]}
                    >
                        <List.Item.Meta
                            title={(
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <CountryFlag name={match.homeLabel ?? ''} size={18} showName={false} />
                                    <span style={{ color: 'rgba(0, 0, 0, 0.95)' }}>{match.title}</span>
                                </div>
                            )}
                            description={<span style={{ color: 'rgba(0, 0, 0, 0.75)' }}>{`${match.timeLabel ?? ''}${match.venue ? ` • ${match.venue}` : ''}`}</span>}
                        />
                    </List.Item>
                )}
            />
        </div>
    );

    return (
        <Popover
            content={content}
            title={<div style={{ fontWeight: 700 }}>{`Thông báo (${count})`}</div>}
            trigger="click"
            placement="bottomRight"
            open={open}
            onOpenChange={(v) => setOpen(v)}
        >
            <div className={styles.bellWrapper} role="button" aria-label={`Thông báo: ${count}`}>
                <Badge count={count} size="small" offset={[-6, 6]}>
                    <BellOutlined style={{ fontSize: 20, color: '#fff' }} />
                </Badge>
                {count > 0 ? <span className={styles.pulse} /> : null}
            </div>
        </Popover>
    );
});
