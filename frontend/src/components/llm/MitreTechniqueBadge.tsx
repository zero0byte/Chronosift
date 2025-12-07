import React from 'react';
import { MitreTechnique } from '../../types';

interface MitreTechniqueBadgeProps {
  technique: Pick<MitreTechnique, 'technique_id' | 'name'>;
  size?: 'sm' | 'md';
  showName?: boolean;
  onClick?: () => void;
}

export const MitreTechniqueBadge: React.FC<MitreTechniqueBadgeProps> = ({ 
  technique, 
  size = 'sm',
  showName = false,
  onClick 
}) => {
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
  };

  const baseClasses = `inline-flex items-center gap-1 rounded bg-blue-100 text-blue-800 border border-blue-300 font-mono ${sizeClasses[size]}`;
  const interactiveClasses = onClick ? 'cursor-pointer hover:bg-blue-200' : '';

  return (
    <span
      className={`${baseClasses} ${interactiveClasses}`}
      title={technique.name}
      onClick={onClick}
    >
      {technique.technique_id}
      {showName && <span className="font-sans ml-1">{technique.name}</span>}
    </span>
  );
};
