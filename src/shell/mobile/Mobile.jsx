import React from 'react';
import Wallpaper from '../Wallpaper';
import HomeScreen from './HomeScreen';
import NotificationCenter from '@components/Notification';

const Mobile = () => (
  <div className="mobile">
    <Wallpaper />
    <HomeScreen />
    <NotificationCenter />
  </div>
);

export default Mobile;
