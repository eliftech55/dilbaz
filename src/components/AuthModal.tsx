import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { UserProfile } from '../types/game';
import {
  signInWithGoogle,
  registerWithEmailAndPassword,
  loginWithEmailAndPassword,
  attachPasswordToCurrentGoogleUser,
  isUsernameAvailable,
  saveUserProfile,
  logoutUser
} from '../firebase/authService';
import { getFriendlyAuthError } from '../firebase/errorHandler';
import { KILIM_MOTIFS, KilimAvatar, getKilimMotif } from './KilimAvatar';
import { DilbazMascot } from './DilbazMascot';
import { PhoenixComputedState, getPhoenixState } from '../utils/phoenixProgression';
import { playTone } from '../utils/soundEffects';
import {
  X,
  Mail,
  Lock,
  UserCheck,
  Sparkles,
  LogOut,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  Palette
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  authUser: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  phoenixState?: PhoenixComputedState;
  onOpenSanctuary?: () => void;
  onClose: () => void;
  onOpenAdminPanel?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  authUser,
  userProfile,
  isAdmin,
  phoenixState,
  onOpenSanctuary,
  onClose,
  onOpenAdminPanel
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [needsConsoleSetup, setNeedsConsoleSetup] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  // Profile Setup / Edit state
  const [useEmailAsUsername, setUseEmailAsUsername] = useState<boolean>(true);
  const [customUsername, setCustomUsername] = useState<string>('');
  const [selectedAvatar, setSelectedAvatar] = useState<string>(KILIM_MOTIFS[0].id);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  // Password link state (for users who registered via Google and want email+password login too)
  const [newPassword, setNewPassword] = useState('');
  const [isLinkingPassword, setIsLinkingPassword] = useState(false);
  const wasSignedOutRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      wasSignedOutRef.current = false;
      return;
    }
    if (!authUser) {
      wasSignedOutRef.current = true;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setNeedsConsoleSetup(false);

    if (authUser) {
      const currentAvatar =
        userProfile?.avatar && getKilimMotif(userProfile.avatar)
          ? userProfile.avatar
          : KILIM_MOTIFS[0].id;
      setSelectedAvatar(currentAvatar);

      if (userProfile) {
        const isEmail = Boolean(authUser.email && userProfile.username === authUser.email);
        setUseEmailAsUsername(isEmail);
        setCustomUsername(isEmail ? '' : userProfile.username);

        if (wasSignedOutRef.current) {
          wasSignedOutRef.current = false;
          setSuccessMsg(`Giriş başarılı! Hoş geldiniz, ${userProfile.username}.`);
          const timer = setTimeout(() => {
            onClose();
          }, 700);
          return () => clearTimeout(timer);
        }
      } else {
        const suggested = authUser.displayName?.trim() || '';
        setUseEmailAsUsername(!suggested && Boolean(authUser.email));
        setCustomUsername(suggested);
      }
    }
  }, [isOpen, authUser, userProfile, onClose]);

  useEffect(() => {
    if (!isOpen || !authUser || useEmailAsUsername) {
      setUsernameStatus('idle');
      return;
    }
    const trimmed = customUsername.trim();
    if (trimmed.length < 3) {
      setUsernameStatus('idle');
      return;
    }
    if (userProfile && userProfile.username === trimmed) {
      setUsernameStatus('available');
      return;
    }

    setUsernameStatus('checking');
    const timer = setTimeout(async () => {
      const ok = await isUsernameAvailable(trimmed, authUser.uid);
      setUsernameStatus(ok ? 'available' : 'taken');
    }, 350);

    return () => clearTimeout(timer);
  }, [customUsername, useEmailAsUsername, authUser, userProfile, isOpen]);

  if (!isOpen) return null;

  const hasPasswordProvider = Boolean(
    authUser?.providerData?.some((p) => p.providerId === 'password')
  );

  const handleGoogleAuth = async () => {
    setIsBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setNeedsConsoleSetup(false);
    try {
      const signedInUser = await signInWithGoogle();
      if (signedInUser) {
        playTone('correct');
      }
    } catch (err) {
      const parsed = getFriendlyAuthError(err);
      setErrorMsg(parsed.message);
      setNeedsConsoleSetup(Boolean(parsed.needsEmailProviderSetup));
    } finally {
      setIsBusy(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    playTone('tap');
    setIsBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setNeedsConsoleSetup(false);
    try {
      if (authMode === 'register') {
        await registerWithEmailAndPassword(email, password);
        playTone('correct');
      } else {
        await loginWithEmailAndPassword(email, password);
        playTone('correct');
      }
    } catch (err) {
      const parsed = getFriendlyAuthError(err);
      setErrorMsg(parsed.message);
      setNeedsConsoleSetup(Boolean(parsed.needsEmailProviderSetup));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) return;
    if (!useEmailAsUsername && usernameStatus === 'taken') {
      setErrorMsg('Bu kullanıcı adı zaten alınmış. Lütfen farklı bir kullanıcı adı deneyin.');
      return;
    }
    playTone('tap');
    setIsBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await saveUserProfile({
        user: authUser,
        useEmailAsUsername,
        customUsername,
        avatar: selectedAvatar
      });
      playTone('correct');
      setSuccessMsg('Dilbaz profiliniz ve kullanıcı adınız kaydedildi!');
      setTimeout(() => {
        onClose();
      }, 650);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Profil kaydedilemedi.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleLinkPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('Şifre en az 6 karakter olmalıdır.');
      return;
    }
    playTone('tap');
    setIsLinkingPassword(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setNeedsConsoleSetup(false);
    try {
      await attachPasswordToCurrentGoogleUser(newPassword);
      playTone('correct');
      setNewPassword('');
      setSuccessMsg(
        `Şifreniz ${authUser?.email} adresine bağlandı! Artık hem Google ile hem de e-posta + şifre ile giriş yapabilirsiniz.`
      );
    } catch (err) {
      const parsed = getFriendlyAuthError(err);
      setErrorMsg(parsed.message);
      setNeedsConsoleSetup(Boolean(parsed.needsEmailProviderSetup));
    } finally {
      setIsLinkingPassword(false);
    }
  };

  const handleLogout = async () => {
    playTone('tap');
    await logoutUser();
    onClose();
  };

  const activeMotif = getKilimMotif(selectedAvatar) || KILIM_MOTIFS[0];
  const resolvedPhoenix = phoenixState || getPhoenixState(userProfile);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#090e1a]/85 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-lg my-auto bg-[#14213D] border-[1.5px] border-[#3A86FF]/45 rounded-[28px] shadow-2xl overflow-hidden animate-screen-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#0d1629]/75">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FFBE0B] to-[#FF006E] flex items-center justify-center text-white shadow">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                {authUser
                  ? userProfile
                    ? 'Dilbaz Hesabım & Profilim'
                    : 'Kullanıcı Adı & Kilim Avatarını Seç'
                  : 'Dilbaz Hesabına Giriş / Kayıt'}
              </h2>
              <p className="text-[11px] text-[#93C5FD]">
                {authUser
                  ? authUser.email || 'Kayıtlı Kullanıcı'
                  : 'Tekerleme katkısı ve liderlik puanı için hesabınızı bağlayın'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              playTone('tap');
              onClose();
            }}
            className="p-1.5 rounded-xl text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-[#FF006E]/18 border border-[#FF006E]/50 text-rose-100 text-xs space-y-1.5">
              <div className="flex items-start gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 text-[#FF006E] shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
              {needsConsoleSetup && (
                <p className="text-[11px] text-rose-200/90 pl-6">
                  Yönetici notu: Firebase Console &rarr; Authentication &rarr; Sign-in method bölümünden <strong>Email/Password</strong> sağlayıcısını etkinleştirin.
                </p>
              )}
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-[#06D6A0]/18 border border-[#06D6A0]/50 text-emerald-100 text-xs flex items-start gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-[#06D6A0] shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* VIEW 1: NOT SIGNED IN */}
          {!authUser && (
            <div className="space-y-5">
              {/* Google Sign-In / Sign-Up Button */}
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={isBusy}
                className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-100 text-[#14213D] font-bold text-sm flex items-center justify-center gap-3 shadow-lg transition-all cursor-pointer disabled:opacity-60"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Google Hesabı ile Kayıt Ol / Giriş Yap</span>
              </button>
              <p className="text-[11px] text-[#94A3B8] text-center -mt-3">
                Tarayıcı açılır pencereyi (popup) engellerse adres çubuğundan izin verin veya aşağıdan e-posta ve şifre ile giriş yapın.
              </p>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[11px] uppercase tracking-wider text-[#94A3B8] font-semibold">
                  veya Google Mail & Şifre ile
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              {/* Email / Password Tabs */}
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[#0d1629]/90 border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    playTone('tap');
                    setAuthMode('login');
                    setErrorMsg(null);
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    authMode === 'login'
                      ? 'bg-[#3A86FF] text-white shadow'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  E-posta ile Giriş Yap
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playTone('tap');
                    setAuthMode('register');
                    setErrorMsg(null);
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    authMode === 'register'
                      ? 'bg-gradient-to-r from-[#FF006E] to-[#FF5400] text-white shadow'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  E-posta ile Kayıt Ol
                </button>
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-3.5 text-xs">
                <div className="space-y-1.5">
                  <label className="font-semibold text-[#CBD5E1] flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#00F5D4]" />
                    <span>Google Mail (E-posta) Adresiniz</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@gmail.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0d1629]/90 border border-white/15 text-white text-sm focus:border-[#00F5D4] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-[#CBD5E1] flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#FFBE0B]" />
                    <span>Şifre (En az 6 karakter)</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0d1629]/90 border border-white/15 text-white text-sm focus:border-[#FFBE0B] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isBusy}
                  className="w-full py-3.5 rounded-2xl btn-epic-pomegranate font-bold text-sm cursor-pointer disabled:opacity-60"
                >
                  {isBusy
                    ? 'İşlem Yapılıyor...'
                    : authMode === 'register'
                    ? 'HESABI OLUŞTUR VE DEVAM ET'
                    : 'E-POSTA VE ŞİFRE İLE GİRİŞ YAP'}
                </button>
              </form>

              <p className="text-[11px] text-[#94A3B8] text-center leading-relaxed">
                İpucu: Google ile kayıt olduktan sonra hesap ayarlarından bir şifre tanımlayıp sonraki girişlerinizde e-posta ve şifrenizle de giriş yapabilirsiniz.
              </p>
            </div>
          )}

          {/* VIEW 2: SIGNED IN -> PROFILE, USERNAME & PASSWORD LINK */}
          {authUser && (
            <div className="space-y-5">
              {/* Account Summary Strip */}
              <div className="p-3.5 rounded-2xl bg-[#0d1629]/85 border border-white/12 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <KilimAvatar avatar={selectedAvatar} size={44} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white truncate">
                        {userProfile?.username ||
                          authUser.displayName ||
                          authUser.email?.split('@')[0] ||
                          'Yeni Üye'}
                      </span>
                      {isAdmin && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFBE0B]/20 border border-[#FFBE0B]/50 text-[#FFBE0B] text-[10px] font-bold">
                          <ShieldCheck className="w-3 h-3" /> Yönetici
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#94A3B8] truncate">{authUser.email}</div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[10px] text-[#93C5FD] uppercase font-mono">Liderlik Puanı</div>
                  <div className="text-lg font-bold font-display text-[#FFBE0B] tabular-nums">
                    {userProfile?.points ?? 0} p
                  </div>
                </div>
              </div>

              {/* Zümrüdüanka Character Profile Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#3A86FF]/16 via-[#0d1629]/95 to-[#FF006E]/14 border border-[#00F5D4]/35 flex items-center justify-between gap-3.5">
                <div className="flex items-center gap-3.5 min-w-0">
                  <DilbazMascot
                    size={62}
                    level={resolvedPhoenix.level}
                    onClick={onOpenSanctuary}
                    title="Zümrüdüanka Yuvasını Aç"
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="text-[10px] uppercase tracking-wider font-mono text-[#00F5D4]">
                      Zümrüdüanka Karakterim
                    </div>
                    <div className="text-sm font-display font-bold text-white truncate">
                      Sv.{resolvedPhoenix.level} · {resolvedPhoenix.stage.name}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-[#FFBE0B] font-semibold">
                        {resolvedPhoenix.activeFeatherPalette.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-[#93C5FD] font-semibold">
                        {resolvedPhoenix.activeWingPattern.name}
                      </span>
                    </div>
                  </div>
                </div>

                {onOpenSanctuary && (
                  <button
                    type="button"
                    onClick={() => {
                      playTone('tap');
                      onOpenSanctuary();
                    }}
                    className="px-3 py-2 rounded-xl bg-[#FFBE0B]/20 hover:bg-[#FFBE0B]/30 border border-[#FFBE0B]/45 text-[#FFBE0B] text-[11px] font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Özelleştir</span>
                  </button>
                )}
              </div>

              {isAdmin && onOpenAdminPanel && (
                <button
                  type="button"
                  onClick={() => {
                    playTone('tap');
                    onOpenAdminPanel();
                    onClose();
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-[#FFBE0B] to-[#F59E0B] text-[#0d1629] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Yönetici Panelini Aç (Üyeler & Onaylar)</span>
                </button>
              )}

              {!userProfile && (
                <div className="p-3 rounded-2xl bg-[#00F5D4]/12 border border-[#00F5D4]/40 text-[11px] text-[#CFFAFE] leading-relaxed">
                  <strong>Son adım:</strong> Kullanıcı adınızın üst menüde, liderlik panosunda ve yönetici üye listesinde görünmesi için aşağıdan seçiminizi yapıp <strong>PROFİLİ KAYDET</strong> butonuna basın.
                </div>
              )}

              {/* Username Selection Form */}
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#CBD5E1] block">
                    Liderlik Panosu Kullanıcı Adı Tercihi
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        playTone('tap');
                        setUseEmailAsUsername(true);
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        useEmailAsUsername
                          ? 'bg-[#3A86FF]/20 border-[#00F5D4] text-white shadow'
                          : 'bg-[#0d1629]/70 border-white/10 text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-bold">E-postamı Kullan</div>
                      <div className="text-[10px] text-[#93C5FD] truncate mt-0.5">
                        {authUser.email || 'E-posta adresi'}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playTone('tap');
                        setUseEmailAsUsername(false);
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        !useEmailAsUsername
                          ? 'bg-[#FF006E]/18 border-[#FFBE0B] text-white shadow'
                          : 'bg-[#0d1629]/70 border-white/10 text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-bold">Benzersiz Kullanıcı Adı</div>
                      <div className="text-[10px] text-[#FDE68A] mt-0.5">
                        Size özel takma ad oluşturun
                      </div>
                    </button>
                  </div>

                  {!useEmailAsUsername && (
                    <div className="space-y-1.5 pt-1">
                      <input
                        type="text"
                        required
                        minLength={3}
                        maxLength={40}
                        value={customUsername}
                        onChange={(e) => setCustomUsername(e.target.value)}
                        placeholder="Örn: Soz_Sultani_42"
                        className="w-full px-4 py-2.5 rounded-xl bg-[#0d1629]/90 border border-white/15 text-white text-sm focus:border-[#FFBE0B] focus:outline-none"
                      />
                      <div className="text-[11px] flex items-center justify-between px-1">
                        <span className="text-[#94A3B8]">En az 3 karakter · Benzersiz olmalıdır</span>
                        {usernameStatus === 'checking' && (
                          <span className="text-[#93C5FD]">Kontrol ediliyor...</span>
                        )}
                        {usernameStatus === 'available' && (
                          <span className="text-[#06D6A0] font-semibold">✓ Kullanılabilir</span>
                        )}
                        {usernameStatus === 'taken' && (
                          <span className="text-[#FF006E] font-semibold">✕ Bu ad alınmış</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Kilim Avatar Picker */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#CBD5E1]">
                      Anadolu Kilim Motifi Avatarı
                    </label>
                    <span className="text-[11px] font-bold text-[#FFBE0B]">{activeMotif.name}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {KILIM_MOTIFS.map((motif) => {
                      const active = selectedAvatar === motif.id;
                      return (
                        <button
                          key={motif.id}
                          type="button"
                          onClick={() => {
                            playTone('tap');
                            setSelectedAvatar(motif.id);
                          }}
                          className={`p-2 rounded-2xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
                            active
                              ? 'bg-[#3A86FF]/25 border-2 border-[#FFBE0B]'
                              : 'bg-[#0d1629]/75 border border-white/10 hover:border-white/30'
                          }`}
                        >
                          <KilimAvatar avatar={motif.id} size={34} />
                          <span className="text-[10px] font-semibold text-white truncate w-full text-center">
                            {motif.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isBusy || (!useEmailAsUsername && usernameStatus === 'taken')}
                  className="w-full py-3.5 rounded-2xl btn-epic-turquoise font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isBusy ? 'Kaydediliyor...' : 'PROFİLİ KAYDET'}</span>
                </button>
              </form>

              {/* Set Password for Google Users */}
              {!hasPasswordProvider && authUser.email && (
                <form
                  onSubmit={handleLinkPassword}
                  className="p-4 rounded-2xl bg-[#0d1629]/85 border border-[#3A86FF]/35 space-y-2.5"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-[#93C5FD]">
                    <KeyRound className="w-4 h-4 text-[#FFBE0B]" />
                    <span>Google Mail Adresinize Şifre Tanımlayın</span>
                  </div>
                  <p className="text-[11px] text-[#CBD5E1] leading-relaxed">
                    Google hesabınızla kayıt oldunuz. Dilerseniz <strong>{authUser.email}</strong> için bir şifre belirleyerek sonraki girişlerinizde e-posta ve şifre ile de giriş yapabilirsiniz.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Yeni şifre (en az 6 karakter)"
                      className="flex-1 px-3 py-2 rounded-xl bg-[#14213D] border border-white/15 text-white text-xs focus:border-[#FFBE0B] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isLinkingPassword || newPassword.length < 6}
                      className="px-4 py-2 rounded-xl bg-[#3A86FF] hover:bg-[#2563EB] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      {isLinkingPassword ? 'Bağlanıyor...' : 'Şifre Belirle'}
                    </button>
                  </div>
                </form>
              )}

              {/* Sign Out */}
              <div className="pt-2 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-[#FF006E]/20 border border-white/10 hover:border-[#FF006E]/40 text-xs font-semibold text-rose-200 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Çıkış Yap</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-white/10 bg-[#0d1629]/70 flex items-center justify-center gap-3 text-[11px]">
          <a
            href={`${import.meta.env.BASE_URL}privacy.html`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#93C5FD] hover:text-[#00F5D4] underline transition-colors"
          >
            Gizlilik Politikası
          </a>
          <span className="text-white/30">·</span>
          <a
            href={`${import.meta.env.BASE_URL}terms.html`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#93C5FD] hover:text-[#00F5D4] underline transition-colors"
          >
            Kullanım Koşulları (Terms of Service)
          </a>
        </div>
      </div>
    </div>
  );
};
