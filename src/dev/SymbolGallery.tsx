import React from 'react';
import { ClassroomArrayIcon, PlanSymbolRenderer } from '../symbols/PlanSymbol';
import { PLAN_SYMBOLS } from '../symbols/symbolMetadata';

const tileStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  padding: '12px',
};

const labelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 700, marginBottom: '10px' };

export const SymbolGallery: React.FC = () => {
  const symbols = Object.values(PLAN_SYMBOLS);

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px', color: '#0f172a' }}>
      <h1 style={{ margin: '0 0 20px', fontSize: '24px' }}>Plan Symbol Gallery</h1>
      <div
        data-testid="symbol-gallery"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '14px',
        }}
      >
        {/* Classroom layout array is a toolbar-only composition (it places individual desk +
            chair objects rather than a single furniture symbol), so it's previewed here using
            the same ClassroomArrayIcon shown in the parts toolbar. */}
        <section key="classroom_array" data-symbol-id="classroom_array" style={tileStyle}>
          <div style={labelStyle}>Classroom Layout Array</div>
          <div data-testid="symbol-classroom_array" className="symbol-classroom_array">
            <ClassroomArrayIcon size={140} />
          </div>
        </section>

        {symbols.map((symbol) => {
          // Scale the main preview to the symbol's real width:height ratio (capped to a 72px
          // longest side) so aspect-ratio bugs — e.g. a bed rendered so wide/short its pillow
          // gets stretched — are visible here, not just on the canvas at real furniture size.
          const scale = 72 / Math.max(symbol.defaultWidth, symbol.defaultHeight);
          const mainW = symbol.defaultWidth * scale;
          const mainH = symbol.defaultHeight * scale;
          return (
            <section
              key={symbol.id}
              data-symbol-id={symbol.id}
              style={tileStyle}
            >
              <div style={labelStyle}>{symbol.label}</div>
              <svg width="150" height="92" viewBox="-75 -46 150 92" data-testid={`symbol-${symbol.id}`}>
                <PlanSymbolRenderer symbolId={symbol.id} width={mainW} height={mainH} stroke="#0f172a" fill="none" detailStroke="#64748b" />
                <g transform="translate(54 0) rotate(90)">
                  <PlanSymbolRenderer symbolId={symbol.id} width={32} height={32} stroke="#0f172a" fill="none" detailStroke="#64748b" />
                </g>
                <g transform="translate(-54 0)">
                  <PlanSymbolRenderer symbolId={symbol.id} width={26} height={26} stroke="#0f172a" fill="none" detailStroke="#64748b" />
                </g>
              </svg>
            </section>
          );
        })}

        {/* Legacy alias check: old saved projects may still contain furnitureType:
            "male_toilet". It must keep rendering (as the urinal symbol) instead of
            falling back to the unknown-symbol placeholder. */}
        <section key="legacy_male_toilet" data-symbol-id="legacy_male_toilet" style={tileStyle}>
          <div style={labelStyle}>Legacy: male_toilet → urinal</div>
          <svg width="150" height="92" viewBox="-75 -46 150 92" data-testid="symbol-legacy-male_toilet">
            <PlanSymbolRenderer symbolId="male_toilet" width={72} height={72} stroke="#0f172a" fill="none" detailStroke="#64748b" />
          </svg>
        </section>
      </div>
    </main>
  );
};

export default SymbolGallery;
