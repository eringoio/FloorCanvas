import React from 'react';
import { useI18n } from '../i18n';
import type { Project } from '../types/project';

interface ImportMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  importData: Project | null;
  onImport: (options: {
    selectedObjectTypes: Record<string, boolean>;
    importBackground: boolean;
    importPageSize: boolean;
    importGeneralSettings: boolean;
  }) => void;
}

export const ImportMergeModal: React.FC<ImportMergeModalProps> = ({
  isOpen,
  onClose,
  importData,
  onImport,
}) => {
  const { t } = useI18n();

  // State for checkboxes
  const [selectedTypes, setSelectedTypes] = React.useState<Record<string, boolean>>({
    room: true,
    wall: true,
    column: true,
    door: true,
    window: true,
    furniture: true,
    stair: true,
    elevator: true,
    dimension: true,
    text: true,
    shape: true,
  });

  const [importBackground, setImportBackground] = React.useState(false);
  const [importPageSize, setImportPageSize] = React.useState(false);
  const [importGeneralSettings, setImportGeneralSettings] = React.useState(false);

  // Reset checkboxes when modal opens with new data
  React.useEffect(() => {
    if (isOpen) {
      setSelectedTypes({
        room: true,
        wall: true,
        column: true,
        door: true,
        window: true,
        furniture: true,
        stair: true,
        elevator: true,
        dimension: true,
        text: true,
        shape: true,
      });
      setImportBackground(false);
      setImportPageSize(false);
      setImportGeneralSettings(false);
    }
  }, [isOpen]);

  if (!isOpen || !importData) return null;

  // Helpers to count elements in the imported JSON
  const getCount = (type: string) => {
    if (!importData.objects) return 0;
    return importData.objects.filter((obj) => obj.type === type).length;
  };

  const getBackgroundCount = () => {
    let count = 0;
    if (importData.backgrounds) {
      count += importData.backgrounds.length;
    }
    if (importData.objects) {
      count += importData.objects.filter((obj) => obj.type === 'background').length;
    }
    return count;
  };

  const handleTypeChange = (type: string, checked: boolean) => {
    // If it's door or window, handle them separately or together
    if (type === 'door_window') {
      setSelectedTypes((prev) => ({
        ...prev,
        door: checked,
        window: checked,
      }));
    } else {
      setSelectedTypes((prev) => ({
        ...prev,
        [type]: checked,
      }));
    }
  };

  const handleImportSubmit = () => {
    // Verify at least one item is checked
    const hasAnyObjectTypeChecked = Object.entries(selectedTypes).some(
      ([key, val]) => val && getCount(key) > 0
    );
    const hasBackgroundChecked = importBackground && getBackgroundCount() > 0;
    const hasPageSizeChecked = importPageSize;
    const hasSettingsChecked = importGeneralSettings;

    if (!hasAnyObjectTypeChecked && !hasBackgroundChecked && !hasPageSizeChecked && !hasSettingsChecked) {
      alert(t('import.noSelectionError') || 'Please select at least one element or setting to import.');
      return;
    }

    onImport({
      selectedObjectTypes: selectedTypes,
      importBackground,
      importPageSize,
      importGeneralSettings,
    });
    onClose();
  };

  const doorWindowCount = getCount('door') + getCount('window');

  // Element types config for rendering
  const elementItems = [
    { type: 'room', label: t('import.rooms') || 'Rooms', count: getCount('room') },
    { type: 'wall', label: t('import.walls') || 'Walls', count: getCount('wall') },
    { type: 'column', label: t('import.columns') || 'Columns', count: getCount('column') },
    { type: 'door_window', label: t('import.doorsWindows') || 'Doors & Windows', count: doorWindowCount },
    { type: 'furniture', label: t('import.furniture') || 'Furniture', count: getCount('furniture') },
    { type: 'stair', label: t('import.stairs') || 'Stairs', count: getCount('stair') },
    { type: 'elevator', label: t('import.elevators') || 'Elevators', count: getCount('elevator') },
    { type: 'dimension', label: t('import.dimensions') || 'Dimensions', count: getCount('dimension') },
    { type: 'text', label: t('import.textLabels') || 'Text Labels', count: getCount('text') },
    { type: 'shape', label: t('import.shapes') || 'Shapes', count: getCount('shape') },
  ];

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
        width: '560px',
        maxWidth: '90vw',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('import.title') || 'Import & Merge Floor Map'}
          </span>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-secondary)' }}
          >
            &times;
          </button>
        </div>

        {/* Subtitle */}
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
          {t('import.subtitle') || 'Select which components and settings you want to import from the selected JSON file into the existing project.'}
        </div>

        {/* Body content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '55vh', overflowY: 'auto', paddingRight: '4px' }}>
          
          {/* Group 1: Elements */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('import.elements') || 'Elements to Import'}
            </span>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              padding: '12px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid var(--border-light)'
            }}>
              {elementItems.map((item) => {
                const isChecked = item.type === 'door_window' 
                  ? (selectedTypes.door && selectedTypes.window)
                  : selectedTypes[item.type];
                const isDisabled = item.count === 0;

                return (
                  <label 
                    key={item.type}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      color: isDisabled ? 'var(--text-secondary)' : 'var(--text-primary)',
                      opacity: isDisabled ? 0.5 : 1,
                      fontWeight: 500
                    }}
                  >
                    <input 
                      type="checkbox"
                      checked={isChecked && !isDisabled}
                      disabled={isDisabled}
                      onChange={(e) => handleTypeChange(item.type, e.target.checked)}
                      style={{ cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                    />
                    <span>{item.label}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      ({item.count})
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Group 2: Settings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('import.settings') || 'Settings to Import'}
            </span>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '12px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid var(--border-light)'
            }}>
              {/* Background image check */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                cursor: getBackgroundCount() === 0 ? 'not-allowed' : 'pointer',
                color: getBackgroundCount() === 0 ? 'var(--text-secondary)' : 'var(--text-primary)',
                opacity: getBackgroundCount() === 0 ? 0.5 : 1,
                fontWeight: 500
              }}>
                <input 
                  type="checkbox"
                  checked={importBackground && getBackgroundCount() > 0}
                  disabled={getBackgroundCount() === 0}
                  onChange={(e) => setImportBackground(e.target.checked)}
                  style={{ cursor: getBackgroundCount() === 0 ? 'not-allowed' : 'pointer' }}
                />
                <span>{t('import.backgroundImage') || 'Background Image'}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  ({getBackgroundCount()})
                </span>
              </label>

              {/* Page size check */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontWeight: 500
              }}>
                <input 
                  type="checkbox"
                  checked={importPageSize}
                  onChange={(e) => setImportPageSize(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>{t('import.pageSize') || 'Page Size & Orientation'}</span>
                {importData.canvas && (
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    ({importData.canvas.paperSize} {importData.canvas.orientation})
                  </span>
                )}
              </label>

              {/* Scale/Grid/Layers check */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontWeight: 500
              }}>
                <input 
                  type="checkbox"
                  checked={importGeneralSettings}
                  onChange={(e) => setImportGeneralSettings(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>{t('import.generalSettings') || 'General Settings (Grid, Scale, Layers)'}</span>
              </label>
            </div>
          </div>

          {/* Info note */}
          <div style={{
            fontSize: '11px',
            color: 'var(--primary)',
            backgroundColor: 'rgba(59, 130, 246, 0.05)',
            border: '1px solid rgba(59, 130, 246, 0.15)',
            padding: '10px 12px',
            borderRadius: '6px',
            lineHeight: '1.4',
            fontWeight: 500
          }}>
            {t('import.note') || 'Note: Imported elements will be added to the project, automatically grouped and selected so you can drag and resize them directly on the canvas.'}
          </div>

        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
          <button 
            className="toolbar-btn" 
            style={{ height: '36px', minWidth: '80px' }} 
            onClick={onClose}
          >
            {t('import.close') || 'Cancel'}
          </button>
          <button 
            className="toolbar-btn" 
            style={{
              height: '36px',
              padding: '0 16px',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              borderColor: 'var(--primary)',
              minWidth: '120px'
            }} 
            onClick={handleImportSubmit}
          >
            {t('import.btn') || 'Import & Merge'}
          </button>
        </div>
      </div>
    </div>
  );
};
