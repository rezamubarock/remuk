import React from 'react';
import Wallpaper from '../Wallpaper';
import StatusBar from './StatusBar';
import HomeScreen from './HomeScreen';
import NotificationCenter from '@components/Notification';

const Mobile = () => (
  <div className="mobile">
    <Wallpaper />
    <StatusBar />
    <HomeScreen />
    <NotificationCenter />
  </div>
);

export default Mobile;
