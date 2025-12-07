import React from 'react';

interface PriorityBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ score, size = 'md' }) => {
  const getColor = (score: number) => {
    if (score >= 0.8) return 'bg-red-100 text-red-800 border-red-300';
    if (score >= 0.6) return 'bg-orange-100 text-orange-800 border-orange-300';
    if (score >= 0.4) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-green-100 text-green-800 border-green-300';
  };

  const getLabel = (score: number) => {
    if (score >= 0.8) return 'Critical';
    if (score >= 0.6) return 'High';
    if (score >= 0.4) return 'Medium';
    return 'Low';
  };

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border font-medium ${getColor(score)} ${sizeClasses[size]}`}
      title={`Priority Score: ${score.toFixed(2)}`}
    >
      {getLabel(score)}
      <span className="opacity-75">({score.toFixed(2)})</span>
    </span>
  );
};
