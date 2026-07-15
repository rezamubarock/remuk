import React, { useState, useEffect } from 'react';
import '@styles/wallpaper.css';

const WALLPAPER_STYLES = [
  // Style 0: Deep Ocean Blue & Indigo
  {
    background: 'radial-gradient(at 80% 20%, hsla(242, 60%, 20%, 1) 0px, transparent 50%), radial-gradient(at 0% 100%, hsla(220, 80%, 12%, 1) 0px, transparent 50%), radial-gradient(at 50% 50%, hsla(255, 50%, 15%, 1) 0px, transparent 50%), linear-gradient(135deg, #020210, #0a0a2e)',
    linesColor: 'rgba(10, 132, 255, 0.15)',
  },
  // Style 1: Cyberpunk Dusk (Purple & Teal)
  {
    background: 'radial-gradient(at 10% 20%, hsla(290, 50%, 18%, 1) 0px, transparent 50%), radial-gradient(at 90% 80%, hsla(180, 60%, 15%, 1) 0px, transparent 50%), radial-gradient(at 50% 10%, hsla(320, 45%, 12%, 1) 0px, transparent 50%), linear-gradient(135deg, #050015, #001020)',
    linesColor: 'rgba(191, 90, 242, 0.15)',
  },
  // Style 2: Amber Flare (Warm Crimson & Charcoal)
  {
    background: 'radial-gradient(at 30% 30%, hsla(15, 60%, 16%, 1) 0px, transparent 55%), radial-gradient(at 70% 80%, hsla(270, 50%, 20%, 1) 0px, transparent 50%), radial-gradient(at 90% 10%, hsla(340, 50%, 15%, 1) 0px, transparent 50%), linear-gradient(135deg, #090202, #0f0622)',
    linesColor: 'rgba(255, 159, 10, 0.12)',
  },
  // Style 3: Emerald Dream (Slate & Green)
  {
    background: 'radial-gradient(at 70% 30%, hsla(150, 45%, 14%, 1) 0px, transparent 50%), radial-gradient(at 20% 70%, hsla(210, 50%, 18%, 1) 0px, transparent 55%), radial-gradient(at 40% 10%, hsla(180, 40%, 12%, 1) 0px, transparent 50%), linear-gradient(135deg, #010c0e, #010218)',
    linesColor: 'rgba(48, 209, 88, 0.15)',
  },
  // Style 4: Velvet Plum (Dark Berry & Indigo)
  {
    background: 'radial-gradient(at 50% 20%, hsla(320, 40%, 18%, 1) 0px, transparent 50%), radial-gradient(at 100% 100%, hsla(230, 45%, 18%, 1) 0px, transparent 50%), radial-gradient(at 10% 50%, hsla(280, 50%, 15%, 1) 0px, transparent 50%), linear-gradient(135deg, #080115, #010110)',
    linesColor: 'rgba(255, 55, 95, 0.12)',
  }
];

const parseUA = (ua) => {
  let browser = "Browser Umum";
  let os = "OS Tidak Diketahui";

  if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua) && !/opr/i.test(ua)) {
    browser = "Google Chrome";
  } else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) {
    browser = "Apple Safari";
  } else if (/firefox|fxios/i.test(ua)) {
    browser = "Mozilla Firefox";
  } else if (/edge|edg/i.test(ua)) {
    browser = "Microsoft Edge";
  } else if (/opr/i.test(ua)) {
    browser = "Opera";
  }

  if (/windows/i.test(ua)) {
    os = "Windows OS";
  } else if (/macintosh|mac os/i.test(ua)) {
    os = "macOS";
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = "Apple iOS";
  } else if (/android/i.test(ua)) {
    os = "Android OS";
  } else if (/linux/i.test(ua)) {
    os = "Linux";
  }

  return { browser, os };
};

const Wallpaper = () => {
  const [styleIndex, setStyleIndex] = useState(0);
  const [ipData, setIpData] = useState({
    ip: 'Mencari...',
    city: 'Mencari...',
    region: 'Mencari...',
    country: 'Mencari...',
    org: 'Mencari...'
  });
  const [uaInfo, setUaInfo] = useState({ browser: 'Mendeteksi...', os: 'Mendeteksi...' });
  const [screenRes, setScreenRes] = useState('');
  const [timezone, setTimezone] = useState('');
  const [cores, setCores] = useState('...');
  const [netType, setNetType] = useState('...');

  useEffect(() => {
    // Pick random index on refresh
    const rand = Math.floor(Math.random() * WALLPAPER_STYLES.length);
    setStyleIndex(rand);

    // Get local device info
    const ua = navigator.userAgent;
    setUaInfo(parseUA(ua));
    setScreenRes(`${window.innerWidth} × ${window.innerHeight} (DPR: ${window.devicePixelRatio || 1})`);
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta');
    setCores(navigator.hardwareConcurrency || 'Tidak diketahui');
    setNetType(navigator.connection?.effectiveType || 'N/A');

    // Fetch IP and Geo fingerprint info
    fetch('https://ipapi.co/json/')
      .then((res) => res.json())
      .then((data) => {
        setIpData({
          ip: data.ip || 'N/A',
          city: data.city || 'N/A',
          region: data.region || 'N/A',
          country: data.country_name || 'N/A',
          org: data.org || 'N/A'
        });
      })
      .catch(() => {
        setIpData({
          ip: 'Terblokir / Offline',
          city: 'N/A',
          region: 'N/A',
          country: 'N/A',
          org: 'N/A'
        });
      });
  }, []);

  const selected = WALLPAPER_STYLES[styleIndex];

  return (
    <div 
      className="wallpaper" 
      style={{ background: selected.background }}
      aria-hidden="true"
    >
      {/* Dynamic abstract grid pattern */}
      <div className="wallpaper__grid" />

      {/* Abstract lines (Premium vector curve paths) */}
      <svg className="wallpaper__lines" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" preserveAspectRatio="none">
        <path 
          d="M-100,700 C300,900 600,300 1000,500 C1300,650 1500,400 1600,300" 
          fill="none" 
          stroke={selected.linesColor} 
          strokeWidth="2.5" 
        />
        <path 
          d="M-50,200 C400,450 300,850 900,600 C1300,400 1400,800 1550,750" 
          fill="none" 
          stroke={selected.linesColor} 
          strokeWidth="1.5" 
          opacity="0.7"
        />
        <path 
          d="M200,-100 C500,300 800,100 1100,500 C1300,700 1500,900 1700,800" 
          fill="none" 
          stroke={selected.linesColor} 
          strokeWidth="1" 
          opacity="0.5"
        />
      </svg>

      {/* Interactive premium blur blobs */}
      <div className="wallpaper__glow-blob wallpaper__glow-blob--1" />
      <div className="wallpaper__glow-blob wallpaper__glow-blob--2" />

      {/* Centered Allahumma Sugeh & Diagnostics Gutter */}
      <div className="wallpaper-info">
        <h2 className="wallpaper-sugeh">Allahumma Sugeh</h2>
        
        <div className="wallpaper-diag glass">
          <div className="wallpaper-diag__header">
            <span className="wallpaper-diag__dot" />
            <span className="wallpaper-diag__title">DEVICE FINGERPRINT</span>
          </div>
          <div className="wallpaper-diag__body">
            <div className="wallpaper-diag__row">
              <span className="label">IP ADDRESS:</span> 
              <span className="val">{ipData.ip}</span>
            </div>
            <div className="wallpaper-diag__row">
              <span className="label">LOCATION:</span> 
              <span className="val">{ipData.city}, {ipData.region}, {ipData.country}</span>
            </div>
            <div className="wallpaper-diag__row">
              <span className="label">PROVIDER/ISP:</span> 
              <span className="val">{ipData.org}</span>
            </div>
            <div className="wallpaper-diag__row">
              <span className="label">BROWSER:</span> 
              <span className="val">{uaInfo.browser}</span>
            </div>
            <div className="wallpaper-diag__row">
              <span className="label">OPERATING SYSTEM:</span> 
              <span className="val">{uaInfo.os}</span>
            </div>
            <div className="wallpaper-diag__row">
              <span className="label">WINDOW SIZE:</span> 
              <span className="val">{screenRes}</span>
            </div>
            <div className="wallpaper-diag__row">
              <span className="label">CORES / SPEED:</span> 
              <span className="val">{cores} CPU Cores / {netType} conn</span>
            </div>
            <div className="wallpaper-diag__row">
              <span className="label">LOCALE / ZONE:</span> 
              <span className="val">{navigator.language} / {timezone}</span>
            </div>
            <div className="wallpaper-diag__row wallpaper-diag__row--ua">
              <span className="label">USER AGENT:</span> 
              <span className="val val--ua">{navigator.userAgent}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Wallpaper;
