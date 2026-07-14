import React, { useState, useCallback } from 'react';
import './text-tools.css';

/* ─── Helper Functions ─── */
const transformers = {
  uppercase: (t) => t.toUpperCase(),
  lowercase: (t) => t.toLowerCase(),
  titlecase: (t) =>
    t.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()),
  sentencecase: (t) =>
    t.replace(/(^\s*\w|[.!?]\s*\w)/g, (c) => c.toUpperCase()),
  reverse: (t) => t.split('').reverse().join(''),
  reversewords: (t) => t.split(' ').reverse().join(' '),
  removeextra: (t) => t.replace(/\s+/g, ' ').trim(),
  removelines: (t) => t.replace(/\n+/g, '\n').trim(),
  slug: (t) =>
    t.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-'),
  camelcase: (t) =>
    t.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase()),
  snakecase: (t) =>
    t.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
  countwords: null, // handled separately
};

const getStats = (text) => {
  const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  const chars = text.length;
  const charsNoSpace = text.replace(/\s/g, '').length;
  const lines = text === '' ? 0 : text.split('\n').length;
  const sentences = text === '' ? 0 : (text.match(/[.!?]+/g) || []).length;
  return { words, chars, charsNoSpace, lines, sentences };
};

/* ─── Action Button ─── */
const ActionBtn = ({ icon, label, onClick }) => (
  <button className="tt-action" onClick={onClick} title={label}>
    <span className="tt-action__icon">{icon}</span>
    <span className="tt-action__label">{label}</span>
  </button>
);

/* ─── Main Tool Component ─── */
const TextTools = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  const stats = getStats(input);

  const apply = useCallback(
    (key) => {
      const fn = transformers[key];
      if (fn) setOutput(fn(input));
    },
    [input]
  );

  const copyOutput = useCallback(async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement('textarea');
      el.value = output;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [output]);

  const swapTexts = () => {
    setInput(output);
    setOutput(input);
  };

  const clearAll = () => {
    setInput('');
    setOutput('');
  };

  return (
    <div className="tt">
      {/* Stats Bar */}
      <div className="tt-stats">
        <span className="tt-stat"><strong>{stats.words}</strong> kata</span>
        <span className="tt-stat"><strong>{stats.chars}</strong> karakter</span>
        <span className="tt-stat"><strong>{stats.charsNoSpace}</strong> tanpa spasi</span>
        <span className="tt-stat"><strong>{stats.lines}</strong> baris</span>
        <span className="tt-stat"><strong>{stats.sentences}</strong> kalimat</span>
      </div>

      {/* Actions */}
      <div className="tt-actions">
        <div className="tt-actions__group">
          <span className="tt-actions__label">Huruf</span>
          <ActionBtn icon="⬆️" label="HURUF BESAR" onClick={() => apply('uppercase')} />
          <ActionBtn icon="⬇️" label="huruf kecil" onClick={() => apply('lowercase')} />
          <ActionBtn icon="📐" label="Judul" onClick={() => apply('titlecase')} />
          <ActionBtn icon="✏️" label="Kalimat" onClick={() => apply('sentencecase')} />
        </div>
        <div className="tt-actions__group">
          <span className="tt-actions__label">Format</span>
          <ActionBtn icon="🔗" label="slug-url" onClick={() => apply('slug')} />
          <ActionBtn icon="🐪" label="camelCase" onClick={() => apply('camelcase')} />
          <ActionBtn icon="🐍" label="snake_case" onClick={() => apply('snakecase')} />
        </div>
        <div className="tt-actions__group">
          <span className="tt-actions__label">Lainnya</span>
          <ActionBtn icon="↩️" label="Balik Teks" onClick={() => apply('reverse')} />
          <ActionBtn icon="🔀" label="Balik Kata" onClick={() => apply('reversewords')} />
          <ActionBtn icon="🧹" label="Hapus Spasi Ekstra" onClick={() => apply('removeextra')} />
          <ActionBtn icon="📄" label="Hapus Baris Kosong" onClick={() => apply('removelines')} />
        </div>
      </div>

      {/* Editor */}
      <div className="tt-editor">
        {/* Input */}
        <div className="tt-panel">
          <div className="tt-panel__header">
            <span className="tt-panel__title">✏️ Teks Input</span>
            <button className="tt-btn tt-btn--ghost" onClick={clearAll}>Hapus Semua</button>
          </div>
          <textarea
            className="tt-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Masukkan teks di sini…"
            spellCheck={false}
          />
        </div>

        {/* Swap Button */}
        <div className="tt-swap">
          <button className="tt-swap__btn" onClick={swapTexts} title="Tukar input & output">
            ⇄
          </button>
        </div>

        {/* Output */}
        <div className="tt-panel">
          <div className="tt-panel__header">
            <span className="tt-panel__title">📋 Hasil</span>
            <button
              className={`tt-btn ${copied ? 'tt-btn--success' : 'tt-btn--accent'}`}
              onClick={copyOutput}
              disabled={!output}
            >
              {copied ? '✓ Tersalin!' : 'Salin'}
            </button>
          </div>
          <textarea
            className="tt-textarea tt-textarea--output"
            value={output}
            onChange={(e) => setOutput(e.target.value)}
            placeholder="Hasil transformasi akan muncul di sini…"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
};

export default TextTools;
