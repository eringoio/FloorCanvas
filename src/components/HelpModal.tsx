import React from 'react';
import { useI18n } from '../i18n';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid var(--border-light)',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        width: '600px',
        maxWidth: '90vw',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{t('help.title')}</span>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-secondary)' }}
          >
            &times;
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '60vh', overflowY: 'auto', fontSize: '13px', color: 'var(--text-primary)' }}>
          <div>
            <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--primary)' }}>{t('help.drawingTools')}</strong>
            <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <li>{t('help.selectTool')}</li>
              <li>{t('help.panTool')}</li>
            </ul>
          </div>
          <div>
            <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--primary)' }}>{t('help.shortcuts')}</strong>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-light)' }}><td style={{ padding: '4px 0' }}><strong>Ctrl + Z</strong></td><td>{t('help.shortcut.undo')}</td></tr>
                <tr style={{ borderBottom: '1px solid var(--border-light)' }}><td style={{ padding: '4px 0' }}><strong>Ctrl + Y</strong></td><td>{t('help.shortcut.redo')}</td></tr>
                <tr style={{ borderBottom: '1px solid var(--border-light)' }}><td style={{ padding: '4px 0' }}><strong>Ctrl + C</strong></td><td>{t('help.shortcut.copy')}</td></tr>
                <tr style={{ borderBottom: '1px solid var(--border-light)' }}><td style={{ padding: '4px 0' }}><strong>Ctrl + X</strong></td><td>{t('help.shortcut.cut')}</td></tr>
                <tr style={{ borderBottom: '1px solid var(--border-light)' }}><td style={{ padding: '4px 0' }}><strong>Ctrl + V</strong></td><td>{t('help.shortcut.paste')}</td></tr>
                <tr style={{ borderBottom: '1px solid var(--border-light)' }}><td style={{ padding: '4px 0' }}><strong>Ctrl + D</strong></td><td>{t('help.shortcut.duplicate')}</td></tr>
                <tr style={{ borderBottom: '1px solid var(--border-light)' }}><td style={{ padding: '4px 0' }}><strong>Delete / Backspace</strong></td><td>{t('help.shortcut.delete')}</td></tr>
                <tr style={{ borderBottom: '1px solid var(--border-light)' }}><td style={{ padding: '4px 0' }}><strong>{t('help.shortcut.shiftDragKey')}</strong></td><td>{t('help.shortcut.shiftDrag')}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <button className="toolbar-btn" style={{ height: '36px', alignSelf: 'flex-end', width: '100px' }} onClick={onClose}>{t('common.close')}</button>
      </div>
    </div>
  );
};
