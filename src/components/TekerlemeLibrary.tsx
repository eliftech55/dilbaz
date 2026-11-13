import React, { useState } from 'react';
import { Tekerleme, UserNotification } from '../types/game';
import { RumiCorners } from './EbruBackground';
import { POINTS_FOR_APPROVED_TEKERLEME } from '../firebase/authService';
import { playTone } from '../utils/soundEffects';
import {
  Search,
  Plus,
  Volume2,
  Mic,
  Clock,
  Pencil,
  Trash2,
  RotateCcw,
  ShieldCheck,
  Check,
  Hourglass,
  Sparkles,
  LogIn,
  Bell,
  Lock,
  Database
} from 'lucide-react';

interface TekerlemeLibraryProps {
  tekerlemeler: Tekerleme[];
  myContributions: Tekerleme[];
  adminContributions: Tekerleme[];
  notifications?: UserNotification[];
  isSignedIn: boolean;
  currentUid?: string | null;
  isAdmin: boolean;
  onOpenAuth: () => void;
  onSelectForPractice: (tekerleme: Tekerleme) => void;
  onOpenAddModal: () => void;
  onEditTekerleme: (tekerleme: Tekerleme) => void;
  onDeleteTekerleme: (tekerleme: Tekerleme) => Promise<void> | void;
  onApproveContribution?: (tekerleme: Tekerleme) => Promise<void> | void;
  onDismissNotification?: (notificationId: string) => void;
  onResetDefaults?: () => void;
  onSyncSeedToFirestore?: () => Promise<{ added: number; skipped: number } | undefined>;
}

export const TekerlemeLibrary: React.FC<TekerlemeLibraryProps> = ({
  tekerlemeler,
  myContributions,
  adminContributions,
  notifications = [],
  isSignedIn,
  isAdmin,
  onOpenAuth,
  onSelectForPractice,
  onOpenAddModal,
  onEditTekerleme,
  onDeleteTekerleme,
  onApproveContribution,
  onDismissNotification,
  onResetDefaults,
  onSyncSeedToFirestore
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyContribId, setBusyContribId] = useState<string | null>(null);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const tekerlemeNotifications = notifications.filter(
    (n) =>
      n.type === 'tekerleme_approved' ||
      n.type === 'tekerleme_deleted' ||
      n.type === 'tekerleme_rejected'
  );

  // 1. NON-MEMBERS (GUESTS): Cannot view Tekerleme Havuzu at all
  if (!isSignedIn) {
    return (
      <div className="max-w-2xl mx-auto py-8 animate-screen-in">
        <div className="ebru-glass-card rounded-[28px] p-8 sm:p-10 text-center space-y-5 border border-[#00F5D4]/30">
          <div className="w-16 h-16 rounded-2xl bg-[#0d1629] border border-[#00F5D4]/45 mx-auto flex items-center justify-center shadow-lg shadow-[#00F5D4]/15">
            <Lock className="w-8 h-8 text-[#00F5D4]" />
          </div>

          <div className="space-y-2">
            <span className="inline-block text-[11px] font-display font-bold uppercase tracking-wider text-[#00F5D4]">
              ✦ Üyelere Özel Alan
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">
              Tekerleme Havuzu Üyelere Özeldir
            </h1>
            <p className="text-xs sm:text-sm text-[#CBD5E1] max-w-md mx-auto leading-relaxed">
              Tekerleme havuzunu üye olmayanlar görüntüleyemez. Üye girişi yaparak kendi tekerleme önerilerinizi gönderebilir ve yönetici onay durumunu takip edebilirsiniz.
            </p>
          </div>

          <div className="pt-1 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                playTone('tap');
                onOpenAuth();
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl btn-epic-turquoise font-bold text-sm cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Giriş Yap / Üye Ol</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const playTTS = (text: string) => {
    playTone('tap');
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'tr-TR';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  // 2. REGISTERED MEMBERS (NON-ADMIN): Can ONLY see & track their own submitted tekerlemeler
  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto space-y-5 animate-screen-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="inline-block text-[11px] font-display font-bold uppercase tracking-wider text-[#00F5D4] mb-1">
              ✦ Üye Katkı Paneli
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">
              Tekerleme Önerilerim
            </h1>
            <p className="text-xs text-[#CBD5E1] mt-0.5">
              Burada yalnızca kendi önerdiğiniz tekerlemeleri görebilir ve onay durumunu takip edebilirsiniz. Onaylanan her katkı{' '}
              <strong className="text-[#FFBE0B]">+{POINTS_FOR_APPROVED_TEKERLEME} Puan</strong> kazandırır.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              playTone('tap');
              onOpenAddModal();
            }}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl btn-epic-pomegranate font-bold text-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>TEKERLEME ÖNER (+{POINTS_FOR_APPROVED_TEKERLEME} Puan)</span>
          </button>
        </div>

        {/* Notifications */}
        {tekerlemeNotifications.length > 0 && (
          <div className="space-y-2">
            {tekerlemeNotifications.slice(0, 5).map((notif) => {
              const isApproved = notif.type === 'tekerleme_approved';
              return (
                <div
                  key={notif.id}
                  className={`p-3.5 rounded-2xl border flex items-start justify-between gap-3 text-xs ${
                    isApproved
                      ? 'bg-[#06D6A0]/18 border-[#06D6A0]/50 text-emerald-100'
                      : 'bg-[#FF006E]/18 border-[#FF006E]/45 text-rose-100'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <Bell
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        isApproved ? 'text-[#06D6A0]' : 'text-[#FF006E]'
                      }`}
                    />
                    <div>
                      <div className="font-bold">{notif.title}</div>
                      <p className="text-[11px] opacity-90 mt-0.5">{notif.message}</p>
                    </div>
                  </div>
                  {onDismissNotification && (
                    <button
                      type="button"
                      onClick={() => {
                        playTone('tap');
                        onDismissNotification(notif.id);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold shrink-0 cursor-pointer"
                    >
                      Tamam
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Member's own contributions only */}
        <div className="p-5 ebru-glass-card rounded-[26px] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#00F5D4] font-display flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FFBE0B]" />
              <span>Eklediğim Tekerlemeler ve Onay Durumu ({myContributions.length})</span>
            </h2>
            <span className="text-[11px] text-[#94A3B8]">
              Tam tekerleme havuzunu görüntüleme ve düzenleme yalnızca yöneticilere açıktır
            </span>
          </div>

          {myContributions.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#0d1629]/75 border border-white/10 text-center space-y-3">
              <p className="text-sm text-[#CBD5E1]">
                Henüz önerdiğiniz bir tekerleme bulunmuyor.
              </p>
              <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
                Yeni bir tekerleme önerdiğinizde yönetici incelemesine düşer; onaylandığında veritabanına eklenir ve hesabınıza +{POINTS_FOR_APPROVED_TEKERLEME} Puan işlenir.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {myContributions.map((c) => {
                const statusBadge =
                  c.status === 'approved'
                    ? {
                        text: `Veritabanına Eklendi (+${POINTS_FOR_APPROVED_TEKERLEME}p)`,
                        cls: 'bg-[#06D6A0]/20 text-[#6EE7B7] border-[#06D6A0]/45'
                      }
                    : c.status === 'rejected'
                    ? {
                        text: 'Onaylanmadı',
                        cls: 'bg-[#FF006E]/20 text-rose-200 border-[#FF006E]/45'
                      }
                    : {
                        text: 'Yönetici Onayı Bekliyor',
                        cls: 'bg-[#FFBE0B]/20 text-[#FDE68A] border-[#FFBE0B]/45'
                      };

                const isConfirming = confirmDeleteId === c.id;

                return (
                  <div
                    key={c.id}
                    className="p-4 rounded-2xl bg-[#0d1629]/85 border border-white/12 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-bold text-white font-display">{c.title}</div>
                        <span className="text-[10px] font-mono text-[#93C5FD] shrink-0">
                          {c.difficulty} · {c.benchmarkSeconds}sn
                        </span>
                      </div>

                      <p className="text-xs text-[#E2E8F0] bg-white/5 p-2.5 rounded-xl border border-white/10 leading-relaxed">
                        "{c.text}"
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusBadge.cls}`}
                      >
                        {c.status === 'pending' && <Hourglass className="w-3 h-3" />}
                        {c.status === 'approved' && <Check className="w-3 h-3" />}
                        {statusBadge.text}
                      </span>

                      {c.status === 'pending' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              playTone('tap');
                              onEditTekerleme(c);
                            }}
                            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[#93C5FD] cursor-pointer"
                            title="Düzenle"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {isConfirming ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={async () => {
                                  playTone('wrong');
                                  await onDeleteTekerleme(c);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 rounded-lg bg-[#FF006E] text-white text-[10px] font-bold cursor-pointer"
                              >
                                Sil
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 rounded-lg bg-white/10 text-white text-[10px] cursor-pointer"
                              >
                                Vazgeç
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                playTone('tap');
                                setConfirmDeleteId(c.id);
                              }}
                              className="p-1.5 rounded-lg bg-[#FF006E]/20 hover:bg-[#FF006E]/35 text-rose-200 cursor-pointer"
                              title="Öneriyi Geri Çek"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. ADMIN (YÖNETİCİ): Full Tekerleme Havuzu View, Add, Edit, Delete, Approve, Sync
  const filtered = tekerlemeler.filter((t) => {
    const matchesSearch =
      t.title.toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR')) ||
      t.text.toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR'));
    const matchesDiff = selectedDifficulty === 'all' || t.difficulty === selectedDifficulty;
    return matchesSearch && matchesDiff;
  });

  const pendingForAdmin = adminContributions.filter((c) => c.status === 'pending');

  const handleManualSync = async () => {
    if (!onSyncSeedToFirestore || isSyncing) return;
    playTone('tap');
    setIsSyncing(true);
    setSyncStatusMsg(null);
    try {
      const res = await onSyncSeedToFirestore();
      if (res) {
        setSyncStatusMsg(
          res.added > 0
            ? `${res.added} yeni tekerleme Firestore veritabanına eklendi!`
            : `Tüm tekerlemeler veritabanıyla senkronize (${tekerlemeler.length} kayıt).`
        );
      }
    } catch (err: any) {
      setSyncStatusMsg(err?.message || 'Senkronizasyon sırasında hata oluştu.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-screen-in">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="inline-block text-[11px] font-display font-bold uppercase tracking-wider text-[#00F5D4] mb-1">
            ✦ Yönetici Tekerleme Veritabanı
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">
            Tekerleme Veritabanı & Havuzu
          </h1>
          <p className="text-xs text-[#CBD5E1] mt-0.5">
            Toplam {tekerlemeler.length} benzersiz tekerleme ·{' '}
            <strong className="text-[#FFBE0B]">
              Yönetici Yetkisi: Görüntüleme, ekleme, düzenleme, onaylama ve silme aktif
            </strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onSyncSeedToFirestore && (
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleManualSync}
              className="flex items-center gap-1.5 px-3.5 py-3 rounded-2xl bg-[#3A86FF]/20 hover:bg-[#3A86FF]/35 border border-[#3A86FF]/45 text-[#93C5FD] hover:text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Varsayılan tekerlemeleri Firestore veritabanıyla senkronize et"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{isSyncing ? 'Senkronize ediliyor...' : 'DB Senkronize Et'}</span>
            </button>
          )}

          {onResetDefaults && (
            <button
              type="button"
              onClick={() => {
                playTone('tap');
                onResetDefaults();
              }}
              className="flex items-center gap-1.5 px-3.5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-[#CBD5E1] hover:text-white font-semibold text-xs transition-colors cursor-pointer"
              title="Varsayılan tekerlemeleri geri yükle"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Varsayılanlar</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              playTone('tap');
              onOpenAddModal();
            }}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl btn-epic-pomegranate font-bold text-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>VERİTABANINA TEKERLEME EKLE</span>
          </button>
        </div>
      </div>

      {syncStatusMsg && (
        <div className="p-3 rounded-2xl bg-[#06D6A0]/18 border border-[#06D6A0]/45 text-emerald-100 text-xs font-semibold flex items-center justify-between gap-2">
          <span>{syncStatusMsg}</span>
          <button
            type="button"
            onClick={() => setSyncStatusMsg(null)}
            className="px-2 py-0.5 rounded bg-white/10 text-[11px] cursor-pointer"
          >
            Kapat
          </button>
        </div>
      )}

      {/* ADMIN MODERATION PANEL */}
      {pendingForAdmin.length > 0 && (
        <div className="p-5 ebru-glass-card border-[1.5px] border-[#FFBE0B]/55 rounded-[26px] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm sm:text-base font-bold text-[#FFBE0B] font-display flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              <span>Yönetici Onay Kuyruğu ({pendingForAdmin.length} Önerilen Tekerleme)</span>
            </h2>
            <span className="text-[11px] text-[#CBD5E1]">
              Onayladığınız veya sildiğiniz tekerlemeler öneren üyeye anında bildirilir
            </span>
          </div>

          <div className="space-y-2.5">
            {pendingForAdmin.map((item) => {
              const isBusy = busyContribId === item.id;
              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-[#0d1629]/85 border border-white/15 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-bold text-white font-display">{item.title}</span>
                      <span className="ml-2 text-[11px] text-[#93C5FD]">
                        Öneren: <strong>{item.authorUsername || 'Üye'}</strong>
                      </span>
                    </div>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#FFBE0B]/20 text-[#FFBE0B] border border-[#FFBE0B]/40">
                      {item.difficulty} · {item.benchmarkSeconds}s
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-[#F8FAFC] bg-white/5 p-3 rounded-xl border border-white/10">
                    "{item.text}"
                  </p>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        playTone('tap');
                        onEditTekerleme(item);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Düzenle
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={async () => {
                        playTone('wrong');
                        setBusyContribId(item.id);
                        try {
                          await onDeleteTekerleme(item);
                        } finally {
                          setBusyContribId(null);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#FF006E]/20 hover:bg-[#FF006E]/35 border border-[#FF006E]/45 text-xs font-bold text-rose-200 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Sil (Reddet)
                    </button>

                    {onApproveContribution && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={async () => {
                          playTone('victory');
                          setBusyContribId(item.id);
                          try {
                            await onApproveContribution(item);
                          } finally {
                            setBusyContribId(null);
                          }
                        }}
                        className="px-4 py-1.5 rounded-xl btn-epic-turquoise text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Onayla ve Havuza Ekle (+{POINTS_FOR_APPROVED_TEKERLEME} Puan)</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter and Search Bar (Admin Only) */}
      <div className="p-4 ebru-glass-card rounded-[24px] space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#93C5FD] absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tekerleme metninde veya başlığında ara..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#0d1629]/85 border border-white/15 rounded-xl text-white text-xs sm:text-sm focus:border-[#FFBE0B] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-bold text-[#93C5FD] uppercase mr-1">Zorluk:</span>
          {['all', 'kolay', 'orta', 'zor', 'efsane'].map((diff) => (
            <button
              key={diff}
              onClick={() => {
                playTone('tap');
                setSelectedDifficulty(diff);
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors cursor-pointer ${
                selectedDifficulty === diff
                  ? 'bg-gradient-to-r from-[#FFBE0B] to-[#FF5400] text-[#0d1629] font-bold'
                  : 'bg-white/5 text-[#CBD5E1] hover:text-white border border-white/10'
              }`}
            >
              {diff === 'all' ? 'Tümü' : diff}
            </button>
          ))}
        </div>
      </div>

      {/* Cloud Light Rumi-Cornered Tekerleme Cards Grid (Admin Only) */}
      <div className="grid sm:grid-cols-2 gap-4">
        {filtered.map((item) => {
          let diffBadge = 'bg-[#06D6A0]/15 text-[#065F46] border-[#06D6A0]/40';
          if (item.difficulty === 'orta') diffBadge = 'bg-[#FFBE0B]/25 text-[#92400E] border-[#F59E0B]/50';
          if (item.difficulty === 'zor') diffBadge = 'bg-[#FF006E]/15 text-[#9F1239] border-[#FF006E]/45';
          if (item.difficulty === 'efsane') diffBadge = 'bg-[#3A86FF]/18 text-[#1E3A8A] border-[#3A86FF]/45';

          const isConfirmingDelete = confirmDeleteId === item.id;

          return (
            <div
              key={item.id}
              className="relative ebru-cloud-card rounded-[24px] p-5 flex flex-col justify-between space-y-4 overflow-hidden transition-transform hover:-translate-y-0.5"
            >
              <RumiCorners />

              <div className="relative z-10 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] uppercase font-bold font-mono px-2.5 py-0.5 rounded-full border ${diffBadge}`}>
                      {item.difficulty}
                    </span>
                    {item.authorUsername && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#3A86FF]/15 text-[#1E3A8A] border border-[#3A86FF]/30">
                        {item.authorUsername}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs font-semibold text-[#334155]">
                      <Clock className="w-3.5 h-3.5 text-[#3A86FF]" />
                      <span>{item.benchmarkSeconds} sn</span>
                    </div>

                    <button
                      onClick={() => {
                        playTone('tap');
                        setConfirmDeleteId(null);
                        onEditTekerleme(item);
                      }}
                      className="p-1.5 rounded-lg bg-[#3A86FF]/15 hover:bg-[#3A86FF]/25 text-[#1D4ED8] transition-colors cursor-pointer"
                      title="Tekerlemeyi Düzenle"
                      aria-label="Tekerlemeyi Düzenle"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        playTone('tap');
                        setConfirmDeleteId(isConfirmingDelete ? null : item.id);
                      }}
                      className="p-1.5 rounded-lg bg-[#FF006E]/15 hover:bg-[#FF006E]/25 text-[#BE123C] transition-colors cursor-pointer"
                      title="Tekerlemeyi Sil"
                      aria-label="Tekerlemeyi Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isConfirmingDelete && (
                  <div className="p-2.5 rounded-xl bg-[#FF006E]/12 border border-[#FF006E]/40 flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#9F1239]">Silmek istiyor musunuz?</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={async () => {
                          playTone('wrong');
                          await onDeleteTekerleme(item);
                          setConfirmDeleteId(null);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#FF006E] text-white font-bold cursor-pointer"
                      >
                        Evet, Sil
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2.5 py-1 rounded-lg bg-white text-[#14213D] font-semibold border border-[#14213D]/15 cursor-pointer"
                      >
                        Vazgeç
                      </button>
                    </div>
                  </div>
                )}

                <h2 className="text-lg font-bold text-[#14213D] font-display">
                  {item.title}
                </h2>

                <p className="text-sm text-[#1E293B] leading-relaxed font-medium bg-white/75 p-3 rounded-xl border border-[#3A86FF]/20">
                  "{item.text}"
                </p>

                <p className="text-xs text-[#475569] line-clamp-2">
                  <span className="font-semibold text-[#1D4ED8]">İpucu:</span> {item.tip}
                </p>
              </div>

              <div className="relative z-10 pt-3 border-t border-[#14213D]/10 flex items-center justify-between gap-2">
                <button
                  onClick={() => playTTS(item.text)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#14213D] hover:bg-[#1e2f54] text-xs font-semibold text-[#FFBE0B] transition-colors cursor-pointer"
                  title="Sesli Örnek Dinle"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Dinle</span>
                </button>

                <button
                  onClick={() => {
                    playTone('tap');
                    onSelectForPractice(item);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl btn-epic-pomegranate font-bold text-xs cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Pratik Et</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="p-12 text-center ebru-glass-card rounded-[28px] space-y-3">
          <p className="text-[#CBD5E1] text-sm">
            Aradığınız kriterlere uygun tekerleme bulunamadı.
          </p>
          {tekerlemeler.length === 0 && onResetDefaults && (
            <button
              onClick={() => {
                playTone('tap');
                onResetDefaults();
              }}
              className="px-4 py-2 rounded-xl btn-epic-turquoise text-xs font-bold cursor-pointer"
            >
              Varsayılan Tekerlemeleri Yükle
            </button>
          )}
        </div>
      )}
    </div>
  );
};
