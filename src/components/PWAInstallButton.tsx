import React, { useState } from 'react';
import { Download, Share, X, WifiOff } from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';
import { playTone } from '../utils/soundEffects';

interface PWAInstallButtonProps {
  compact?: boolean;
  onInstalledOrClicked?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  onInstalledOrClicked
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={async () => {
          playTone('tap');
          await install();
          onInstalledOrClicked?.();
        }}
        className={
          compact
            ? 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#06D6A0]/20 hover:bg-[#06D6A0]/30 border border-[#06D6A0]/50 text-[#06D6A0] text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0'
            : 'min-h-[44px] w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#06D6A0]/20 hover:bg-[#06D6A0]/30 border border-[#06D6A0]/50 text-[#06D6A0] text-xs font-bold transition-colors cursor-pointer'
        }
        title="Dilbaz Uygulamasını Cihaza Yükle"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>{compact ? 'Yükle' : 'Uygulamayı Cihaza Yükle (PWA)'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            playTone('tap');
            setShowIOSGuide(true);
          }}
          className={
            compact
              ? 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#06D6A0]/15 hover:bg-[#06D6A0]/25 border border-[#06D6A0]/45 text-[#06D6A0] text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0'
              : 'min-h-[44px] w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#06D6A0]/15 hover:bg-[#06D6A0]/25 border border-[#06D6A0]/45 text-[#06D6A0] text-xs font-bold transition-colors cursor-pointer'
          }
          title="iPhone / iPad Ana Ekrana Ekle"
        >
          <Share className="w-3.5 h-3.5 shrink-0" />
          <span>{compact ? 'Yükle' : 'Ana Ekrana Ekle (iOS)'}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-[#090e1a]/85 backdrop-blur-md">
            <div className="w-full max-w-sm rounded-[24px] bg-[#14213D] border border-[#00F5D4]/45 p-5 shadow-2xl space-y-3 text-left">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white font-display">
                  iPhone / iPad Kurulumu
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-[#94A3B8] hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="text-xs text-[#CBD5E1] space-y-2 list-decimal pl-4 leading-relaxed">
                <li>
                  Safari alt çubuğundaki <strong>Paylaş</strong> simgesine dokunun.
                </li>
                <li>
                  Listede aşağı kaydırıp <strong>Ana Ekrana Ekle</strong> seçeneğine basın.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl btn-epic-turquoise text-xs font-bold cursor-pointer"
              >
                Anladım
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-16 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-[#FF006E] px-3.5 py-2 text-xs font-bold text-white shadow-xl border border-white/20">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Çevrimdışı mod — İnternet bağlantısı bekleniyor</span>
    </div>
  );
};
