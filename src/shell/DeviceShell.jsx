import React from 'react';
import { useDevice } from '@core/hooks/useDevice';
import Desktop from './desktop/Desktop';
import Mobile from './mobile/Mobile';

/**
 * DeviceShell — Pilih tampilan berdasarkan ukuran layar
 * Desktop (≥768px) → macOS-like shell
 * Mobile (<768px)  → iOS-like shell
 */
const DeviceShell = () => {
  const { isMobile } = useDevice();
  return isMobile ? <Mobile /> : <Desktop />;
};

export default DeviceShell;
