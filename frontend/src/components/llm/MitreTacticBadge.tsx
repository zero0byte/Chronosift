import React from 'react';
import { MitreTactic } from '../../types';

interface MitreTacticBadgeProps {
  tactic: Pick<MitreTactic, 'tactic_id' | 'name'>;
  size?: 'sm' | 'md';
  showId?: boolean;
}

export const MitreTacticBadge: React.FC<MitreTacticBadgeProps> = ({ 
  tactic, 
  size = 'sm',
  showId = false 
}) => {
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded bg-purple-100 text-purple-800 border border-purple-300 font-medium ${sizeClasses[size]}`}
      title={`${tactic.tactic_id}: ${tactic.name}`}
    >
      {showId && <span className="font-mono opacity-75">{tactic.tactic_id}</span>}
      {tactic.name}
    </span>
  );
};
