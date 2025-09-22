import React from 'react';
import { Check } from 'lucide-react';

interface CheckboxProps {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'default' | 'lg';
}

export const Checkbox: React.FC<CheckboxProps> = ({
  id,
  checked,
  onCheckedChange,
  className = '',
  disabled = false,
  size = 'default'
}) => {
  const sizeClasses = {
    sm: 'h-3 w-3',
    default: 'h-4 w-4',
    lg: 'h-5 w-5'
  };
  
  const iconSizeClasses = {
    sm: 'h-2 w-2',
    default: 'h-3 w-3',
    lg: 'h-4 w-4'
  };
  
  return (
    <button
      id={id}
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => !disabled && onCheckedChange(!checked)}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center rounded border border-gray-300 ${sizeClasses[size]}
        ${checked ? 'bg-blue-600 border-blue-600' : 'bg-white'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-blue-500'}
        ${className}
      `}
    >
      {checked && (
        <Check className={`text-white ${iconSizeClasses[size]}`} />
      )}
    </button>
  );
};
