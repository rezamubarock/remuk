import React from 'react';
import '@styles/wallpaper.css';

const Wallpaper = () => (
  <div className="wallpaper" aria-hidden="true">
    {/* Stars layers */}
    <div className="wallpaper__stars" />
    <div className="wallpaper__stars-2" />

    {/* Solar System */}
    <div className="wallpaper__system">
      {/* Sun */}
      <div className="sun" />

      {/* Planet Orbits */}
      <div className="orbit orbit--mercury" />
      <div className="orbit orbit--venus" />
      <div className="orbit orbit--earth" />
      <div className="orbit orbit--mars" />
      <div className="orbit orbit--jupiter" />
      <div className="orbit orbit--saturn" />
      <div className="orbit orbit--uranus" />
    </div>

    {/* Nebula glow overlay */}
    <div className="wallpaper__nebula" />
  </div>
);

export default Wallpaper;
