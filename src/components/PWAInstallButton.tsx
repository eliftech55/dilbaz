import React, { useState } from 'react';
import { Download, Smartphone, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { playTone } from '../utils/soundEffects';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, triggerInstall } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#06D6A0]/15 border border-[#06D6A0]/40 text-[#06D6A0] text-[11px] font-bold">
        <Smartphone className="w-3.5 h-3.5" />
        <span>Telefon Uygulaması Aktif</span>
      </span>
    );
  }

  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          playTone('tap');
          if (isInstallable) {
            triggerInstall();
          } else if (isIOS) {
            setShowIOSGuide(true);
          }
        }}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#3A86FF] to-[#00F5D4] text-[#0d1629] text-xs font-bold shadow-md hover:opacity-95 transition-opacity cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Telefona Uygulamayı Yükle</span>
      </button>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-sm w-full ebru-glass-card rounded-[26px] p-5 space-y-4 border border-[#00F5D4]/40">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#00F5D4]" />
                <span>iPhone / iPad Kurulumu</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="p-1.5 rounded-lg bg-white/10 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="text-xs text-[#CBD5E1] space-y-2 list-decimal list-inside leading-relaxed">
              <li>
                Safari alt çubuğundaki <Share className="inline w-3.5 h-3.5 text-[#00F5D4] mx-1" />{' '}
                <strong className="text-white">Paylaş</strong> simgesine dokunun.
              </li>
              <li>
                Aşağı kaydırıp <strong className="text-white">"Ana Ekrana Ekle"</strong> seçeneğini seçin.
              </li>
              <li>
                Ana ekrandan Dilbaz ikonunu açtığınızda mobil bildirimler tam uyumlu çalışır.
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-xl bg-[#00F5D4] text-[#0d1629] font-bold text-xs cursor-pointer"
            >
              Anladım
            </button>
          </div>
        </div>
      )}
    </>
  );
};
