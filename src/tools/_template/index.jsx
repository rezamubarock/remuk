/**
 * TEMPLATE TOOL — Remuk
 * ─────────────────────────────────────────────────────────────
 * Salin folder ini ke src/tools/<nama-tool>/
 * Ganti konten sesuai kebutuhan
 * Daftarkan di src/core/registry.js
 * ─────────────────────────────────────────────────────────────
 */
import React from 'react';

/**
 * TemplateTool Component
 * @param {object} props
 * @param {string} props.windowId - ID window yang menampung tool ini (desktop only)
 */
const TemplateTool = ({ windowId }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: 16,
      color: 'rgba(255,255,255,0.5)',
      fontFamily: 'Inter, sans-serif',
    }}>
      <span style={{ fontSize: 48 }}>🔧</span>
      <p style={{ fontSize: 15, fontWeight: 500 }}>Tool Baru</p>
      <p style={{ fontSize: 12, opacity: 0.6 }}>Ganti komponen ini dengan konten tool kamu</p>
    </div>
  );
};

export default TemplateTool;
