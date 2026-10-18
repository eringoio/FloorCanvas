import React from 'react';
import { useProjectStore } from '../store/projectStore';
import { useI18n } from '../i18n';
import { getPaperPixelSize } from '../utils/scale';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const project = useProjectStore((state) => state.project);

  const [exportFormat, setExportFormat] = React.useState<'SVG' | 'PNG' | 'PDF'>('SVG');
  const [exportIncludeBg, setExportIncludeBg] = React.useState(true);
  const [exportIncludeGrid, setExportIncludeGrid] = React.useState(false);
  const [exportTransparentBg, setExportTransparentBg] = React.useState(false);
  const [exportScaleMultiplier, setExportScaleMultiplier] = React.useState<number>(2);
  const [exportPdfPaperSize, setExportPdfPaperSize] = React.useState<'A4' | 'A3'>('A4');
  const [exportPdfOrientation, setExportPdfOrientation] = React.useState<'landscape' | 'portrait'>('landscape');
  const [exportPdfMargin, setExportPdfMargin] = React.useState<number>(10);
  const [exportPdfScaleLabel, setExportPdfScaleLabel] = React.useState<boolean>(true);

  if (!isOpen) return null;

  const handleExportExecute = async () => {
    const scaleConfig = project.scale;
    const canvasConfig = project.canvas;
    const pixelSize = getPaperPixelSize(canvasConfig, scaleConfig);
    const widthPx = pixelSize.width;
    const heightPx = pixelSize.height;

    const prepareSvgClone = () => {
      const svgElement = document.querySelector('.paper-boundary svg:not(.grid-overlay)') as SVGSVGElement;
      if (!svgElement) {
        throw new Error('Canvas SVG element not found');
      }

      const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
      svgClone.setAttribute('width', `${widthPx}`);
      svgClone.setAttribute('height', `${heightPx}`);
      svgClone.setAttribute('viewBox', `0 0 ${widthPx} ${heightPx}`);
      svgClone.removeAttribute('style');

      const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      // Local/system font stack only: exported files must not depend on any
      // external font service or make network requests when opened.
      styleEl.textContent = `
        text, tspan {
          font-family: 'Inter', 'Noto Sans JP', -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Yu Gothic UI", "Yu Gothic", "Meiryo", system-ui, sans-serif;
        }
      `;
      svgClone.insertBefore(styleEl, svgClone.firstChild);

      svgClone.querySelectorAll('.selection-highlight, .selection-outline, .background-border, .selection-overlay-group, .snap-guide, .room-wall-controls-overlay, .page-border').forEach(el => el.remove());

      if (!exportIncludeBg) {
        svgClone.querySelectorAll('.background-element').forEach(el => el.remove());
      }

      if (exportIncludeGrid) {
        const gridSize = project.grid.size * project.scale.pixelsPerUnit;
        const majorSize = gridSize * 5;
        const defsStr = `
          <pattern id="minor-grid" width="${gridSize}" height="${gridSize}" patternUnits="userSpaceOnUse">
            <path d="M ${gridSize} 0 L 0 0 0 ${gridSize}" fill="none" stroke="#e2e8f0" stroke-width="0.5" />
          </pattern>
          <pattern id="major-grid" width="${majorSize}" height="${majorSize}" patternUnits="userSpaceOnUse">
            <rect width="${majorSize}" height="${majorSize}" fill="url(#minor-grid)" />
            <path d="M ${majorSize} 0 L 0 0 0 ${majorSize}" fill="none" stroke="#cbd5e1" stroke-width="1" />
          </pattern>
        `;
        const parser = new DOMParser();
        const defsDoc = parser.parseFromString(`<svg xmlns="http://www.w3.org/2000/svg"><defs>${defsStr}</defs><rect width="${widthPx}" height="${heightPx}" fill="url(#major-grid)" /></svg>`, 'image/svg+xml');
        
        const newDefs = defsDoc.querySelector('defs');
        const gridRect = defsDoc.querySelector('rect');
        
        if (newDefs && gridRect) {
          svgClone.insertBefore(gridRect, svgClone.firstChild);
          svgClone.insertBefore(newDefs, svgClone.firstChild);
        }
      }

      return svgClone;
    };

    const capturePaperCanvas = async (multiplier: number): Promise<HTMLCanvasElement> => {
      const paperElement = document.querySelector('.paper-boundary') as HTMLElement | null;
      if (!paperElement) {
        throw new Error('Paper element not found');
      }

      const store = useProjectStore.getState();
      const originalZoom = store.zoom;
      const originalPan = store.pan;

      // Reset zoom and pan to make the full element size captureable by html2canvas
      store.setZoom(1.0);
      store.setPan({ x: 0, y: 0 });

      // Wait for React to re-render the view
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => setTimeout(resolve, 50));

      const selectorsToHide = [
        '.selection-highlight',
        '.selection-outline',
        '.selection-overlay-group',
        '.snap-guide',
        '.room-wall-controls-overlay',
        '.background-border',
        '.page-border',
      ];
      if (!exportIncludeGrid) {
        selectorsToHide.push('.grid-overlay');
      }
      if (!exportIncludeBg) {
        selectorsToHide.push('.background-element');
      }

      const hiddenElements = Array.from(paperElement.querySelectorAll<HTMLElement | SVGElement>(selectorsToHide.join(',')))
        .map((element) => ({ element, display: element.style.display }));

      hiddenElements.forEach(({ element }) => {
        element.style.display = 'none';
      });

      // The paper element has a page border + drop shadow for the editor view.
      // Strip them during capture so the exported PNG is a clean white page.
      const prevBorder = paperElement.style.border;
      const prevBoxShadow = paperElement.style.boxShadow;
      paperElement.style.border = 'none';
      paperElement.style.boxShadow = 'none';

      try {
        const canvas = await html2canvas(paperElement, {
          backgroundColor: exportTransparentBg ? null : '#ffffff',
          scale: multiplier,
          useCORS: true,
          logging: false,
          width: paperElement.offsetWidth,
          height: paperElement.offsetHeight,
          scrollX: 0,
          scrollY: 0,
          x: 0,
          y: 0,
        });

        if (!exportTransparentBg) {
          const context = canvas.getContext('2d');
          if (context) {
            context.save();
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, 2);
            context.fillRect(0, canvas.height - 2, canvas.width, 2);
            context.fillRect(0, 0, 2, canvas.height);
            context.fillRect(canvas.width - 2, 0, 2, canvas.height);
            context.restore();
          }
        }

        return canvas;
      } finally {
        hiddenElements.forEach(({ element, display }) => {
          element.style.display = display;
        });
        paperElement.style.border = prevBorder;
        paperElement.style.boxShadow = prevBoxShadow;
        // Restore original zoom and pan
        store.setZoom(originalZoom);
        store.setPan(originalPan);
      }
    };

    if (exportFormat === 'SVG') {
      try {
        const svgClone = prepareSvgClone();
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgClone);

        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${project.title || 'floormap'}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        onClose();
      } catch (err: any) {
        alert(t('export.failed').replace('{error}', err.message) || 'SVG Export failed: ' + err.message);
      }
    } else if (exportFormat === 'PNG') {
      try {
        const canvas = await capturePaperCanvas(exportScaleMultiplier);
        const pngDataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = pngDataUrl;
        link.download = `${project.title || 'floormap'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        onClose();
      } catch (err: any) {
        alert(t('export.failed').replace('{error}', err.message) || 'PNG Export failed: ' + err.message);
      }
    } else if (exportFormat === 'PDF') {
      try {
        const canvas = await capturePaperCanvas(2);
        const pngDataUrl = canvas.toDataURL('image/png');

        const format = exportPdfPaperSize.toLowerCase();
        const orientation = exportPdfOrientation;

        const doc = new jsPDF({
          orientation: orientation,
          unit: 'mm',
          format: format
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const margin = exportPdfMargin;
        const maxDrawWidth = pageWidth - (margin * 2);
        const maxDrawHeight = pageHeight - (margin * 2);

        const drawingRatio = canvas.width / canvas.height;

        let drawWidth = maxDrawWidth;
        let drawHeight = maxDrawWidth / drawingRatio;

        if (drawHeight > maxDrawHeight) {
          drawHeight = maxDrawHeight;
          drawWidth = maxDrawHeight * drawingRatio;
        }

        const xOffset = margin + (maxDrawWidth - drawWidth) / 2;
        const yOffset = margin + (maxDrawHeight - drawHeight) / 2;

        doc.addImage(pngDataUrl, 'PNG', xOffset, yOffset, drawWidth, drawHeight);

        if (exportPdfScaleLabel) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor('#475569');
          const scaleText = `Scale: ${project.scale.status === 'calibrated' ? project.scale.drawingScale : 'Not Calibrated'}`;
          doc.text(scaleText, margin, pageHeight - margin + 4);
        }

        doc.save(`${project.title || 'floormap'}.pdf`);
        onClose();
      } catch (err: any) {
        alert(t('export.failed').replace('{error}', err.message) || 'PDF Export failed: ' + err.message);
      }
    } else {
      alert(`${exportFormat} Export is not fully implemented yet.`);
    }
  };

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
        width: '400px',
        maxWidth: '90vw',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{t('export.title')}</span>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-secondary)' }}
          >
            &times;
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>{t('export.format')}</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['SVG', 'PNG', 'PDF'] as const).map((fmt) => (
                <button
                  key={fmt}
                  className={`toolbar-btn ${exportFormat === fmt ? 'active' : ''}`}
                  onClick={() => setExportFormat(fmt)}
                  style={{ height: '28px', fontSize: '11px', padding: '0 10px', minWidth: '45px' }}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          <div className="toolbar-divider" style={{ width: '100%', height: '1px', margin: '4px 0' }}></div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: 500, color: 'var(--text-primary)' }}>
            <input
              type="checkbox"
              checked={exportIncludeBg}
              onChange={(e) => setExportIncludeBg(e.target.checked)}
            />
            {t('export.includeBg')}
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: 500, color: 'var(--text-primary)' }}>
            <input
              type="checkbox"
              checked={exportIncludeGrid}
              onChange={(e) => setExportIncludeGrid(e.target.checked)}
            />
            {t('export.includeGrid')}
          </label>

          {exportFormat === 'PNG' && (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: 500, color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={exportTransparentBg}
                  onChange={(e) => setExportTransparentBg(e.target.checked)}
                />
                {t('export.transparentBg')}
              </label>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>{t('export.scale')}</span>
                <select
                  className="prop-input"
                  value={exportScaleMultiplier}
                  onChange={(e) => setExportScaleMultiplier(parseInt(e.target.value))}
                  style={{ height: '28px', fontSize: '12px', width: '150px' }}
                >
                  <option value="1">1x (Draft)</option>
                  <option value="2">2x (Standard Print)</option>
                  <option value="4">4x (High Res Print)</option>
                </select>
              </div>
            </>
          )}
          {exportFormat === 'PDF' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>{t('export.pdfPaperSize')}</span>
                <select
                  className="prop-input"
                  value={exportPdfPaperSize}
                  onChange={(e) => setExportPdfPaperSize(e.target.value as any)}
                  style={{ height: '28px', fontSize: '12px', width: '150px' }}
                >
                  <option value="A4">A4</option>
                  <option value="A3">A3</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>{t('export.pdfOrientation')}</span>
                <select
                  className="prop-input"
                  value={exportPdfOrientation}
                  onChange={(e) => setExportPdfOrientation(e.target.value as any)}
                  style={{ height: '28px', fontSize: '12px', width: '150px' }}
                >
                  <option value="landscape">Landscape</option>
                  <option value="portrait">Portrait</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>{t('export.pdfMargin')}</span>
                <input
                  className="prop-input"
                  type="number"
                  value={exportPdfMargin}
                  onChange={(e) => setExportPdfMargin(Math.max(0, parseInt(e.target.value) || 0))}
                  style={{ height: '28px', fontSize: '12px', width: '150px' }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  checked={exportPdfScaleLabel}
                  onChange={(e) => setExportPdfScaleLabel(e.target.checked)}
                />
                {t('export.pdfScaleLabel')}
              </label>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          <button
            className="toolbar-btn"
            style={{ flex: 1, height: '36px' }}
            onClick={onClose}
          >
            {t('common.cancel')}
          </button>
          <button
            className="toolbar-btn"
            style={{ flex: 1, height: '36px', backgroundColor: 'var(--primary)', color: '#ffffff', borderColor: 'var(--primary)' }}
            onClick={handleExportExecute}
          >
            {t('export.performExport')}
          </button>
        </div>
      </div>
    </div>
  );
};
