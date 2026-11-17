import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Beklenmeyen bir yükleme hatası oluştu.'
    };
  }

  componentDidCatch(error: Error) {
    console.error('Dilbaz render boundary caught:', error);
  }

  private handleHardReload = async () => {
    try {
      if ('caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((k) => window.caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {
      // ignore cleanup errors
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] w-full bg-[#0d1629] text-[#F8FAFC] flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-[28px] bg-[#14213D] border border-[#FFBE0B]/40 p-6 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 mx-auto rounded-full bg-[#FF006E]/20 border border-[#FF006E]/50 flex items-center justify-center text-2xl">
              🕊️
            </div>
            <h1 className="font-display text-xl font-bold text-[#FFBE0B]">
              Dilbaz Yeniden Başlatılıyor
            </h1>
            <p className="text-xs text-[#CBD5E1] leading-relaxed">
              Görünüm yüklenirken geçici bir sorun oluştu. Aşağıdaki düğmeyle önbelleği temizleyip uygulamayı yeniden açabilirsiniz.
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 py-3 px-4 rounded-xl bg-[#3A86FF] text-white text-xs font-bold cursor-pointer"
              >
                Sayfayı Yenile
              </button>
              <button
                type="button"
                onClick={this.handleHardReload}
                className="flex-1 py-3 px-4 rounded-xl bg-[#FFBE0B] text-[#0d1629] text-xs font-bold cursor-pointer"
              >
                Önbelleği Temizle & Aç
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
}
