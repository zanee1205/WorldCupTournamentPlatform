import { useEffect, useState } from 'react';
import { Alert, Button, Drawer, Form, Input, InputNumber, Space } from 'antd';
import { TrophyOutlined, RobotOutlined, SaveOutlined, ThunderboltOutlined } from '@ant-design/icons';

import { formatDateTime } from '../../shared/date';
import { getStageScore } from '../../shared/scoring';
import styles from './MatchDrawer.module.scss';
import { CountryFlag } from './CountryFlag';
import { apiPath } from '../api.ts';

import type { TournamentMatch } from '../../server/src/types/tournamentMatch';
import type { MatchPrediction } from '../../server/src/types/predictionInput';

type MatchDrawerProps = {
  open: boolean;
  match: TournamentMatch | null;
  readOnly: boolean;
  onClose: () => void;
  onSavePrediction: (matchId: number, prediction: Omit<MatchPrediction, 'updatedAt'>) => Promise<void>;
};

export function MatchDrawer({ open, match, readOnly, onClose, onSavePrediction }: MatchDrawerProps) {
  const [predictionForm] = Form.useForm();
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const handleAskAI = async () => {
    if (!aiQuestion.trim() || !match) return;
    setAiLoading(true);
    try {
      const response = await fetch(apiPath('/api/ai/ask'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: aiQuestion,
          matchTitle: match.title,
          stageLabel: match.stageLabel,
        }),
      });
      const data = await response.json();
      setAiAnswer(data.answer);
    } catch {
      setAiAnswer('Không thể kết nối được hệ thống AI, thử lại sau.');
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (!match) return;
    predictionForm.setFieldsValue({
      predictedHomeScore: match.prediction?.predictedHomeScore,
      predictedAwayScore: match.prediction?.predictedAwayScore,
    });
  }, [match, predictionForm]);

  const stageScore = match ? getStageScore(match.stage) : null;

  // Parse tên đội nếu type không có homeTeam/awayTeam riêng
  const [homeTeam, awayTeam] = match?.title?.split(' vs ') ?? ['', ''];

  // CountryFlag imported at module scope

  const [drawerWidth, setDrawerWidth] = useState<number | string>(540);
  useEffect(() => {
    function onResize() {
      const w = window.innerWidth;
      if (w <= 480) setDrawerWidth('100%');
      else if (w <= 768) setDrawerWidth(480);
      else setDrawerWidth(540);
    }
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <Drawer
      closable={false}
      open={open}
      width={drawerWidth}
      onClose={onClose}
      destroyOnClose
      style={{ background: 'linear-gradient(135deg, #0f0f14 0%, #1a1a2e 50%, #16213e 100%)' }}
    >
      {!match ? null : (
        <div className={styles.drawerShell}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>

            {/* MATCH HERO */}
            <div className={styles.matchHero}>
              <div className={styles.stageTag}>
                <TrophyOutlined />
                {match.stageLabel}{match.groupLabel ? ` · ${match.groupLabel}` : ''}
              </div>
              <div className={styles.matchTeams}>
                <div className={styles.teamBlock}>
                  <div className={styles.teamName}><CountryFlag name={homeTeam} size={40} /></div>
                  <div className={styles.teamCode}>HOME</div>
                </div>
                <div className={styles.vsBlock}>
                  <span className={styles.vsText}>VS</span>
                  {match.result ? (
                    <>
                      <span className={styles.scoreDisplay}>
                        {match.result.actualHomeScore} – {match.result.actualAwayScore}
                      </span>
                      <span className={styles.scoreLabel}>KẾT QUẢ</span>
                    </>
                  ) : (
                    <span className={styles.scoreDisplay}>– –</span>
                  )}
                </div>
                <div className={styles.teamBlock}>
                  <div className={styles.teamName}><CountryFlag name={awayTeam} size={40} /></div>
                  <div className={styles.teamCode}>AWAY</div>
                </div>
              </div>
              <div className={styles.matchMeta}>
                <span className={styles.metaPill}>
                  📅 {formatDateTime(match.dateKey, match.timeLabel)}
                </span>
                {match.venue && (
                  <span className={styles.metaPill}>📍 {match.venue}</span>
                )}
              </div>
            </div>

            {/* STATS GRID */}
            <div>
              <div className={styles.sectionTitle}>Thống kê</div>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Dự đoán của bạn</div>
                  <div className={`${styles.statValue} ${styles.purple}`}>
                    {match.prediction
                      ? `${match.prediction.predictedHomeScore} – ${match.prediction.predictedAwayScore}`
                      : '—'}
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Hiệp 1</div>
                  <div className={styles.statValue}>
                    {match.result?.halftimeHomeScore != null
                      ? `${match.result.halftimeHomeScore} – ${match.result.halftimeAwayScore}`
                      : '—'}
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Điểm vòng này</div>
                  <div className={styles.statValue}>
                    {stageScore ? `${stageScore.stagePoints} / ${stageScore.exactPoints} điểm` : '—'}
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Điểm đã cộng</div>
                  <div className={`${styles.statValue} ${match.score ? styles.green : ''}`}>
                    {match.score ? `+${match.score.totalPoints} điểm` : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* GOALS */}
            <div>
              <div className={styles.sectionTitle}>Bàn thắng</div>
              {match.result?.goals?.length ? (
                <div className={styles.goalsList}>
                  {match.result.goals
                    .slice()
                    .sort((a, b) => Number(a.minute) - Number(b.minute))
                    .map((goal, idx) => (
                      <div key={idx} className={styles.goalRow}>
                        <span className={styles.goalMinute}>
                          {goal.minute ? `${goal.minute}'` : '—'}
                        </span>
                        <span className={`${styles.goalDot} ${goal.team === homeTeam ? styles.home : styles.away}`} />
                        <span className={styles.goalPlayer}>{goal.player}</span>
                        <span className={styles.goalTeam}>{goal.team}</span>
                      </div>
                    ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', padding: '10px 0' }}>
                  Chưa cập nhật
                </div>
              )}
            </div>

            {/* PREDICTION FORM */}
            {readOnly && (
              <Alert type="warning" showIcon message="Đã khóa dự đoán sau khi đủ 104 trận." />
            )}

            <div className={styles.predictionSection}>
              <div className={styles.sectionTitle} style={{ marginBottom: 0 }}>Dự đoán tỉ số</div>
              <Form
                form={predictionForm}
                layout="vertical"
                onFinish={async (values) => {
                  if (!match) return;
                  await onSavePrediction(match.id, {
                    predictedHomeScore: Number(values.predictedHomeScore),
                    predictedAwayScore: Number(values.predictedAwayScore),
                  });
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div className={styles.predLabel}>{homeTeam}</div>
                    <Form.Item name="predictedHomeScore" rules={[{ required: true }]} style={{ margin: 0 }}>
                      <InputNumber min={0} max={99} disabled={readOnly} />
                    </Form.Item>
                  </div>
                  <div className={styles.predDash}>–</div>
                  <div style={{ flex: 1 }}>
                    <div className={styles.predLabel}>{awayTeam}</div>
                    <Form.Item name="predictedAwayScore" rules={[{ required: true }]} style={{ margin: 0 }}>
                      <InputNumber min={0} max={99} disabled={readOnly} />
                    </Form.Item>
                  </div>
                </div>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  disabled={readOnly}
                  icon={<SaveOutlined />}
                  style={{ marginTop: 12, height: 40 }}
                >
                  Lưu dự đoán
                </Button>
              </Form>
            </div>

            {/* AI SECTION */}
            <div className={styles.aiSection}>
              <div className={styles.aiHeader}>
                <div className={styles.aiIcon}><RobotOutlined /></div>
                <div>
                  <div className={styles.aiTitle}>Phân tích AI</div>
                  <div className={styles.aiSubtitle}>Hỏi về đội hình, chiến thuật, dự đoán</div>
                </div>
              </div>
              <Input.TextArea
                rows={3}
                placeholder="VD: Phân tích phong độ 2 đội, ai có lợi thế hơn?"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                disabled={aiLoading}
              />
              <Button
                block
                onClick={handleAskAI}
                disabled={aiLoading}
                icon={<ThunderboltOutlined />}
                style={{ marginTop: 10, height: 38 }}
              >
                {aiLoading ? 'Đang phân tích...' : 'Hỏi AI phân tích'}
              </Button>

              {aiLoading && (
                <div style={{ padding: '12px 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                </div>
              )}

              {aiAnswer && !aiLoading && (
                <div className={styles.aiAnswer}>
                  <div className={styles.aiAnswerLabel}>Phân tích</div>
                  <p>{aiAnswer}</p>
                </div>
              )}
            </div>

          </Space>
        </div>
      )}
    </Drawer>
  );
}