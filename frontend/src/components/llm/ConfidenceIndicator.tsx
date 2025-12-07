import React from 'react';

interface ConfidenceIndicatorProps {
  confidence: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({ 
  confidence, 
  showLabel = true,
  size = 'md' 
}) => {
  const getColor = (conf: number) => {
    if (conf >= 0.8) return 'bg-green-500';
    if (conf >= 0.6) return 'bg-yellow-500';
    if (conf >= 0.4) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const sizeMap = {
    sm: { container: 'h-1.5 w-16', text: 'text-xs' },
    md: { container: 'h-2 w-20', text: 'text-sm' },
    lg: { container: 'h-2.5 w-24', text: 'text-base' },
  };

  const percentage = Math.round(confidence * 100);

  return (
    <div className="flex items-center gap-2">
      {showLabel && (
        <span className={`${sizeMap[size].text} text-gray-700 font-medium`}>
          {percentage}%
        </span>
      )}
      <div 
        className={`${sizeMap[size].container} bg-gray-200 rounded-full overflow-hidden`}
        title={`Confidence: ${percentage}%`}
      >
        <div
          className={`h-full ${getColor(confidence)} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
