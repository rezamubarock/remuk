import React, { useState, useEffect } from 'react';

const StatusBar = () => {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="status-bar">
      <span className="status-bar__time" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {time}
      </span>
      <div className="status-bar__right">
        <span className="status-bar__icon">▲▲▲</span>
        <span className="status-bar__icon">📶</span>
        <span className="status-bar__icon">🔋</span>
      </div>
    </div>
  );
};

export default StatusBar;
