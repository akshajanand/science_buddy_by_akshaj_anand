
import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'rect' | 'circle' | 'text';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = "", variant = 'rect' }) => {
  const baseClass = "animate-pulse bg-white/5";
  const roundedClass = variant === 'circle' ? 'rounded-full' : 'rounded-xl';
  
  return (
    <div className={`${baseClass} ${roundedClass} ${className}`} />
  );
};
