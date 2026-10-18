import React from 'react';
import AppShell from './app/AppShell';
import WorkspaceGate from './app/WorkspaceGate';
import { I18nProvider } from './i18n';
import { SymbolGallery } from './dev/SymbolGallery';

const App: React.FC = () => {
  const isSymbolGallery = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('dev') === 'symbols';

  return (
    <I18nProvider>
      {isSymbolGallery ? <SymbolGallery /> : <WorkspaceGate><AppShell /></WorkspaceGate>}
    </I18nProvider>
  );
};

export default App;
