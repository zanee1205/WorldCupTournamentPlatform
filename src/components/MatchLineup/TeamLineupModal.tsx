import { Alert, Button, Modal, Popover, Spin } from 'antd';
import { useEffect, useMemo, useRef } from 'react';
import { observer } from 'mobx-react-lite';

import { appStore } from '../../stores/appStore.ts';
import { CountryFlag } from '../CountryFlagIcon/CountryFlag';
import styles from './TeamLineupModal.module.scss';

import type { LineupPlayer, TeamLineup } from '../../../server/src/types/teamLineup.ts';

type TeamLineupModalProps = {
  open: boolean;
  teamName: string | null;
  opponentTeamName?: string | null;
  onClose: () => void;
  onPredictScore?: () => void;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function playerLabel(player: LineupPlayer) {
  return `${player.number != null ? `${player.number} ` : ''}${player.name}`;
}

function sameTeamName(left?: string | null, right?: string | null) {
  return left?.trim().toLowerCase() === right?.trim().toLowerCase();
}

function PlayerPopover({ player }: { player: LineupPlayer }) {
  return (
    <div className={styles.popover}>
      <div className={styles.popoverTitle}>{playerLabel(player)}</div>
      <div className={styles.popoverMeta}>Vị trí: {player.position}</div>
      <div className={styles.popoverMeta}>Tuổi: {player.age ?? 'Chưa rõ'}</div>
      <div className={styles.popoverMeta}>Đội: {player.teamName}</div>

      <div className={styles.replaceTitle}>Có thể thay thế cùng vị trí</div>
      {player.replacements.length ? (
        <div className={styles.replaceList}>
          {player.replacements.map((replacement) => (
            <div key={replacement.playerId} className={styles.replaceItem}>
              {replacement.photo ? (
                <img src={replacement.photo} className={styles.replaceAvatar} alt={replacement.name} />
              ) : (
                <span className={`${styles.replaceAvatar} ${styles.avatarFallback}`}>{initials(replacement.name)}</span>
              )}
              <span>
                {replacement.number != null ? `#${replacement.number} ` : ''}
                {replacement.name} · {replacement.position}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.popoverMeta}>Chưa có cầu thủ cùng vị trí trong danh sách đội.</div>
      )}
    </div>
  );
}

function TeamBadge({
  lineup,
  mirrored = false,
  label,
}: {
  lineup: TeamLineup;
  mirrored?: boolean;
  label: string;
}) {
  return (
    <div className={`${styles.teamBadge} ${mirrored ? styles.teamBadgeRight : styles.teamBadgeLeft}`}>
      <CountryFlag name={lineup.teamName} size={34} showName={false} className={styles.teamBadgeFlag} />
      <div className={styles.teamBadgeText}>
        <div className={styles.teamBadgeLabel}>{label}</div>
        <div className={styles.teamBadgeName}>{lineup.teamName}</div>
        <div className={styles.teamBadgeMeta}>
          Sơ đồ {lineup.formation} · {lineup.squadSize} cầu thủ
        </div>
      </div>
    </div>
  );
}

function PitchCanvas({ mode }: { mode: 'team' | 'match' }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const draw = () => {
      const dpr = typeof window !== 'undefined' ? Math.max(1, window.devicePixelRatio || 1) : 1;
      const width = Math.max(1, parent.clientWidth);
      const height = Math.max(1, parent.clientHeight);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const field = ctx.createLinearGradient(0, 0, width, height);
      field.addColorStop(0, '#246641');
      field.addColorStop(0.5, '#3d8b60');
      field.addColorStop(1, '#235f3d');
      ctx.fillStyle = field;
      ctx.fillRect(0, 0, width, height);

      const stripeCount = Math.max(8, Math.floor(width / 95));
      for (let i = 0; i < stripeCount; i += 1) {
        const stripeWidth = width / stripeCount;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.028)';
        ctx.fillRect(i * stripeWidth, 0, stripeWidth, height);
      }

      const overlay = ctx.createRadialGradient(width * 0.5, height * 0.42, 20, width * 0.5, height * 0.42, Math.max(width, height) * 0.7);
      overlay.addColorStop(0, 'rgba(255,255,255,0.08)');
      overlay.addColorStop(0.45, 'rgba(255,255,255,0.02)');
      overlay.addColorStop(1, 'rgba(0,0,0,0.2)');
      ctx.fillStyle = overlay;
      ctx.fillRect(0, 0, width, height);

      const lineColor = 'rgba(255,255,255,0.72)';
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = Math.max(1.5, width / 360);
      ctx.lineJoin = 'round';

      const pad = Math.max(14, Math.min(width, height) * 0.04);
      const fieldLeft = pad;
      const fieldTop = pad;
      const fieldWidth = width - pad * 2;
      const fieldHeight = height - pad * 2;

      ctx.strokeRect(fieldLeft, fieldTop, fieldWidth, fieldHeight);

      ctx.beginPath();
      ctx.moveTo(width / 2, fieldTop);
      ctx.lineTo(width / 2, fieldTop + fieldHeight);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.09, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(width / 2, height / 2, Math.max(1.2, width / 180), 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();

      const boxW = fieldWidth * 0.16;
      const boxH = fieldHeight * 0.4;
      const sixW = fieldWidth * 0.06;
      const sixH = fieldHeight * 0.18;

      ctx.strokeRect(fieldLeft, height / 2 - boxH / 2, boxW, boxH);
      ctx.strokeRect(width - fieldLeft - boxW, height / 2 - boxH / 2, boxW, boxH);
      ctx.strokeRect(fieldLeft, height / 2 - sixH / 2, sixW, sixH);
      ctx.strokeRect(width - fieldLeft - sixW, height / 2 - sixH / 2, sixW, sixH);

      ctx.beginPath();
      ctx.arc(fieldLeft + boxW, height / 2, Math.max(1.5, width / 200), 0, Math.PI * 2);
      ctx.arc(width - fieldLeft - boxW, height / 2, Math.max(1.5, width / 200), 0, Math.PI * 2);
      ctx.fill();

      const penaltyY = height / 2;
      const penaltyR = Math.max(1.5, width / 220);
      ctx.beginPath();
      ctx.arc(fieldLeft + boxW * 0.75, penaltyY, penaltyR, 0, Math.PI * 2);
      ctx.arc(width - fieldLeft - boxW * 0.75, penaltyY, penaltyR, 0, Math.PI * 2);
      ctx.fill();

      if (mode === 'match') {
        const leftGlow = ctx.createLinearGradient(0, 0, width * 0.55, 0);
        leftGlow.addColorStop(0, 'rgba(15, 23, 42, 0.22)');
        leftGlow.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = leftGlow;
        ctx.fillRect(0, 0, width * 0.55, height);

        const rightGlow = ctx.createLinearGradient(width * 0.45, 0, width, 0);
        rightGlow.addColorStop(0, 'rgba(15, 23, 42, 0)');
        rightGlow.addColorStop(1, 'rgba(15, 23, 42, 0.22)');
        ctx.fillStyle = rightGlow;
        ctx.fillRect(width * 0.45, 0, width * 0.55, height);
      }

      const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.18, width / 2, height / 2, Math.max(width, height) * 0.72);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.22)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = Math.max(1, width / 520);
      for (let i = 1; i < stripeCount; i += 1) {
        const x = (width / stripeCount) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    };

    draw();

    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => draw())
        : null;

    if (ro) {
      ro.observe(parent);
    } else {
      window.addEventListener('resize', draw);
    }

    return () => {
      if (ro) {
        ro.disconnect();
      } else {
        window.removeEventListener('resize', draw);
      }
    };
  }, [mode]);

  return <canvas ref={canvasRef} className={styles.pitchCanvas} aria-hidden="true" />;
}

export const TeamLineupModal = observer(function TeamLineupModal({
  open,
  teamName,
  opponentTeamName,
  onClose,
  onPredictScore,
}: TeamLineupModalProps) {
  const hasOpponent = useMemo(
    () => Boolean(opponentTeamName && teamName && !sameTeamName(teamName, opponentTeamName)),
    [opponentTeamName, teamName],
  );
  const displayMode = hasOpponent ? 'match' : 'team';

  const primaryTeam = teamName?.trim() ?? '';
  const secondaryTeam = opponentTeamName?.trim() ?? '';

  useEffect(() => {
    if (!open || !primaryTeam) return;

    void appStore.loadTeamLineup(primaryTeam).catch(() => undefined);

    if (hasOpponent && secondaryTeam) {
      void appStore.loadTeamLineup(secondaryTeam).catch(() => undefined);
    }
  }, [open, primaryTeam, secondaryTeam, hasOpponent]);

  const homeLineup = primaryTeam ? appStore.getCachedTeamLineup(primaryTeam) : null;
  const awayLineup = hasOpponent && secondaryTeam ? appStore.getCachedTeamLineup(secondaryTeam) : null;

  const homeError = primaryTeam ? appStore.getTeamLineupError(primaryTeam) : null;
  const awayError = hasOpponent && secondaryTeam ? appStore.getTeamLineupError(secondaryTeam) : null;

  const loading = Boolean(open && primaryTeam && !homeLineup && !homeError) || Boolean(open && hasOpponent && secondaryTeam && !awayLineup && !awayError);

  const error = useMemo(() => {
    const pieces: string[] = [];

    if (primaryTeam && homeError) {
      pieces.push(`đội hình của ${primaryTeam}: ${homeError}`);
    }

    if (hasOpponent && secondaryTeam && awayError) {
      pieces.push(`đội hình của ${secondaryTeam}: ${awayError}`);
    }

    return pieces.length ? `Không thể tải ${pieces.join(' và ')}.` : null;
  }, [awayError, hasOpponent, homeError, primaryTeam, secondaryTeam]);

  const titleName = homeLineup?.teamName ?? primaryTeam;
  const opponentName = awayLineup?.teamName ?? secondaryTeam;

  function renderPlayers(lineup: TeamLineup, mirrored: boolean) {
    return lineup.players.map((player) => {
      const x = mirrored ? 100 - player.x : player.x;
      return (
        <Popover key={`${lineup.teamCode}-${player.playerId}`} content={<PlayerPopover player={player} />} trigger="hover">
          <div
            className={`${styles.playerPin} ${mirrored ? styles.playerPinMirrored : ''}`}
            style={{ left: `${x}%`, top: `${player.y}%` }}
          >
            {player.photo ? (
              <img src={player.photo} className={styles.avatar} alt={player.name} />
            ) : (
              <span className={`${styles.avatar} ${styles.avatarFallback}`}>{initials(player.name)}</span>
            )}
            <div className={styles.playerName}>
              <span className={styles.playerPosition}>{player.position}</span>
              {player.number != null ? `${player.number} ` : ''}
              {player.name}
            </div>
          </div>
        </Popover>
      );
    });
  }

  return (
    <Modal
      centered
      open={open}
      footer={null}
      onCancel={onClose}
      width={1120}
      closable={false}
      className={styles.lineupModal}
      maskStyle={{ background: 'rgba(0, 0, 0, 0.82)', backdropFilter: 'blur(5px)' }}
      destroyOnClose
    >
      <div className={styles.modalShell}>
        <div className={styles.header}>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Đóng đội hình">
            ×
          </button>

          {displayMode === 'match' ? (
            <div className={styles.matchHeader}>
              <div className={styles.matchTeam}>
                <CountryFlag name={titleName} size={44} showName={false} className={styles.headerFlag} />
                <div className={styles.titleBlock}>
                  <div className={styles.eyebrow}>Đội nhà</div>
                  <div className={styles.teamTitle}>{titleName}</div>
                  <div className={styles.meta}>
                    {homeLineup
                      ? `Sơ đồ ${homeLineup.formation} · Nguồn ${homeLineup.formationSource} · Bảng ${homeLineup.group}`
                      : 'Đang lấy dữ liệu cầu thủ'}
                  </div>
                </div>
              </div>

              <div className={styles.vsPill}>VS</div>

              <div className={`${styles.matchTeam} ${styles.matchTeamRight}`}>
                <div className={styles.titleBlock}>
                  <div className={styles.eyebrow}>Đội thủ</div>
                  <div className={styles.teamTitle}>{opponentName}</div>
                  <div className={styles.meta}>
                    {awayLineup
                      ? `Sơ đồ ${awayLineup.formation} · Nguồn ${awayLineup.formationSource} · Bảng ${awayLineup.group}`
                      : 'Đang lấy dữ liệu cầu thủ'}
                  </div>
                </div>
                <CountryFlag name={opponentName} size={44} showName={false} className={styles.headerFlag} />
              </div>
            </div>
          ) : (
            <>
              <CountryFlag name={titleName} size={44} showName={false} className={styles.headerFlag} />
              <div className={styles.titleBlock}>
                <div className={styles.eyebrow}>Đội hình ra sân</div>
                <div className={styles.teamTitle}>{titleName}</div>
                <div className={styles.meta}>
                  {homeLineup
                    ? `Sơ đồ ${homeLineup.formation} · Nguồn ${homeLineup.formationSource} · ${homeLineup.squadSize} cầu thủ trong DB · Bảng ${homeLineup.group}`
                    : 'Đang lấy dữ liệu cầu thủ'}
                </div>
              </div>
              <CountryFlag name={titleName} size={44} showName={false} className={styles.headerFlag} />
            </>
          )}
        </div>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.loadingBox}>
              <Spin size="large" tip="Đang dựng đội hình..." />
            </div>
          ) : error ? (
            <div className={styles.emptyBox}>
              <Alert type="warning" showIcon message={error} />
            </div>
          ) : homeLineup ? (
            <>
              <div className={`${styles.field} ${displayMode === 'match' ? styles.fieldMatch : ''}`}>
                <PitchCanvas mode={displayMode} />

                {displayMode === 'match' ? (
                  <>
                    {awayLineup ? <TeamBadge lineup={awayLineup} mirrored label="Đội khách" /> : null}
                    <TeamBadge lineup={homeLineup} label="Đội nhà" />
                    <div className={`${styles.teamLayer} ${styles.teamLayerHome}`}>{renderPlayers(homeLineup, false)}</div>
                    {awayLineup ? (
                      <div className={`${styles.teamLayer} ${styles.teamLayerAway}`}>{renderPlayers(awayLineup, true)}</div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <CountryFlag
                      name={homeLineup.teamName}
                      size={62}
                      showName={false}
                      className={`${styles.sideFlag} ${styles.sideFlagLeft}`}
                    />
                    <CountryFlag
                      name={homeLineup.teamName}
                      size={62}
                      showName={false}
                      className={`${styles.sideFlag} ${styles.sideFlagRight}`}
                    />
                    <div className={styles.teamLayer}>{renderPlayers(homeLineup, false)}</div>
                  </>
                )}
              </div>

              {displayMode === 'match' && onPredictScore ? (
                <div className={styles.actions}>
                  <Button type="primary" size="large" className={styles.predictButton} onClick={onPredictScore}>
                    Dự đoán tỉ số
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </Modal>
  );
});
