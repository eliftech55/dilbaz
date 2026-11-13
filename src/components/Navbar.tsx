import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { UserProfile } from '../types/game';
import { KilimAvatar } from './KilimAvatar';
import { playTone } from '../utils/soundEffects';
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
  X
} from 'lucide-react';

export type AppTab = 'room' | 'solo' | 'library' | 'friends' | 'leaderboard';

interface NavbarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  isMobileView: boolean;
  setIsMobileView: (val: boolean) => void;
  onOpenGuide: () => void;
  pointsCount: number;
  pendingFriendsCount?: number;
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
  isMuted,
  onToggleMute,
  onReplayIntro,
  authUser,
  userProfile,
  isAdmin,
  onOpenAuth
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSelectTab = (tab: AppTab) => {
    playTone('tap');
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#0d1629]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-5 h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* Zone 1: Brand Logo & Title */}
        <button
          type="button"
          onClick={() => handleSelectTab('room')}
          className="flex items-center gap-2 shrink-0 text-left cursor-pointer"
        >
          <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full p-[2px] bg-gradient-to-tr from-[#3A86FF] via-[#FF006E] to-[#FFBE0B] shadow-lg shadow-[#FF006E]/25 shrink-0">
            <img
              src="/assets/aistudio/logo_785c16ab.png"
              alt="Dilbaz Logo"
              className="w-full h-full rounded-full object-cover bg-[#14213D]"
            />
          </div>
          <div className="leading-tight">
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
              className="flex items-center gap-1.5 pl-1 pr-2 sm:pl-1.5 sm:pr-2.5 py-1 rounded-full bg-[#14213D]/95 border border-[#00F5D4]/45 hover:border-[#FFBE0B] text-white text-xs font-semibold transition-all cursor-pointer max-w-[96px] sm:max-w-[155px] shrink-0"
              title="Hesabım & Kullanıcı Adı"
            >
              <KilimAvatar avatar={userProfile?.avatar || 'elibelinde'} size={22} />
              <span className="truncate max-w-[52px] sm:max-w-[85px]">
                {userProfile?.username || authUser.email?.split('@')[0] || 'Üye'}
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

          {/* Mobile / Tablet Hamburger Menu Toggle (< lg) */}
          <button
            type="button"
            onClick={() => {
              playTone('tap');
              setMobileMenuOpen((prev) => !prev);
            }}
            className="lg:hidden relative w-9 h-9 rounded-xl border border-white/15 bg-[#14213D]/90 hover:bg-white/10 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label={mobileMenuOpen ? 'Menüyü Kapat' : 'Menüyü Aç'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            {!mobileMenuOpen && pendingFriendsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF006E] text-white text-[9px] font-bold flex items-center justify-center">
                {pendingFriendsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Responsive Mobile & Tablet Dropdown Menu (< lg) — All Links Clearly Visible */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-white/10 bg-[#0d1629]/98 backdrop-blur-lg px-3 py-3 space-y-2 shadow-2xl animate-screen-in">
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
