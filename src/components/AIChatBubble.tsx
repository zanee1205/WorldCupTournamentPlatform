import { useState, useRef, useEffect } from "react";
import { Button, Input, Spin, Typography, Card } from "antd";
import { CommentOutlined, CloseOutlined, RobotOutlined, SendOutlined } from "@ant-design/icons";
import styles from './AIChatBubble.module.scss';
import { apiPath } from '../api.ts';

type ChatMessage = { role: 'user' | 'ai'; text: string };

export function AIChatBubble() {
    const [open, setOpen] = useState(false);
    const [question, setQuestion] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, open]);

    const handleSend = async () => {
        if (!question.trim() || loading) return;

        const useMsg = question.trim();
        setQuestion('');
        setMessages((prev) => [...prev, { role: 'user', text: useMsg }]);
        setLoading(true);

        try {
            const response = await fetch(apiPath('/api/ai/ask'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: useMsg }),
            });

            const data = await response.json();
            const answer = (data && (data.answer ?? data?.answer)) || String(data || '');
            setMessages((prev) => [...prev, { role: 'ai', text: answer }]);
        } catch {
            setMessages((prev) => [...prev, { role: 'ai', text: 'Không thể kết nối AI, thử lại sau.' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {open && (
                <Card
                    className={styles.chatPopup}
                    style={{
                        padding: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%'
                    }}
                    title={
                        <span style={{ color: '#fff', fontSize: 14 }}>
                            <RobotOutlined style={{ marginRight: 8 }} />
                            Hỏi AI về World up 2026
                        </span>
                    }
                    extra={
                        <Button
                            type="text"
                            icon={<CloseOutlined style={{ color: '#fff' }} />}
                            onClick={() => setOpen(false)}
                            size="small"
                        />
                    }
                >
                    <div className={styles.chatInput}>
                        <Input
                            placeholder="Nhập câu hỏi của bạn..."
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            onPressEnter={handleSend}
                        />
                        <Button
                            type="primary"
                            icon={<SendOutlined />}
                            onClick={handleSend}
                        />
                    </div>

                    <div style={{ padding: 12, overflowY: 'auto', maxHeight: '50vh' }}>
                        {messages.length === 0 ? (
                            <>
                                <Typography.Text type="secondary" style={{ fontSize: 13, maxWidth: 300, margin: '0 auto' }}>
                                    Hỏi tôi về đội hình, phong độ, dự đoán tỉ số các trận World Cup 2026 nhé!
                                </Typography.Text>
                                <div className={styles.suggestions}>
                                    {[
                                        '🏆 Đội nào được đánh giá cao nhất World Cup 2026?',
                                        '⚽ Cầu thủ nào đáng xem nhất World Cup 2026?',
                                        '📊 Dự đoán tỉ số Argentina vs Brazil?',
                                        '🌟 Ronaldo và Messi còn thi đấu không?',
                                    ].map((suggestion) => (
                                        <button
                                            key={suggestion}
                                            className={styles.suggestionChip}
                                            onClick={() => setQuestion(suggestion)}
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div>
                                {messages.map((m, idx) => (
                                    <div key={idx} style={{ marginBottom: 8, display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                        <div style={{
                                            background: m.role === 'user' ? '#1890ff' : '#f1f1f1',
                                            color: m.role === 'user' ? '#fff' : '#000',
                                            padding: '8px 12px',
                                            borderRadius: 12,
                                            maxWidth: '75%'
                                        }}>
                                            <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                                        </div>
                                    </div>
                                ))}
                                {loading && (
                                    <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-end', gap: 6 }}>
                                        <div className={styles.aiAvatar}>
                                            <RobotOutlined style={{ fontSize: 12, color: '#fff' }} />
                                        </div>
                                        <div className={styles.typingBubble}>
                                            <span className={styles.typingDot} />
                                            <span className={styles.typingDot} />
                                            <span className={styles.typingDot} />
                                        </div>
                                    </div>
                                )}
                                <div ref={bottomRef} />
                            </div>
                        )}
                    </div>
                </Card>
            )}

            <Button
                className={styles.bubbleButton}
                type="primary"
                shape="circle"
                size="large"
                icon={open ? <CloseOutlined /> : <CommentOutlined />}
                onClick={() => setOpen(!open)}
            />
        </>
    )
}

