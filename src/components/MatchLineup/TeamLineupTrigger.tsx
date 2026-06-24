import { useState } from 'react';

import { CountryFlag } from '../CountryFlagIcon/CountryFlag';
import { TeamLineupModal } from './TeamLineupModal';
import styles from './TeamLineupTrigger.module.scss';

type TeamLineupTriggerProps = {
  name?: string | null;
  size?: number;
  showName?: boolean;
  className?: string;
};

function canOpenLineup(name?: string | null) {
  return Boolean(name && name.trim() && name.trim().toLowerCase() !== 'null');
}

export function TeamLineupTrigger({ name, size = 24, showName = true, className }: TeamLineupTriggerProps) {
  const [open, setOpen] = useState(false);
  const enabled = canOpenLineup(name);

  return (
    <>
      <button
        type="button"
        className={`${styles.trigger} ${enabled ? '' : styles.disabled} ${className ?? ''}`}
        onClick={(event) => {
          event.stopPropagation();
          if (enabled) setOpen(true);
        }}
        disabled={!enabled}
        title={enabled ? `Xem đội hình ${name}` : 'Chưa có đội thi đấu'}
      >
        <CountryFlag name={name} size={size} showName={showName} />
      </button>

      <TeamLineupModal open={open} teamName={name ?? null} onClose={() => setOpen(false)} />
    </>
  );
}
