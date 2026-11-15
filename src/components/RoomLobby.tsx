import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Room, Difficulty, PhonemeCategory, UserProfile, RoomInvite, RoomProgressionMode, RoomJoinMethod } from '../types/game';
import { MascotDialogue } from './DilbazMascot';
import { KILIM_MOTIFS, KilimAvatar, getKilimMotif } from './KilimAvatar';
import { AppTab } from './Navbar';
import { playTone } from '../utils/soundEffects';
import {
  InvitedRoomStatusInfo,
  formatInviteDateTime
} from '../firebase/friendsFirestore';
import { POINTS_PER_PLAYER_MULTIPLAYER_WIN } from '../firebase/authService';
import {
  Users,
  Copy,
  Check,
  Play,
  UserPlus,
  Settings2,
  Share2,
  Link as LinkIcon,
  Sparkles,
  Mic,
  BookOpen,
  Trophy,
  LogIn,
  Swords,
  Send,
  X,
  Clock,
  Crown,
  Zap,
  RotateCcw
} from 'lucide-react';

interface RoomLobbyProps {
  room: Room | null;
  currentUser: { id: string; name: string; avatar: string };
  initialCode?: string;
  error?: string | null;
  isLoading?: boolean;
  authUser?: User | null;
  userProfile?: UserProfile | null;
  friends?: { uid: string; name: string; avatar: string }[];
  incomingInvites?: RoomInvite[];
  sentInvites?: RoomInvite[];
  rejoinableRooms?: Room[];
  invitedRoomsInfo?: Record<string, InvitedRoomStatusInfo>;
  pendingFriendsCount?: number;
  onOpenAuth?: () => void;
  onNavigateTab?: (tab: AppTab) => void;
  onAcceptInvite?: (invite: RoomInvite) => void;
  onDismissInvite?: (invite: RoomInvite) => void;
  onInviteFriendToRoom?: (friendUid: string) => Promise<void>;
  onCreateRoom: (settings: {
    roundCount: number;
    difficulty: 'karisik' | Difficulty;
    category: PhonemeCategory;
    progressionMode: RoomProgressionMode;
    creatorName: string;
    creatorAvatar: string;
  }) => void;
  onJoinRoom: (code: string, playerName: string, avatar: string, method?: RoomJoinMethod) => void;
  onStartGame: () => void;
  onAddBotPlayer: () => void;
  onToggleReady: () => void;
  onLeaveRoom: () => void;
  onCloseRoom?: () => void;
}

const isMotifDefaultName = (val: string): boolean => {
  const trimmed = val.trim();
  if (!trimmed || trimmed === 'Öğrenci') return true;
  return KILIM_MOTIFS.some((m) => m.name === trimmed);
};

export const RoomLobby: React.FC<RoomLobbyProps> = ({
  room,
  currentUser,
  initialCode = '',
  error = null,
  isLoading = false,
  authUser = null,
  userProfile = null,
  friends = [],
  incomingInvites = [],
  sentInvites = [],
  rejoinableRooms = [],
  invitedRoomsInfo = {},
  pendingFriendsCount = 0,
  onOpenAuth,
  onNavigateTab,
  onAcceptInvite,
  onDismissInvite,
  onInviteFriendToRoom,
  onCreateRoom,
  onJoinRoom,
  onStartGame,
  onAddBotPlayer,
  onToggleReady,
  onLeaveRoom,
  onCloseRoom
}) => {
  const initialMotif =
    getKilimMotif(userProfile?.avatar || currentUser.avatar) || KILIM_MOTIFS[0];

  const [viewMode, setViewMode] = useState<'options' | 'create' | 'join' | 'active_rooms'>(
    initialCode ? 'join' : 'options'
  );
  const [joinCode, setJoinCode] = useState(initialCode);
  const [selectedAvatar, setSelectedAvatar] = useState(initialMotif.id);
  const [playerName, setPlayerName] = useState(() => {
    if (userProfile?.username) return userProfile.username;
    if (!currentUser.name || currentUser.name === 'Öğrenci') {
      return initialMotif.name;
    }
    return currentUser.name;
  });
  const [hasCustomName, setHasCustomName] = useState(
    () => Boolean(userProfile?.username) || !isMotifDefaultName(currentUser.name || '')
  );
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [activeRoomPinInput, setActiveRoomPinInput] = useState('');
  const [invitedFriendUids, setInvitedFriendUids] = useState<Record<string, boolean>>({});
  const [invitingFriendUid, setInvitingFriendUid] = useState<string | null>(null);

  useEffect(() => {
    if (initialCode) {
      setJoinCode(initialCode);
      setViewMode('join');
    }
  }, [initialCode]);

  useEffect(() => {
    if (userProfile) {
      setSelectedAvatar(getKilimMotif(userProfile.avatar)?.id || KILIM_MOTIFS[0].id);
      setPlayerName(userProfile.username);
      setHasCustomName(true);
    }
  }, [userProfile]);

  const [roundCount, setRoundCount] = useState(3);
  const [difficulty, setDifficulty] = useState<'karisik' | Difficulty>('karisik');
  const [category] = useState<PhonemeCategory>('tum');
  const [progressionMode, setProgressionMode] = useState<RoomProgressionMode>('host');

  const activeMotif = getKilimMotif(selectedAvatar) || KILIM_MOTIFS[0];

  const handleSelectMotif = (motifId: string) => {
    playTone('tap');
    const motif = getKilimMotif(motifId) || KILIM_MOTIFS[0];
    setSelectedAvatar(motif.id);
    if (!hasCustomName || isMotifDefaultName(playerName)) {
      setPlayerName(motif.name);
      setHasCustomName(false);
    }
  };

  const handlePlayerNameChange = (value: string) => {
    setPlayerName(value);
    if (!value.trim() || isMotifDefaultName(value)) {
      setHasCustomName(false);
    } else {
      setHasCustomName(true);
    }
  };

  const renderKilimSelector = (nameLabel: string, inputPlaceholder: string) => (
    <>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-[#CBD5E1]">
            Anadolu Kilim Motifi Avatarı Seçin
          </label>
          <span className="text-[11px] font-display font-bold text-[#FFBE0B]">
            {activeMotif.name}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {KILIM_MOTIFS.map((motif) => {
            const isSelected = selectedAvatar === motif.id;
            return (
              <button
                key={motif.id}
                type="button"
                onClick={() => handleSelectMotif(motif.id)}
                className={`p-2 rounded-2xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#3A86FF]/25 border-2 border-[#FFBE0B] scale-[1.03] shadow-lg shadow-[#FFBE0B]/20'
                    : 'bg-[#0d1629]/80 border border-white/10 hover:border-white/30'
                }`}
              >
                <KilimAvatar avatar={motif.id} size={38} />
                <span className="text-[10px] font-semibold text-[#F8FAFC] truncate w-full text-center">
                  {motif.name}
                </span>
              </button>
            );
          })}
        </div>

        <div className="p-3.5 rounded-2xl bg-[#0d1629]/85 border border-[#FFBE0B]/35 flex items-start gap-3">
          <KilimAvatar avatar={activeMotif.id} size={52} />
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-sm font-bold text-[#FFBE0B]">
                {activeMotif.name}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3A86FF]/20 text-[#93C5FD] border border-[#3A86FF]/35 font-semibold">
                {activeMotif.meaningTag}
              </span>
            </div>
            <p className="text-[11.5px] text-[#CBD5E1] leading-relaxed">
              {activeMotif.description}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-[#CBD5E1]">{nameLabel}</label>
          {hasCustomName && (
            <button
              type="button"
              onClick={() => {
                playTone('tap');
                setPlayerName(activeMotif.name);
                setHasCustomName(false);
              }}
              className="text-[11px] text-[#00F5D4] hover:underline cursor-pointer"
            >
              Desen adını kullan ({activeMotif.name})
            </button>
          )}
        </div>
        <input
          type="text"
          value={playerName}
          onChange={(e) => handlePlayerNameChange(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-[#0d1629]/85 border border-white/15 text-white text-sm focus:border-[#00F5D4] focus:outline-none"
          placeholder={inputPlaceholder}
        />
      </div>
    </>
  );

  const copyCode = () => {
    if (!room) return;
    playTone('tap');
    navigator.clipboard.writeText(room.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const isDevPreview =
    typeof window !== 'undefined' && window.location.hostname.startsWith('ais-dev-');

  const getActiveShareUrl = (roomCode: string) => {
    return `${window.location.origin}/?oda=${encodeURIComponent(roomCode)}`;
  };

  const copyShareLink = () => {
    if (!room) return;
    playTone('tap');
    const url = getActiveShareUrl(room.code);
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // NOT IN A ROOM YET (OPENING SCREEN)
  if (!room) {
    return (
      <div className="max-w-2xl mx-auto space-y-5 animate-screen-in">
        {/* Clean Brand Title */}
        <div className="text-center space-y-1.5 pt-1">
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-wider bg-gradient-to-br from-white via-[#FFBE0B] to-[#FF006E] bg-clip-text text-transparent drop-shadow-[0_4px_14px_rgba(255,0,110,0.3)]">
            DİLBAZ
          </h1>
          <p className="text-xs sm:text-sm text-[#93C5FD] font-medium max-w-md mx-auto">
            Telaffuz ve Diksiyon Oyunları
          </p>
        </div>

        {/* Incoming Friend Room Invites */}
        {viewMode === 'options' && incomingInvites.length > 0 && (
          <div className="p-4 rounded-[24px] bg-gradient-to-r from-[#FFBE0B]/20 via-[#FF006E]/15 to-[#3A86FF]/20 border-2 border-[#FFBE0B]/60 space-y-2.5 shadow-lg">
            <div className="text-xs font-display font-bold text-[#FFBE0B] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>Arkadaşından Canlı Oda Daveti Var!</span>
            </div>
            {incomingInvites.map((inv) => {
              const roomInfo = invitedRoomsInfo[inv.roomCode];
              const isClosed = Boolean(
                roomInfo && (!roomInfo.exists || roomInfo.status === 'closed')
              );
              const isGameOver = roomInfo?.status === 'game_over';
              const isUnavailable = isClosed || isGameOver;
              const dateTimeText = formatInviteDateTime(inv.updatedAt || inv.createdAt);

              return (
                <div
                  key={inv.id}
                  className="p-3 rounded-2xl bg-[#0d1629]/85 border border-white/10 flex flex-wrap items-center justify-between gap-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <KilimAvatar avatar={inv.senderAvatar} size={36} />
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-xs font-bold text-white truncate">
                        {inv.senderName} seni <span className="font-mono text-[#FFBE0B]">{inv.roomCode}</span> odasına davet etti
                      </div>
                      <div className="text-[11px] text-[#93C5FD] truncate">{inv.roomTitle}</div>
                      <div className="flex flex-wrap items-center gap-2">
                        {dateTimeText && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-[#CBD5E1]">
                            <Clock className="w-3 h-3 text-[#00F5D4]" />
                            <span>{dateTimeText}</span>
                          </span>
                        )}
                        {isClosed && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF006E]/20 text-rose-200 border border-[#FF006E]/45 font-bold">
                            Oda Kaldırıldı
                          </span>
                        )}
                        {isGameOver && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FFBE0B]/20 text-[#FDE68A] border border-[#FFBE0B]/45 font-bold">
                            Oyun Sona Erdi
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {!isUnavailable ? (
                      <button
                        type="button"
                        onClick={() => {
                          playTone('tap');
                          onAcceptInvite?.(inv);
                        }}
                        className="px-3.5 py-2 rounded-xl btn-epic-turquoise text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Swords className="w-3.5 h-3.5" />
                        <span>Hemen Katıl</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          playTone('tap');
                          onDismissInvite?.(inv);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-[#CBD5E1] cursor-pointer"
                      >
                        Bildirimi Kapat
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        playTone('tap');
                        onDismissInvite?.(inv);
                      }}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#CBD5E1] cursor-pointer"
                      title="Daveti Kapat"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Opening Hub Cards: Yarışma Odaları, Bireysel Pratik, Tekerleme Havuzu, Arkadaşlar, Liderlik Panosu */}
        {viewMode === 'options' && onNavigateTab && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-[#3A86FF]/28 to-[#14213D] border-2 border-[#3A86FF]/70 text-left shadow-lg">
              <Users className="w-5 h-5 text-[#00F5D4] mb-1.5" />
              <div className="font-display text-xs font-bold text-white">Yarışma Odaları</div>
              <div className="text-[10px] text-[#93C5FD] mt-0.5">
                1. lik: Kişi × {POINTS_PER_PLAYER_MULTIPLAYER_WIN}p
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                playTone('tap');
                onNavigateTab('solo');
              }}
              className="p-3 rounded-2xl bg-[#14213D]/85 hover:bg-[#FF006E]/20 border border-white/15 hover:border-[#FF006E]/55 text-left transition-all cursor-pointer group"
            >
              <Mic className="w-5 h-5 text-[#FF006E] mb-1.5 group-hover:scale-110 transition-transform" />
              <div className="font-display text-xs font-bold text-white">Bireysel Pratik</div>
              <div className="text-[10px] text-[#CBD5E1] mt-0.5">Serbest diksiyon çalış</div>
            </button>

            <button
              type="button"
              onClick={() => {
                playTone('tap');
                onNavigateTab('library');
              }}
              className="p-3 rounded-2xl bg-[#14213D]/85 hover:bg-[#06D6A0]/20 border border-white/15 hover:border-[#06D6A0]/55 text-left transition-all cursor-pointer group"
            >
              <BookOpen className="w-5 h-5 text-[#06D6A0] mb-1.5 group-hover:scale-110 transition-transform" />
              <div className="font-display text-xs font-bold text-white">Tekerleme Havuzu</div>
              <div className="text-[10px] text-[#CBD5E1] mt-0.5">
                {authUser ? 'Önerilerim (+100 puan)' : 'Üyelere özel alan'}
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                playTone('tap');
                onNavigateTab('friends');
              }}
              className="relative p-3 rounded-2xl bg-[#14213D]/85 hover:bg-[#8B5CF6]/20 border border-white/15 hover:border-[#EC4899]/55 text-left transition-all cursor-pointer group"
            >
              <UserPlus className="w-5 h-5 text-[#EC4899] mb-1.5 group-hover:scale-110 transition-transform" />
              <div className="font-display text-xs font-bold text-white flex items-center gap-1">
                <span>Arkadaşlar</span>
                {pendingFriendsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-[#FF006E] text-white text-[9px] font-bold">
                    {pendingFriendsCount}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-[#CBD5E1] mt-0.5">E-posta ekle & davet et</div>
            </button>

            <button
              type="button"
              onClick={() => {
                playTone('tap');
                onNavigateTab('leaderboard');
              }}
              className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-[#14213D]/85 hover:bg-[#FFBE0B]/20 border border-white/15 hover:border-[#FFBE0B]/55 text-left transition-all cursor-pointer group"
            >
              <Trophy className="w-5 h-5 text-[#FFBE0B] mb-1.5 group-hover:scale-110 transition-transform" />
              <div className="font-display text-xs font-bold text-white">Liderlik Panosu</div>
              <div className="text-[10px] text-[#CBD5E1] mt-0.5">İlk 10 sıralama</div>
            </button>
          </div>
        )}

        {/* Sign-In / Account Banner */}
        {viewMode === 'options' && onOpenAuth && (
          <div className="p-3.5 rounded-2xl bg-[#0d1629]/85 border border-white/12 flex flex-wrap items-center justify-between gap-3">
            {authUser && userProfile ? (
              <>
                <div className="flex items-center gap-2.5 min-w-0">
                  <KilimAvatar avatar={userProfile.avatar} size={36} />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      Hoş geldin, {userProfile.username}
                    </div>
                    <div className="text-[11px] text-[#93C5FD]">
                      Liderlik Puanı: <strong className="text-[#FFBE0B]">{userProfile.points}</strong> · Oda 1. liği: Oyuncu × {POINTS_PER_PLAYER_MULTIPLAYER_WIN}p
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playTone('tap');
                    onOpenAuth();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer"
                >
                  Profil & Şifre
                </button>
              </>
            ) : (
              <>
                <div className="text-xs text-[#CBD5E1] flex-1 min-w-[180px]">
                  <strong className="text-white">Kayıtsız da oda kurup yarışabilirsiniz</strong> (puanlar veritabanına kaydedilmez). Puan biriktirmek ve Telaffuz Ustaları Sıralamasına girmek için giriş yapın.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playTone('tap');
                    onOpenAuth();
                  }}
                  className="px-3.5 py-2 rounded-xl btn-epic-turquoise text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Giriş Yap / Kayıt Ol</span>
                </button>
              </>
            )}
          </div>
        )}

        {error && (
          <div className="p-3.5 bg-[#FF006E]/20 border border-[#FF006E]/55 rounded-2xl text-rose-200 text-xs text-center font-semibold">
            {error}
          </div>
        )}

        {/* Quick Rejoin Banner for Active Rooms (when user or host left mid-game) */}
        {viewMode === 'options' && rejoinableRooms.length > 0 && (
          <div className="p-4 rounded-[24px] bg-gradient-to-r from-[#06D6A0]/18 via-[#3A86FF]/20 to-[#FFBE0B]/15 border-2 border-[#00F5D4]/60 space-y-2.5 shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-display font-bold text-[#00F5D4] flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4" />
                <span>Devam Eden Aktif Odaların ({rejoinableRooms.length})</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  playTone('tap');
                  setViewMode('active_rooms');
                }}
                className="text-[11px] font-bold text-[#FFBE0B] hover:underline cursor-pointer"
              >
                Tümünü Gör &rarr;
              </button>
            </div>
            {rejoinableRooms.slice(0, 2).map((r) => {
              const isMyCreatedRoom = (r.originalHostId || r.hostId) === currentUser.id;
              const isParticipantRoom =
                !isMyCreatedRoom &&
                Array.isArray(r.participantIds) &&
                r.participantIds.includes(currentUser.id);
              const statusLabel =
                r.status === 'waiting'
                  ? 'Lobide Bekliyor'
                  : r.status === 'round_result'
                  ? `Tur ${r.currentRound}/${r.totalRounds} Sonuçları`
                  : `Tur ${r.currentRound}/${r.totalRounds} Devam Ediyor`;

              return (
                <div
                  key={r.code}
                  className="p-3 rounded-2xl bg-[#0d1629]/85 border border-white/12 flex flex-wrap items-center justify-between gap-2.5"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                      <span className="truncate">{r.title}</span>
                      <span className="font-mono text-[#FFBE0B]">{r.code}</span>
                      {isMyCreatedRoom ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FFBE0B]/20 text-[#FFBE0B] font-bold">
                          Kurucu
                        </span>
                      ) : isParticipantRoom ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#3A86FF]/20 text-[#93C5FD] font-bold">
                          Katılımcı
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#06D6A0]/20 text-[#06D6A0] font-bold">
                          Davet Edildin
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#93C5FD] flex flex-wrap items-center gap-2">
                      <span>{statusLabel}</span>
                      <span>·</span>
                      <span>{r.players.length} Oyuncu</span>
                      <span>·</span>
                      <span>
                        {r.settings?.progressionMode === 'auto' || r.hostLeftAutoMode
                          ? 'Otomatik İlerleme'
                          : 'Kurucu Yönetiminde'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => {
                      playTone('tap');
                      onJoinRoom(
                        r.code,
                        playerName.trim() || activeMotif.name,
                        selectedAvatar,
                        'active_list'
                      );
                    }}
                    className="px-4 py-2 rounded-xl btn-epic-turquoise text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{r.status === 'waiting' ? 'Odaya Katıl' : 'Oyuna Devam Et'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Room Options Card */}
        {viewMode === 'options' && (
          <section className="ebru-glass-card rounded-[26px] p-4 sm:p-5 space-y-3">
            <div className="space-y-3">
              <button
                onClick={() => {
                  playTone('tap');
                  setViewMode('create');
                }}
                className="w-full flex items-center gap-3.5 p-4 rounded-[20px] bg-gradient-to-r from-[#3A86FF]/22 to-[#FF006E]/15 border border-[#3A86FF]/55 hover:-translate-y-0.5 transition-all text-left shadow-lg shadow-[#3A86FF]/15 cursor-pointer group"
              >
                <div className="w-11 h-11 rounded-[14px] bg-gradient-to-br from-[#FFBE0B] to-[#FF006E] text-white flex items-center justify-center font-display font-bold text-xl shrink-0 shadow-md shadow-[#FF006E]/40 group-hover:scale-105 transition-transform">
                  👑
                </div>
                <div className="flex-1">
                  <div className="font-display text-base font-bold text-white">
                    Oda Kur (Öğretmen / Kurucu)
                  </div>
                  <div className="text-xs text-[#CBD5E1] mt-0.5">
                    PIN kodunu oluşturun, kurucu yönetiminde veya otomatik ilerleme ile yarışın.
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#06D6A0]/20 text-[#06D6A0] border border-[#06D6A0]/40 shrink-0">
                  KURUCU
                </span>
              </button>

              <button
                onClick={() => {
                  playTone('tap');
                  setViewMode('join');
                }}
                className="w-full flex items-center gap-3.5 p-4 rounded-[20px] bg-gradient-to-r from-[#00F5D4]/15 to-[#3A86FF]/20 border border-[#00F5D4]/45 hover:-translate-y-0.5 transition-all text-left shadow-lg shadow-[#00F5D4]/10 cursor-pointer group"
              >
                <div className="w-11 h-11 rounded-[14px] bg-gradient-to-br from-[#00F5D4] to-[#3A86FF] text-[#0d1629] flex items-center justify-center font-display font-bold text-xl shrink-0 shadow-md shadow-[#3A86FF]/40 group-hover:scale-105 transition-transform">
                  🚀
                </div>
                <div className="flex-1">
                  <div className="font-display text-base font-bold text-white">
                    Odaya Katıl (Öğrenci / Yarışmacı)
                  </div>
                  <div className="text-xs text-[#CBD5E1] mt-0.5">
                    PIN kodunu biliyorsan beklemedeki veya devam eden aktif odaya katıl.
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#3A86FF]/25 text-[#93C5FD] border border-[#3A86FF]/45 shrink-0">
                  KATIL
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playTone('tap');
                  setViewMode('active_rooms');
                }}
                className="w-full flex items-center gap-3.5 p-4 rounded-[20px] bg-gradient-to-r from-[#06D6A0]/15 to-[#FFBE0B]/15 border border-[#06D6A0]/45 hover:-translate-y-0.5 transition-all text-left shadow-lg shadow-[#06D6A0]/10 cursor-pointer group"
              >
                <div className="w-11 h-11 rounded-[14px] bg-gradient-to-br from-[#06D6A0] to-[#FFBE0B] text-[#0d1629] flex items-center justify-center font-display font-bold text-xl shrink-0 shadow-md shadow-[#06D6A0]/30 group-hover:scale-105 transition-transform">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="font-display text-base font-bold text-white">
                    Aktif Odalar (Oyuna Devam Et)
                  </div>
                  <div className="text-xs text-[#CBD5E1] mt-0.5">
                    Yalnızca kurduğun, davet edildiğin veya katıldığın aktif odalar listelenir; diğerleri için PIN gir.
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#FFBE0B]/20 text-[#FFBE0B] border border-[#FFBE0B]/45 shrink-0">
                  {rejoinableRooms.length > 0 ? `${rejoinableRooms.length} AKTİF` : 'LİSTE'}
                </span>
              </button>
            </div>

            <button
              onClick={() => {
                playTone('tap');
                setViewMode('create');
              }}
              className="w-full mt-2 py-4 px-5 rounded-[22px] btn-epic-pomegranate font-bold text-base tracking-wide flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>OYUNA BAŞLA · ODA KUR</span>
            </button>
          </section>
        )}

        {/* CREATE ROOM FORM */}
        {viewMode === 'create' && (
          <div className="p-6 ebru-glass-card rounded-[28px] space-y-5 animate-screen-in">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-lg font-bold text-white font-display flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-[#FFBE0B]" />
                <span>Yeni Yarışma Odası Ayarları</span>
              </h2>
              <button
                onClick={() => {
                  playTone('tap');
                  setViewMode('options');
                }}
                className="text-xs text-[#93C5FD] hover:text-white cursor-pointer"
              >
                Vazgeç
              </button>
            </div>

            {renderKilimSelector('Oda Kurucu Adınız (İsteğe Bağlı Değiştirin)', activeMotif.name)}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#CBD5E1]">Tur Sayısı</label>
              <div className="grid grid-cols-3 gap-2">
                {[3, 5, 7].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      playTone('tap');
                      setRoundCount(num);
                    }}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      roundCount === num
                        ? 'bg-gradient-to-r from-[#FFBE0B] to-[#FF5400] text-[#0d1629] shadow-md'
                        : 'bg-[#0d1629]/80 text-[#CBD5E1] border border-white/10 hover:text-white'
                    }`}
                  >
                    {num} Tur
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#CBD5E1]">Zorluk Seviyesi</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'karisik', label: 'Karışık' },
                  { id: 'kolay', label: 'Kolay' },
                  { id: 'orta', label: 'Orta' },
                  { id: 'zor', label: 'Zor' }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      playTone('tap');
                      setDifficulty(item.id as 'karisik' | Difficulty);
                    }}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all capitalize cursor-pointer ${
                      difficulty === item.id
                        ? 'bg-[#3A86FF] text-white shadow-md shadow-[#3A86FF]/30'
                        : 'bg-[#0d1629]/80 text-[#CBD5E1] border border-white/10 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#CBD5E1]">Oyun İlerleme Modu</label>
              <div className="grid sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    playTone('tap');
                    setProgressionMode('host');
                  }}
                  className={`p-3 rounded-2xl text-left border transition-all cursor-pointer ${
                    progressionMode === 'host'
                      ? 'bg-[#3A86FF]/25 border-2 border-[#FFBE0B] text-white shadow-md'
                      : 'bg-[#0d1629]/80 border-white/10 text-[#CBD5E1] hover:border-white/25'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-[#FFBE0B]" />
                    <span>Kurucu Yönetiminde</span>
                  </div>
                  <p className="text-[11px] text-[#94A3B8] mt-1 leading-snug">
                    Turları ve geçişleri oda kurucusu başlatır. Kurucu çıkarsa oyun otomatik devam eder.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playTone('tap');
                    setProgressionMode('auto');
                  }}
                  className={`p-3 rounded-2xl text-left border transition-all cursor-pointer ${
                    progressionMode === 'auto'
                      ? 'bg-[#06D6A0]/20 border-2 border-[#00F5D4] text-white shadow-md'
                      : 'bg-[#0d1629]/80 border-white/10 text-[#CBD5E1] hover:border-white/25'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-[#00F5D4]" />
                    <span>Otomatik İlerleme</span>
                  </div>
                  <p className="text-[11px] text-[#94A3B8] mt-1 leading-snug">
                    Oyuncular okumasını tamamladıkça turlar beklemeden otomatik olarak ilerler.
                  </p>
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                playTone('tap');
                onCreateRoom({
                  roundCount,
                  difficulty,
                  category,
                  progressionMode,
                  creatorName: playerName.trim() || activeMotif.name,
                  creatorAvatar: selectedAvatar
                });
              }}
              disabled={isLoading}
              className="w-full py-4 rounded-[20px] btn-epic-pomegranate font-bold text-sm tracking-wide cursor-pointer disabled:opacity-50"
            >
              {isLoading ? 'Oda Oluşturuluyor...' : 'ODAYI BAŞLAT VE CANLI PIN AL'}
            </button>
          </div>
        )}

        {/* ACTIVE ROOMS LIST (Strictly scoped to created, invited, or joined rooms + PIN entry) */}
        {viewMode === 'active_rooms' && (
          <div className="p-6 ebru-glass-card rounded-[28px] space-y-4 animate-screen-in">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-lg font-bold text-white font-display flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-[#00F5D4]" />
                <span>Aktif Odalarım ({rejoinableRooms.length})</span>
              </h2>
              <button
                type="button"
                onClick={() => {
                  playTone('tap');
                  setViewMode('options');
                }}
                className="text-xs text-[#93C5FD] hover:text-white cursor-pointer"
              >
                Geri Dön
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-[#3A86FF]/12 border border-[#3A86FF]/35 text-[11.5px] text-[#CBD5E1] leading-relaxed">
              Güvenlik ve gizlilik için yalnızca <strong className="text-white">kurduğun</strong>, <strong className="text-white">davet edildiğin</strong> veya <strong className="text-white">daha önce katıldığın</strong> aktif odalar görünür. Başka bir aktif odaya sonradan katılmak için oda PIN kodunu girin.
            </div>

            {rejoinableRooms.length === 0 ? (
              <div className="p-5 rounded-2xl bg-[#0d1629]/75 border border-white/10 text-center space-y-3">
                <p className="text-xs text-[#CBD5E1]">
                  Şu an kurduğun, davet edildiğin veya devam ettiğin aktif bir oda bulunmuyor.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      playTone('tap');
                      setViewMode('create');
                    }}
                    className="px-4 py-2 rounded-xl btn-epic-pomegranate text-xs font-bold cursor-pointer"
                  >
                    Yeni Oda Kur
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {rejoinableRooms.map((r) => {
                  const isOriginalCreator = (r.originalHostId || r.hostId) === currentUser.id;
                  const isParticipantRoom =
                    !isOriginalCreator &&
                    Array.isArray(r.participantIds) &&
                    r.participantIds.includes(currentUser.id);
                  const statusLabel =
                    r.status === 'waiting'
                      ? 'Lobide Bekliyor'
                      : r.status === 'round_result'
                      ? `Tur ${r.currentRound}/${r.totalRounds} Sonuçları`
                      : `Tur ${r.currentRound}/${r.totalRounds} Devam Ediyor`;

                  return (
                    <div
                      key={r.code}
                      className="p-4 rounded-2xl bg-[#0d1629]/85 border border-[#00F5D4]/30 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-white truncate">{r.title}</span>
                          <span className="text-xs font-mono font-bold text-[#FFBE0B] px-2 py-0.5 rounded bg-[#FFBE0B]/15">
                            {r.code}
                          </span>
                          {isOriginalCreator ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FFBE0B]/20 text-[#FFBE0B] border border-[#FFBE0B]/40 font-bold">
                              Oda Kurucususun
                            </span>
                          ) : isParticipantRoom ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3A86FF]/20 text-[#93C5FD] border border-[#3A86FF]/40 font-bold">
                              Katılımcı
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#06D6A0]/20 text-[#06D6A0] border border-[#06D6A0]/40 font-bold">
                              Davet Edildin
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#93C5FD] flex flex-wrap items-center gap-2">
                          <span className="text-[#06D6A0] font-semibold">{statusLabel}</span>
                          <span>·</span>
                          <span>{r.players.length} Aktif Oyuncu</span>
                          <span>·</span>
                          <span>
                            {r.settings?.progressionMode === 'auto' || r.hostLeftAutoMode
                              ? 'Otomatik İlerleme'
                              : 'Kurucu Yönetiminde'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => {
                          playTone('tap');
                          onJoinRoom(
                            r.code,
                            playerName.trim() || activeMotif.name,
                            selectedAvatar,
                            'active_list'
                          );
                        }}
                        className="px-4 py-2.5 rounded-xl btn-epic-turquoise text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{r.status === 'waiting' ? 'Odaya Katıl' : 'Oyuna Devam Et'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Direct PIN entry inside Aktif Odalar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!activeRoomPinInput.trim() || isLoading) return;
                playTone('tap');
                onJoinRoom(
                  activeRoomPinInput.trim(),
                  playerName.trim() || activeMotif.name,
                  selectedAvatar,
                  'pin'
                );
              }}
              className="pt-3 border-t border-white/10 space-y-2.5"
            >
              <label className="text-xs font-bold text-[#FFBE0B] block">
                PIN Kodu ile Başka Bir Aktif Odaya Gir
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={activeRoomPinInput}
                  onChange={(e) => setActiveRoomPinInput(e.target.value.toUpperCase())}
                  placeholder="Oda PIN Kodu (Örn: DLBZ-4821)"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#0d1629]/90 border border-[#3A86FF]/40 text-[#FFBE0B] font-mono font-bold text-sm uppercase tracking-widest focus:border-[#00F5D4] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isLoading || !activeRoomPinInput.trim()}
                  className="px-5 py-2.5 rounded-xl btn-epic-turquoise text-xs font-bold cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {isLoading ? 'Bağlanılıyor...' : 'PIN ile Gir'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* JOIN ROOM FORM */}
        {viewMode === 'join' && (
          <div className="p-6 ebru-glass-card rounded-[28px] space-y-5 animate-screen-in">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-lg font-bold text-white font-display flex items-center gap-2">
                <Users className="w-5 h-5 text-[#00F5D4]" />
                <span>Mevcut Bir Odaya Katıl</span>
              </h2>
              <button
                onClick={() => {
                  playTone('tap');
                  setViewMode('options');
                }}
                className="text-xs text-[#93C5FD] hover:text-white cursor-pointer"
              >
                Vazgeç
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#CBD5E1]">Oda PIN Kodu</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Örn: DLBZ-4821"
                className="w-full px-4 py-3 rounded-xl bg-[#0d1629]/90 border border-[#3A86FF]/40 text-[#FFBE0B] text-center font-mono font-bold text-xl uppercase tracking-widest focus:border-[#00F5D4] focus:outline-none"
              />
            </div>

            {renderKilimSelector('Kullanıcı Adınız (İsterseniz Değiştirebilirsiniz)', activeMotif.name)}

            <button
              onClick={() => {
                if (!joinCode.trim()) return;
                playTone('tap');
                onJoinRoom(
                  joinCode.trim(),
                  playerName.trim() || activeMotif.name,
                  selectedAvatar,
                  'pin'
                );
              }}
              disabled={isLoading || !joinCode.trim()}
              className="w-full py-4 rounded-[20px] btn-epic-turquoise font-bold text-sm tracking-wide cursor-pointer disabled:opacity-50"
            >
              {isLoading ? 'Lobiye Bağlanılıyor...' : 'ODAYA GİRİŞ YAP'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ALREADY IN ROOM LOBBY
  const isHost = room.players.find((p) => p.id === currentUser.id)?.isHost ?? false;
  const myPlayer = room.players.find((p) => p.id === currentUser.id);

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-screen-in">
      {error && (
        <div className="p-3.5 bg-[#FF006E]/20 border border-[#FF006E]/55 rounded-2xl text-rose-200 text-xs font-semibold text-center shadow-lg">
          {error}
        </div>
      )}

      <MascotDialogue
        mood="happy"
        message={
          isHost
            ? `Oda kodu ${room.code} hazır! Öğrencilerin bağlandıkça aşağıda görünecek, herkes hazır olunca yarışmayı başlat!`
            : `Harika! ${room.hostName} kurucusunun yarışmayı başlatmasını bekliyoruz. Hazır butonuna basmayı unutma!`
        }
      />

      {/* Room Header Card */}
      <div className="p-5 sm:p-6 ebru-glass-card rounded-[28px] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="text-xs text-[#93C5FD] flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#06D6A0] animate-ping" />
              <span>
                Oda Kurucu: <strong className="text-white">{room.hostName}</strong>
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white font-display">
              {room.title}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-[#0d1629]/90 px-4 py-2 rounded-2xl border border-[#FFBE0B]/35">
              <div>
                <div className="text-[10px] uppercase font-mono tracking-wider text-[#93C5FD]">
                  ODA KODU
                </div>
                <div className="text-lg font-mono font-bold text-[#FFBE0B] tracking-wider">
                  {room.code}
                </div>
              </div>
              <button
                onClick={copyCode}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors ml-1 cursor-pointer"
                title="Kodu Kopyala"
              >
                {copiedCode ? <Check className="w-4 h-4 text-[#06D6A0]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <button
              onClick={copyShareLink}
              className="flex items-center gap-1.5 px-3.5 py-3 rounded-2xl bg-[#3A86FF]/20 hover:bg-[#3A86FF]/35 text-[#00F5D4] border border-[#3A86FF]/45 text-xs font-bold transition-colors cursor-pointer"
              title="Öğrencilere göndermek için direkt bağlantıyı kopyala"
            >
              {copiedLink ? <Check className="w-4 h-4 text-[#06D6A0]" /> : <Share2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{copiedLink ? 'Kopyalandı!' : 'Linki Kopyala'}</span>
            </button>
          </div>
        </div>

        {/* Share URL Box */}
        <div className="p-3.5 bg-[#0d1629]/80 rounded-2xl border border-[#3A86FF]/30 text-xs space-y-2.5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-[#00F5D4] flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 shrink-0" />
                <span>Odaya Direkt Katılım Bağlantısı</span>
              </div>
              <div className="font-mono text-[#CBD5E1] text-[11px] break-all select-all">
                {getActiveShareUrl(room.code)}
              </div>
            </div>
            <button
              onClick={copyShareLink}
              className="px-3.5 py-1.5 rounded-xl bg-[#3A86FF]/25 hover:bg-[#3A86FF]/40 text-white border border-[#3A86FF]/45 text-xs font-bold cursor-pointer shrink-0 transition-colors"
            >
              {copiedLink ? 'Kopyalandı ✓' : 'Linki Kopyala'}
            </button>
          </div>
          {isDevPreview && (
            <div className="p-2.5 rounded-xl bg-[#FFBE0B]/10 border border-[#FFBE0B]/30 text-[11px] text-[#FDE68A] leading-relaxed">
              <strong>Not:</strong> Şu an geliştirme önizlemesindesiniz (<code>ais-dev-...</code>). Öğrencilerin Google girişi olmadan katılabilmesi için AI Studio sağ üstteki <strong>Share / Publish (Paylaş)</strong> butonundan uygulamayı yayınlayın.
            </div>
          )}
        </div>

        {/* Room Settings */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-3 py-1 rounded-full bg-white/5 border border-white/12 text-[#CBD5E1]">
            ✦ Toplam: <strong className="text-white">{room.totalRounds} Tur</strong>
          </span>
          <span className="px-3 py-1 rounded-full bg-white/5 border border-white/12 text-[#CBD5E1] capitalize">
            🎯 Zorluk: <strong className="text-white">{room.settings.difficulty}</strong>
          </span>
          <span className="px-3 py-1 rounded-full bg-white/5 border border-white/12 text-[#CBD5E1]">
            ⏱️ Süre: <strong className="text-white">{room.settings.timeLimitSeconds} sn</strong>
          </span>
          <span className="px-3 py-1 rounded-full bg-[#3A86FF]/15 border border-[#3A86FF]/35 text-[#93C5FD] font-semibold">
            {room.settings?.progressionMode === 'auto'
              ? '⚡ Otomatik İlerleme'
              : '👑 Kurucu Yönetiminde'}
          </span>
          <span className="px-3 py-1 rounded-full bg-[#FFBE0B]/15 border border-[#FFBE0B]/35 text-[#FFBE0B] flex items-center gap-1.5 font-semibold">
            <Sparkles className="w-3 h-3" />{' '}
            {room.players.length >= 2
              ? `1. Lik Ödülü: +${room.players.length * POINTS_PER_PLAYER_MULTIPLAYER_WIN} Puan (${room.players.length} Oyuncu × ${POINTS_PER_PLAYER_MULTIPLAYER_WIN})`
              : `1. Lik Ödülü: Oyuncu Sayısı × ${POINTS_PER_PLAYER_MULTIPLAYER_WIN} Puan`}
          </span>
        </div>
      </div>

      {/* Players List */}
      <div className="p-5 sm:p-6 ebru-glass-card rounded-[28px] space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-white font-display flex items-center gap-2">
              <Users className="w-5 h-5 text-[#FFBE0B]" />
              <span>Lobideki Katılımcılar ({room.players.length})</span>
            </h2>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              Oda kodunu ({room.code}) paylaştığınız öğrenciler bağlandıkça burada görünür.
            </p>
          </div>

          <button
            onClick={() => {
              playTone('tap');
              onAddBotPlayer();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/15 text-[#CBD5E1] hover:text-white border border-white/15 transition-colors cursor-pointer shrink-0"
            title="Yalnızsanız test amacıyla simüle bir bot ekleyebilirsiniz"
          >
            <UserPlus className="w-3.5 h-3.5 text-[#00F5D4]" />
            <span className="text-[11px]">+ Test Botu</span>
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {room.players.map((p) => {
            const isMe = p.id === currentUser.id;
            const isBot = p.id.startsWith('bot-');
            const motif = getKilimMotif(p.avatar);

            return (
              <div
                key={p.id}
                className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                  isMe
                    ? 'bg-gradient-to-r from-[#3A86FF]/20 to-[#FF006E]/15 border-[#FFBE0B]/50 shadow-md'
                    : isBot
                    ? 'bg-white/5 border-white/10 opacity-80'
                    : 'bg-white/5 border-white/15'
                }`}
              >
                <div className="flex items-center gap-3">
                  <KilimAvatar avatar={p.avatar} size={42} />
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-1.5">
                      <span>{p.name}</span>
                      {isMe && <span className="text-[10px] font-mono text-[#FFBE0B]">(Sen)</span>}
                      {p.isHost && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FFBE0B]/20 text-[#FFBE0B] font-semibold">
                          Kurucu
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#94A3B8]">
                      {motif ? `${motif.name} Motifi` : isBot ? 'Simüle Katılımcı' : 'Canlı Bağlı Cihaz'}
                    </div>
                  </div>
                </div>

                <div>
                  {p.isReady ? (
                    <span className="text-xs font-semibold text-[#06D6A0] flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Hazır
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-[#FFBE0B]/80">Bekliyor</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invite Friends Directly to This Room */}
      {authUser && onInviteFriendToRoom && (
        <div className="p-5 sm:p-6 ebru-glass-card rounded-[28px] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-white font-display flex items-center gap-2">
                <Send className="w-4 h-4 text-[#00F5D4]" />
                <span>Arkadaşlarını Odaya Davet Et</span>
              </h2>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                Davet gönderdiğinde arkadaşının telefonuna bildirim gider.
              </p>
            </div>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => {
                  playTone('tap');
                  onNavigateTab('friends');
                }}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] font-semibold text-[#93C5FD] cursor-pointer"
              >
                + Arkadaş Ekle
              </button>
            )}
          </div>

          {friends.length === 0 ? (
            <div className="p-3.5 rounded-2xl bg-[#0d1629]/70 border border-white/10 text-xs text-[#94A3B8] flex flex-wrap items-center justify-between gap-2">
              <span>Henüz kayıtlı arkadaşın yok. E-posta adresiyle ekleyebilirsin.</span>
              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => {
                    playTone('tap');
                    onNavigateTab('friends');
                  }}
                  className="px-3 py-1.5 rounded-xl btn-epic-turquoise text-[11px] font-bold cursor-pointer"
                >
                  Arkadaşlar Sekmesine Git
                </button>
              )}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2.5">
              {friends.map((f) => {
                const alreadyInRoom = room.players.some((p) => p.id === f.uid);
                const sentInvite = sentInvites.find(
                  (inv) => inv.roomCode === room.code && inv.recipientUid === f.uid
                );
                const wasDeclined = sentInvite?.status === 'dismissed';
                const isPending = sentInvite?.status === 'pending' || Boolean(invitedFriendUids[f.uid]);
                const isSending = invitingFriendUid === f.uid;
                return (
                  <div
                    key={f.uid}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-2.5 ${
                      wasDeclined
                        ? 'bg-[#FF006E]/10 border-[#FF006E]/40'
                        : 'bg-[#0d1629]/85 border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <KilimAvatar avatar={f.avatar} size={34} />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{f.name}</div>
                        {!alreadyInRoom && wasDeclined && (
                          <div className="text-[10px] text-rose-300 font-semibold">
                            Daveti kabul etmedi
                          </div>
                        )}
                        {!alreadyInRoom && !wasDeclined && isPending && (
                          <div className="text-[10px] text-[#06D6A0] font-semibold">
                            Davet gönderildi · Yanıt bekleniyor
                          </div>
                        )}
                      </div>
                    </div>
                    {alreadyInRoom ? (
                      <span className="text-[11px] font-bold text-[#06D6A0] shrink-0">
                        Odada ✓
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={isSending}
                        onClick={async () => {
                          playTone('tap');
                          setInvitingFriendUid(f.uid);
                          try {
                            await onInviteFriendToRoom(f.uid);
                            setInvitedFriendUids((prev) => ({ ...prev, [f.uid]: true }));
                            playTone('notification');
                          } finally {
                            setInvitingFriendUid(null);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold shrink-0 cursor-pointer transition-all disabled:opacity-50 ${
                          wasDeclined
                            ? 'bg-gradient-to-r from-[#FF006E] to-[#FFBE0B] text-white'
                            : isPending
                            ? 'bg-[#06D6A0]/20 hover:bg-[#06D6A0]/30 text-[#06D6A0] border border-[#06D6A0]/40'
                            : 'bg-gradient-to-r from-[#3A86FF] to-[#FF006E] text-white'
                        }`}
                      >
                        {isSending
                          ? 'Gönderiliyor...'
                          : wasDeclined || isPending
                          ? 'Tekrar Davet Et'
                          : 'Davet Et'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Control Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={() => {
            playTone('tap');
            if (isHost && onCloseRoom) {
              onCloseRoom();
            } else {
              onLeaveRoom();
            }
          }}
          className="w-full sm:w-1/3 py-3.5 rounded-2xl bg-white/10 text-[#CBD5E1] hover:text-white hover:bg-white/15 border border-white/15 text-xs font-bold transition-colors cursor-pointer"
        >
          {isHost && onCloseRoom ? 'Odayı Kapat' : 'Odadan Ayrıl'}
        </button>

        {!isHost && (
          <button
            onClick={() => {
              playTone('tap');
              onToggleReady();
            }}
            className={`w-full sm:w-2/3 py-3.5 rounded-2xl font-bold text-sm transition-all cursor-pointer ${
              myPlayer?.isReady
                ? 'bg-white/10 text-[#FFBE0B] border border-[#FFBE0B]/45'
                : 'btn-epic-turquoise'
            }`}
          >
            {myPlayer?.isReady ? 'Hazır Durumunu Kaldır' : 'HAZIRIM! (YARIŞMAYA KATIL)'}
          </button>
        )}

        {isHost && (
          <button
            onClick={async () => {
              playTone('tap');
              setIsStarting(true);
              try {
                await onStartGame();
              } finally {
                setIsStarting(false);
              }
            }}
            disabled={room.players.length === 0 || isStarting}
            className="w-full sm:w-2/3 py-4 rounded-[20px] btn-epic-pomegranate font-bold text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>
              {isStarting ? 'Yarışma Başlatılıyor...' : `YARIŞMAYI BAŞLAT (${room.players.length} Katılımcı)`}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
