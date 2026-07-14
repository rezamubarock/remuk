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

const Wallpaper = () => {
  const [styleIndex, setStyleIndex] = useState(0);

  useEffect(() => {
    // Pick random index on refresh
    const rand = Math.floor(Math.random() * WALLPAPER_STYLES.length);
    setStyleIndex(rand);
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
    </div>
  );
};

export default Wallpaper;
