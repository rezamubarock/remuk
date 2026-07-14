import React, { useState, useEffect } from 'react';

const MenuBar = ({ activeWindowTitle }) => {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      );
      setDate(
        now.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="menubar" role="menubar">
      {/* Left: Logo + App Name */}
      <span className="menubar__logo" title="Remuk Tools">🌐</span>
      <span className="menubar__app-name">
        {activeWindowTitle || 'Remuk Tools'}
      </span>

      {/* Menu items */}
      <div className="menubar__menus">
        <span className="menubar__menu-item">File</span>
        <span className="menubar__menu-item">Tampilan</span>
        <span className="menubar__menu-item">Bantuan</span>
      </div>

      {/* Right: Status + Clock */}
      <div className="menubar__right">
        <div className="menubar__status-icons">
          <span className="menubar__status-icon" title="WiFi">📶</span>
          <span className="menubar__status-icon" title="Baterai">🔋</span>
        </div>
        <div className="menubar__clock" title={date}>
          <span>{date}&nbsp;&nbsp;</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{time}</span>
        </div>
      </div>
    </div>
  );
};

export default MenuBar;
