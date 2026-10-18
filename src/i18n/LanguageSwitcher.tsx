import React from 'react';
import { useI18n, LANGUAGES } from './index';
import type { LanguageCode } from './index';

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useI18n();

  return (
    <div className="language-switcher" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as LanguageCode)}
        style={{
          height: '30px',
          padding: '0 8px',
          borderRadius: '6px',
          border: '1px solid var(--border-color)',
          backgroundColor: '#ffffff',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          outline: 'none',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        }}
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.nativeLabel}
          </option>
        ))}
      </select>
    </div>
  );
};
