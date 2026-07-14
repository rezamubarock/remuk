import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@core/store';

const NOTIFICATION_VARIANTS = {
  initial: { opacity: 0, x: 60, scale: 0.9 },
  animate: { opacity: 1, x: 0, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 28 } },
  exit: { opacity: 0, x: 60, scale: 0.9, transition: { duration: 0.2 } },
};

const Notification = ({ notif }) => {
  const removeNotification = useStore((s) => s.removeNotification);

  return (
    <motion.div
      className={`notification notification--${notif.type || 'info'}`}
      variants={NOTIFICATION_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      onClick={() => removeNotification(notif.id)}
    >
      {notif.icon && <span className="notification__icon">{notif.icon}</span>}
      <div className="notification__body">
        {notif.title && <div className="notification__title">{notif.title}</div>}
        {notif.message && <div className="notification__message">{notif.message}</div>}
      </div>
    </motion.div>
  );
};

const NotificationCenter = () => {
  const notifications = useStore((s) => s.notifications);

  return (
    <div className="notification-center">
      <AnimatePresence>
        {notifications.map((n) => (
          <Notification key={n.id} notif={n} />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default NotificationCenter;
