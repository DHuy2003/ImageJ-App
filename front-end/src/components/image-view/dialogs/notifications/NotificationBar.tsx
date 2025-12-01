import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import './NotificationBar.css';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface NotificationBarProps {
  message: string;
  type?: NotificationType;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

const NotificationBar: React.FC<NotificationBarProps> = ({ 
  message, 
  type = 'info', 
  isVisible, 
  onClose, 
  duration = 1000 
}) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle size={20} />;
      case 'error': return <AlertCircle size={20} />;
      case 'warning': return <AlertCircle size={20} />;
      default: return <Info size={20} />;
    }
  };

  return (
    <div className={`notification-bar notification-${type} slide-in`}>
      <div className="notification-icon">{getIcon()}</div>
      <span className="notification-message">{message}</span>
      <button className="notification-close" onClick={onClose}>
        <X size={18} />
      </button>
    </div>
  );
};

export default NotificationBar;