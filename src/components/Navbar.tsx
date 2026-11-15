import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { UserProfile } from '../types/game';
import { KilimAvatar } from './KilimAvatar';
import { PhoenixWingPair } from './DilbazMascot';
import { PWAInstallButton } from './PWAInstallButton';
import { playTone } from '../utils/soundEffects';
import {
  getNotificationSupportState,
  requestMobileNotificationPermission
} from '../utils/mobileNotifications';
import {
  Smartphone,
  Monitor,
  BookOpen,
  Mic,
  Users,
  Trophy,
  HelpCircle,
  Volume2,
  VolumeX,
  PlayCircle,
  LogIn,
  ShieldCheck,
  UserPlus,
  Menu,
  X,
  Bell,
  Swords
} from 'lucide-react';

export type AppTab = 'room' | 'solo' | 'library' | 'friends' | 'leaderboard' | 'admin';

export interface NavbarNotificationItem {
  id: string;
  title: string;
  body: string;
  kind: 'invite' | 'friend' | 'notif' | 'declined';
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

interface NavbarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  isMobileView: boolean;
  setIsMobileView: (val: boolean) => void;
  onOpenGuide: () => void;
  pointsCount: number;
  pendingFriendsCount?: number;
  unreadNotificationsCount?: number;
  pendingAdminCount?: number;
  notificationItems?: NavbarNotificationItem[];
  onEnablePushNotifications?: () => Promise<void>;
  isMuted: boolean;
  onToggleMute: () => void;
  onReplayIntro: () => void;
  authUser: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isMobileView,
  setIsMobileView,
  onOpenGuide,
  pointsCount,
  pendingFriendsCount = 0,
  unreadNotificationsCount = 0,
  pendingAdminCount = 0,
  notificationItems = [],
  onEnablePushNotifications,
  isMuted,
  onToggleMute,
  onReplayIntro,
  authUser,
  userProfile,
  isAdmin,
  onOpenAuth
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    getNotificationSupportState().permission
  );
  const resolvedDisplayName =
    userProfile?.username || authUser?.displayName || authUser?.email?.split('@')[0] || 'Üye';
  const totalNotificationCount = Math.max(
    notificationItems.length,
    pendingFriendsCount + unreadNotificationsCount
  );
  const totalBadgeCount =
    pendingFriendsCount + unreadNotificationsCount + (isAdmin ? pendingAdminCount : 0);

  const handleSelectTab = (tab: AppTab) => {
    playTone('tap');
    setActiveTab(tab);
    setMobileMenuOpen(false);
    setNotifOpen(false);
  };

  const handleEnableOsNotifications = async () => {
    playTone('tap');
    const perm = await requestMobileNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted' && onEnablePushNotifications) {
      await onEnablePushNotifications();
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#0d1629]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-5 h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* Zone 1: Brand Logo & Title */}
        <button
          type="button"
          onClick={() => handleSelectTab('room')}
          className="flex items-center gap-2.5 shrink-0 text-left cursor-pointer pl-1.5"
        >
          <div className="relative w-8 h-8 sm:w-10 sm:h-10 shrink-0 mx-1">
            <PhoenixWingPair compact />
            <div className="relative z-10 w-full h-full rounded-full p-[2px] bg-gradient-to-tr from-[#3A86FF] via-[#FF006E] to-[#FFBE0B] shadow-lg shadow-[#FF006E]/25 animate-phoenix-bird-flap">
              <img
                src={`${import.meta.env.BASE_URL}assets/aistudio/logo_785c16ab.png`}
                alt="Dilbaz Logo"
                className="w-full h-full rounded-full object-cover bg-[#14213D]"
              />
            </div>
          </div>
          <div className="leading-tight ml-0.5">
            <span className="font-display text-lg sm:text-2xl font-bold tracking-wide bg-gradient-to-r from-white via-[#FFBE0B] to-[#FF006E] bg-clip-text text-transparent whitespace-nowrap">
              DİLBAZ
            </span>
            <span className="hidden xl:block text-[10px] text-[#93C5FD] font-medium tracking-wide whitespace-nowrap">
              Telaffuz ve Diksiyon Oyunları
            </span>
          </div>
        </button>

        {/* Zone 2: Desktop Navigation Tabs (lg+ so tablet/mobile never overflows) */}
        <nav className="hidden lg:flex items-center gap-1 bg-[#14213D]/80 p-1 rounded-2xl border border-white/10">
          <button
            type="button"
            onClick={() => handleSelectTab('room')}
            className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-2 rounded-xl text-[11px] xl:text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'room'
                ? 'bg-gradient-to-r from-[#3A86FF] to-[#2563EB] text-white shadow-md shadow-[#3A86FF]/30'
                : 'text-[#CBD5E1] hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Yarışma Odaları</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('solo')}
            className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-2 rounded-xl text-[11px] xl:text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'solo'
                ? 'bg-gradient-to-r from-[#FF006E] to-[#FF5400] text-white shadow-md shadow-[#FF006E]/30'
                : 'text-[#CBD5E1] hover:text-white hover:bg-white/5'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Bireysel Pratik</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('library')}
            className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-2 rounded-xl text-[11px] xl:text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'library'
                ? 'bg-gradient-to-r from-[#06D6A0] to-[#00B4D8] text-[#0d1629] font-bold shadow-md shadow-[#06D6A0]/30'
                : 'text-[#CBD5E1] hover:text-white hover:bg-white/5'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Tekerleme Havuzu</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('friends')}
            className={`relative flex items-center gap-1.5 px-2.5 xl:px-3 py-2 rounded-xl text-[11px] xl:text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'friends'
                ? 'bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white font-bold shadow-md shadow-[#EC4899]/30'
                : 'text-[#CBD5E1] hover:text-white hover:bg-white/5'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Arkadaşlar</span>
            {pendingFriendsCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-[#FF006E] text-white text-[10px] font-bold leading-none">
                {pendingFriendsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('leaderboard')}
            className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-2 rounded-xl text-[11px] xl:text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'leaderboard'
                ? 'bg-gradient-to-r from-[#FFBE0B] to-[#F59E0B] text-[#0d1629] font-bold shadow-md shadow-[#FFBE0B]/30'
                : 'text-[#CBD5E1] hover:text-white hover:bg-white/5'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Liderlik Panosu</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => handleSelectTab('admin')}
              className={`relative flex items-center gap-1.5 px-2.5 xl:px-3 py-2 rounded-xl text-[11px] xl:text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-gradient-to-r from-[#FFBE0B] via-[#F59E0B] to-[#FF5400] text-[#0d1629] font-bold shadow-md shadow-[#FFBE0B]/35'
                  : 'text-[#FFBE0B] bg-[#FFBE0B]/10 hover:bg-[#FFBE0B]/20 border border-[#FFBE0B]/30'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Yönetim</span>
              {pendingAdminCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-[#FF006E] text-white text-[10px] font-bold leading-none">
                  {pendingAdminCount}
                </span>
              )}
            </button>
          )}
        </nav>

        {/* Zone 3: Points + Account + Compact Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
          {/* Dilbaz Liderlik Puanı */}
          <button
            type="button"
            onClick={() => handleSelectTab('leaderboard')}
            className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-full bg-[#14213D]/90 border border-[#FFBE0B]/40 text-[#FFBE0B] font-display text-[11px] sm:text-sm font-bold shadow-sm hover:bg-[#FFBE0B]/15 transition-colors cursor-pointer shrink-0"
            title="Dilbaz Liderlik Puanınız"
          >
            <Trophy className="w-3.5 h-3.5 text-[#FFBE0B] shrink-0" />
            <span className="tabular-nums">{pointsCount}</span>
          </button>

          {/* Auth / Profile Chip */}
          {authUser ? (
            <button
              type="button"
              onClick={() => {
                playTone('tap');
                setMobileMenuOpen(false);
                onOpenAuth();
              }}
              className="flex items-center gap-1.5 pl-1 pr-2 sm:pl-1.5 sm:pr-2.5 py-1 rounded-full bg-[#14213D]/95 border border-[#00F5D4]/45 hover:border-[#FFBE0B] text-white text-xs font-semibold transition-all cursor-pointer max-w-[136px] sm:max-w-[180px] shrink-0"
              title={`Hesabım: ${resolvedDisplayName}`}
            >
              <KilimAvatar avatar={userProfile?.avatar || 'elibelinde'} size={22} />
              <span className="truncate max-w-[88px] sm:max-w-[120px]">
                {resolvedDisplayName}
              </span>
              {isAdmin && <ShieldCheck className="w-3.5 h-3.5 text-[#FFBE0B] shrink-0" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                playTone('tap');
                setMobileMenuOpen(false);
                onOpenAuth();
              }}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-gradient-to-r from-[#3A86FF] to-[#FF006E] text-white text-[11px] sm:text-xs font-bold shadow-md hover:opacity-95 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogIn className="w-3.5 h-3.5 shrink-0" />
              <span className="sm:hidden">Giriş</span>
              <span className="hidden sm:inline">Giriş / Kayıt</span>
            </button>
          )}

          {/* PWA Install Button (hidden when standalone/already installed) */}
          <div className="hidden sm:block">
            <PWAInstallButton compact />
          </div>

          {/* Replay Intro Video (xl+) */}
          <button
            type="button"
            onClick={onReplayIntro}
            className="hidden xl:flex w-8 h-8 rounded-full border border-white/15 bg-white/5 hover:bg-[#3A86FF]/25 text-[#93C5FD] hover:text-white items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Tanıtım Videosunu İzle"
            aria-label="Tanıtım Videosunu İzle"
          >
            <PlayCircle className="w-4 h-4" />
          </button>

          {/* Audio Toggle */}
          <button
            type="button"
            onClick={onToggleMute}
            className="w-8 h-8 rounded-full border border-white/15 bg-white/5 hover:bg-[#3A86FF]/25 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
            aria-label={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-[#FF006E]" />
            ) : (
              <Volume2 className="w-4 h-4 text-[#00F5D4]" />
            )}
          </button>

          {/* Mobile Frame Simulator Toggle (xl+) */}
          <button
            type="button"
            onClick={() => {
              playTone('tap');
              setIsMobileView(!isMobileView);
            }}
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-full bg-white/5 hover:bg-white/10 text-[#CBD5E1] hover:text-white border border-white/15 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title={isMobileView ? 'Masaüstü görünümüne geç' : 'Mobil oyun çerçevesinde test et'}
          >
            {isMobileView ? (
              <>
                <Monitor className="w-3.5 h-3.5 text-[#FFBE0B]" />
                <span>Geniş</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5 text-[#00F5D4]" />
                <span>Mobil</span>
              </>
            )}
          </button>

          {/* Info / Architecture Guide (sm+) */}
          <button
            type="button"
            onClick={() => {
              playTone('tap');
              onOpenGuide();
            }}
            className="hidden sm:flex w-8 h-8 rounded-full border border-[#FFBE0B]/35 bg-[#FFBE0B]/15 hover:bg-[#FFBE0B]/25 text-[#FFBE0B] items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Dilbaz Hakkında"
            aria-label="Dilbaz Hakkında"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Visible Notification Indicator Bell + Badge (Mobile & Desktop) */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                playTone('tap');
                setNotifPermission(getNotificationSupportState().permission);
                setMobileMenuOpen(false);
                setNotifOpen((prev) => !prev);
              }}
              className={`relative w-9 h-9 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
                totalNotificationCount > 0
                  ? 'border-[#FF006E]/60 bg-[#FF006E]/20 text-[#FFBE0B]'
                  : 'border-white/15 bg-white/5 hover:bg-[#3A86FF]/25 text-white'
              }`}
              title="Bildirimler"
              aria-label={`Bildirimler (${totalNotificationCount})`}
            >
              <Bell className={`w-4 h-4 ${totalNotificationCount > 0 ? 'animate-pulse' : ''}`} />
              {totalNotificationCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF006E] text-white text-[10px] font-bold leading-none flex items-center justify-center shadow-md border border-[#0d1629]">
                  {totalNotificationCount > 99 ? '99+' : totalNotificationCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="fixed sm:absolute right-2.5 sm:right-0 top-14 sm:top-12 w-[calc(100vw-20px)] sm:w-96 max-h-[72vh] overflow-y-auto rounded-2xl bg-[#0d1629]/98 border border-[#3A86FF]/45 shadow-2xl p-3.5 space-y-3 z-50 backdrop-blur-xl animate-screen-in">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2 text-xs font-display font-bold text-white">
                    <Bell className="w-4 h-4 text-[#FFBE0B]" />
                    <span>Bildirim Merkezi</span>
                    {totalNotificationCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-[#FF006E] text-white text-[10px]">
                        {totalNotificationCount}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifOpen(false)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                    aria-label="Bildirim panelini kapat"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
                  <div className="p-2.5 rounded-xl bg-[#FFBE0B]/15 border border-[#FFBE0B]/40 space-y-2 text-[11px]">
                    <div className="text-[#FDE68A] font-medium">
                      Uygulama ikonu sayısı ve sistem bildirim çubuğu göstergesi için bildirim izni verin.
                    </div>
                    <button
                      type="button"
                      onClick={handleEnableOsNotifications}
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#FFBE0B] to-[#FF5400] text-[#0d1629] font-bold text-xs cursor-pointer"
                    >
                      Telefon Bildirimlerini & İkon Sayacını Aç
                    </button>
                  </div>
                )}

                {notificationItems.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#94A3B8]">
                    Şu an okunmamış bildiriminiz yok.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {notificationItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-[#14213D]/90 border border-white/10 space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-[#FFBE0B] flex items-center gap-1.5">
                              {item.kind === 'invite' && <Swords className="w-3.5 h-3.5 text-[#00F5D4] shrink-0" />}
                              <span className="truncate">{item.title}</span>
                            </div>
                            <p className="text-[#CBD5E1] text-[11px] mt-0.5 leading-relaxed">
                              {item.body}
                            </p>
                          </div>
                          {item.onDismiss && (
                            <button
                              type="button"
                              onClick={() => {
                                playTone('tap');
                                item.onDismiss?.();
                              }}
                              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white shrink-0 cursor-pointer"
                              aria-label="Bildirimi kapat"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {item.onAction && item.actionLabel && (
                          <button
                            type="button"
                            onClick={() => {
                              playTone('tap');
                              setNotifOpen(false);
                              item.onAction?.();
                            }}
                            className="w-full min-h-[36px] px-3 py-1.5 rounded-xl btn-epic-turquoise text-[11px] font-bold cursor-pointer"
                          >
                            {item.actionLabel}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile / Tablet Hamburger Menu Toggle (< lg) */}
          <button
            type="button"
            onClick={() => {
              playTone('tap');
              setNotifOpen(false);
              setMobileMenuOpen((prev) => !prev);
            }}
            className="lg:hidden relative w-9 h-9 rounded-xl border border-white/15 bg-[#14213D]/90 hover:bg-white/10 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label={mobileMenuOpen ? 'Menüyü Kapat' : 'Menüyü Aç'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            {!mobileMenuOpen && totalBadgeCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#FF006E] text-white text-[9px] font-bold flex items-center justify-center">
                {totalBadgeCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Responsive Mobile & Tablet Dropdown Menu (< lg) — All Links Clearly Visible */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-white/10 bg-[#0d1629]/98 backdrop-blur-lg px-3 py-3 space-y-2.5 shadow-2xl animate-screen-in">
          {authUser && (
            <button
              type="button"
              onClick={() => {
                playTone('tap');
                setMobileMenuOpen(false);
                onOpenAuth();
              }}
              className="w-full p-2.5 rounded-2xl bg-[#14213D]/90 border border-[#00F5D4]/30 flex items-center justify-between gap-2 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <KilimAvatar avatar={userProfile?.avatar || 'elibelinde'} size={30} />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {resolvedDisplayName}
                  </div>
                  <div className="text-[10px] text-[#93C5FD] truncate">
                    {authUser.email || 'Kayıtlı Kullanıcı'}
                  </div>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 border ${
                  isAdmin
                    ? 'bg-[#FFBE0B]/20 text-[#FFBE0B] border-[#FFBE0B]/45'
                    : 'bg-[#3A86FF]/20 text-[#93C5FD] border-[#3A86FF]/35'
                }`}
              >
                {isAdmin ? 'Yönetici' : 'Üye'}
              </span>
            </button>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => handleSelectTab('room')}
              className={`min-h-[44px] flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'room'
                  ? 'bg-gradient-to-r from-[#3A86FF] to-[#2563EB] text-white shadow-md'
                  : 'bg-[#14213D]/70 text-[#CBD5E1] hover:text-white border border-white/10'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Yarışma Odaları</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab('solo')}
              className={`min-h-[44px] flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'solo'
                  ? 'bg-gradient-to-r from-[#FF006E] to-[#FF5400] text-white shadow-md'
                  : 'bg-[#14213D]/70 text-[#CBD5E1] hover:text-white border border-white/10'
              }`}
            >
              <Mic className="w-4 h-4 shrink-0" />
              <span>Bireysel Pratik</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab('library')}
              className={`min-h-[44px] flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'library'
                  ? 'bg-gradient-to-r from-[#06D6A0] to-[#00B4D8] text-[#0d1629] font-bold shadow-md'
                  : 'bg-[#14213D]/70 text-[#CBD5E1] hover:text-white border border-white/10'
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>Tekerleme Havuzu</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab('friends')}
              className={`min-h-[44px] flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'friends'
                  ? 'bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white font-bold shadow-md'
                  : 'bg-[#14213D]/70 text-[#CBD5E1] hover:text-white border border-white/10'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <UserPlus className="w-4 h-4 shrink-0" />
                <span>Arkadaşlar & Davetler</span>
              </span>
              {pendingFriendsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#FF006E] text-white text-[10px] font-bold">
                  {pendingFriendsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab('leaderboard')}
              className={`min-h-[44px] flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'leaderboard'
                  ? 'bg-gradient-to-r from-[#FFBE0B] to-[#F59E0B] text-[#0d1629] font-bold shadow-md'
                  : 'bg-[#14213D]/70 text-[#CBD5E1] hover:text-white border border-white/10'
              }`}
            >
              <Trophy className="w-4 h-4 shrink-0" />
              <span>Liderlik Panosu</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => handleSelectTab('admin')}
                className={`min-h-[44px] flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-gradient-to-r from-[#FFBE0B] to-[#FF5400] text-[#0d1629] shadow-md'
                    : 'bg-[#FFBE0B]/15 text-[#FFBE0B] border border-[#FFBE0B]/40'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Yönetim Paneli (Üyeler & Onaylar)</span>
                </span>
                {pendingAdminCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#FF006E] text-white text-[10px] font-bold">
                    {pendingAdminCount}
                  </span>
                )}
              </button>
            )}

            <div className="sm:col-span-2">
              <PWAInstallButton onInstalledOrClicked={() => setMobileMenuOpen(false)} />
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  playTone('tap');
                  setMobileMenuOpen(false);
                  onReplayIntro();
                }}
                className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-[#93C5FD] cursor-pointer"
              >
                <PlayCircle className="w-4 h-4 shrink-0" />
                <span>Tanıtım</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playTone('tap');
                  setMobileMenuOpen(false);
                  onOpenGuide();
                }}
                className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#FFBE0B]/15 hover:bg-[#FFBE0B]/25 border border-[#FFBE0B]/35 text-xs font-semibold text-[#FFBE0B] cursor-pointer"
              >
                <HelpCircle className="w-4 h-4 shrink-0" />
                <span>Hakkında</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
