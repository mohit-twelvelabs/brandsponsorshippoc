import React, { useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react';
import { AlertProps } from '../types';

const Alert: React.FC<AlertProps> = ({ type, message, isVisible, onClose }) => {
  // Auto-close after 5 seconds
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const titles: Record<AlertProps['type'], string> = {
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Info',
  };

  const iconColorClass: Record<AlertProps['type'], string> = {
    success: 'text-mb-green-dark',
    error: 'text-error',
    warning: 'text-mb-orange-dark',
    info: 'text-info',
  };

  const leftBorderClass: Record<AlertProps['type'], string> = {
    success: 'border-l-mb-green',
    error: 'border-l-error',
    warning: 'border-l-mb-orange',
    info: 'border-l-info',
  };

  const getIcon = () => {
    const cls = `w-5 h-5 ${iconColorClass[type]}`;
    switch (type) {
      case 'success':
        return <CheckCircle className={cls} />;
      case 'error':
        return <XCircle className={cls} />;
      case 'warning':
        return <AlertTriangle className={cls} />;
      case 'info':
      default:
        return <Info className={cls} />;
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-xl border border-border bg-card shadow-lg p-4 border-l-4 ${leftBorderClass[type]} animate-slide-up`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{titles[type]}</p>
          <p className="text-sm text-text-secondary mt-0.5">{message}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Dismiss notification"
          className="flex-shrink-0 text-text-tertiary hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Alert;
