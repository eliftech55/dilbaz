import React, { useEffect, useState } from 'react';
import { UserProfile } from '../types/game';
import {
  subscribeToGlobalLeaderboard,
  subscribeToAllMembers,
  setMemberRoleAsAdmin,
  deleteMemberAsAdmin,
  POINTS_FOR_APPROVED_TEKERLEME,
  POINTS_PER_PLAYER_MULTIPLAYER_WIN
} from '../firebase/authService';
import { KilimAvatar } from './KilimAvatar';
import { DilbazMascot } from './DilbazMascot';
import { resolveVisualsFromPublicProfile } from './PhoenixEquippedVisuals';
import { PHOENIX_STAGES, getFeatherPalette } from '../utils/phoenixProgression';
import { RumiCorners } from './EbruBackground';
import { playTone } from '../utils/soundEffects';
import {
  Trophy,
  Award,
  BookPlus,
  Crown,
  UserCheck,
  ShieldCheck,
  Trash2,
  Users,
  Search
} from 'lucide-react';

interface GlobalLeaderboardProps {
  currentUid?: string | null;
  currentUserProfile?: UserProfile | null;
  isAdmin?: boolean;
  onOpenAuth: () => void;
  onOpenAdminPanel?: () => void;
}

export const GlobalLeaderboard: React.FC<GlobalLeaderboardProps> = ({
  currentUid,
  currentUserProfile = null,
  isAdmin = false,
  onOpenAuth,
  onOpenAdminPanel
}) => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [allMembers, setAllMembers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [memberSearch, setMemberSearch] = useState('');
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [adminActionMsg, setAdminActionMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToGlobalLeaderboard(
      (list) => {
        setProfiles(list.slice(0, 10));
        setIsLoading(false);
      },
      () => {
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setAllMembers([]);
      return;
    }
    const unsub = subscribeToAllMembers(setAllMembers);
    return () => unsub();
  }, [isAdmin]);

  const topTen = profiles.slice(0, 10);
  const topThree = topTen.slice(0, 3);
  const myIndex = currentUid ? topTen.findIndex((p) => p.uid === currentUid) : -1;
  const myProfile = myIndex >= 0 ? topTen[myIndex] : currentUserProfile;

  const filteredMembers = allMembers.filter((m) =>
    m.username.toLocaleLowerCase('tr-TR').includes(memberSearch.toLocaleLowerCase('tr-TR'))
  );

  const handleToggleRole = async (member: UserProfile) => {
    if (!currentUid || member.uid === currentUid) return;
    const targetRole = member.role === 'yonetici' ? 'uye' : 'yonetici';
    playTone('tap');
    setBusyUid(member.uid);
    setAdminActionMsg(null);
    try {
      await setMemberRoleAsAdmin(member.uid, targetRole, currentUid);
      playTone('correct');
      setAdminActionMsg(
        `${member.username} kullanıcısının rolü "${
          targetRole === 'yonetici' ? 'Yönetici' : 'Üye'
        }" olarak güncellendi.`
      );
    } finally {
      setBusyUid(null);
    }
  };

  const handleDeleteMember = async (member: UserProfile) => {
    if (!currentUid || member.uid === currentUid) return;
    playTone('wrong');
    setBusyUid(member.uid);
    setAdminActionMsg(null);
    try {
      await deleteMemberAsAdmin(member);
      setConfirmDeleteUid(null);
      setAdminActionMsg(`${member.username} üye tablosundan silindi.`);
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-screen-in">
      {/* Header Hero */}
      <div className="relative ebru-glass-card border-[1.5px] border-[#FFBE0B]/40 rounded-[28px] p-5 sm:p-6 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-display font-bold uppercase tracking-wider text-[#FFBE0B] px-3 py-1 rounded-full bg-[#FFBE0B]/15 border border-[#FFBE0B]/40">
              <Trophy className="w-3.5 h-3.5" />
              <span>Dilbaz Liderlik Panosu</span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-white font-display pt-1">
              Telaffuz Ustaları Sıralaması
            </h1>
            <p className="text-xs text-[#CBD5E1]">
              Onaylanan tekerleme katkıları ve oda birincilikleriyle kazanılan resmi Dilbaz puanları.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isAdmin && onOpenAdminPanel && (
              <button
                type="button"
                onClick={() => {
                  playTone('tap');
                  onOpenAdminPanel();
                }}
                className="px-4 py-2.5 rounded-2xl bg-[#FFBE0B]/20 hover:bg-[#FFBE0B]/30 border border-[#FFBE0B]/50 text-[#FFBE0B] font-bold text-xs flex items-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Yönetim Panelini Aç (Üyeler)</span>
              </button>
            )}

            {!currentUid && (
              <button
                onClick={() => {
                  playTone('tap');
                  onOpenAuth();
                }}
                className="px-4 py-3 rounded-2xl btn-epic-pomegranate font-bold text-xs flex items-center gap-2 shrink-0 cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>Giriş Yap & Puan Topla</span>
              </button>
            )}
          </div>
        </div>

        {/* Point Rules Strip */}
        <div className="grid sm:grid-cols-2 gap-2.5 mt-5 pt-4 border-t border-white/10 text-xs">
          <div className="p-3 rounded-2xl bg-[#06D6A0]/12 border border-[#06D6A0]/35 flex items-center gap-2.5">
            <BookPlus className="w-5 h-5 text-[#06D6A0] shrink-0" />
            <div>
              <div className="font-bold text-white">+{POINTS_FOR_APPROVED_TEKERLEME} Puan</div>
              <div className="text-[11px] text-[#CBD5E1]">Yönetici onaylı tekerleme katkısı</div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-[#FFBE0B]/15 border border-[#FFBE0B]/40 flex items-center gap-2.5">
            <Crown className="w-5 h-5 text-[#FFBE0B] shrink-0" />
            <div>
              <div className="font-bold text-white">
                +Oyuncu Sayısı × {POINTS_PER_PLAYER_MULTIPLAYER_WIN} Puan
              </div>
              <div className="text-[11px] text-[#CBD5E1]">
                Oda birinciliği ödülü (kalabalık odalarda daha fazla puan)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Current User Highlight Banner */}
      {myProfile && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#3A86FF]/20 to-[#FF006E]/15 border border-[#FFBE0B]/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="px-2.5 py-1 rounded-xl bg-[#FFBE0B] text-[#14213D] font-display font-bold text-xs shrink-0">
              {myIndex >= 0 ? `#${myIndex + 1}` : 'İlk 10 Dışı'}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <KilimAvatar avatar={myProfile.avatar} size={36} />
              <DilbazMascot
                size={40}
                showWings={false}
                level={myProfile.phoenixLevel || 1}
                visualsOverride={resolveVisualsFromPublicProfile(myProfile)}
                title={`${myProfile.username} Zümrüdüankası`}
              />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                <span className="truncate">{myProfile.username} (Sen)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#93C5FD] font-semibold">
                  {myProfile.role === 'yonetici' || isAdmin ? 'Yönetici' : 'Üye'}
                </span>
              </div>
              <div className="text-[11px] text-[#CBD5E1]">
                Sv.{myProfile.phoenixLevel || 1} · {myProfile.approvedTekerlemeCount} tekerleme · {myProfile.multiplayerWins} 1.lik
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xl font-bold font-display text-[#FFBE0B] tabular-nums">
              {myProfile.points}
            </div>
            <div className="text-[10px] text-[#93C5FD] uppercase">Dilbaz Puanı</div>
          </div>
        </div>
      )}

      {/* Top 3 Spotlight Cards */}
      {topThree.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-3">
          {topThree.map((user, idx) => {
            const medalColors = [
              'border-[#FFBE0B]/60 bg-gradient-to-b from-[#FFBE0B]/20 to-[#14213D]/90',
              'border-slate-300/45 bg-gradient-to-b from-slate-300/15 to-[#14213D]/90',
              'border-amber-600/45 bg-gradient-to-b from-amber-600/15 to-[#14213D]/90'
            ];
            const badges = [
              '👑 1. Telaffuz Ustası',
              '🥈 2. Telaffuz Ustası',
              '🥉 3. Telaffuz Ustası'
            ];
            const phoenixLevel = user.phoenixLevel || 1;
            const stageName =
              PHOENIX_STAGES.find((s) => s.id === user.phoenixStageId)?.name ||
              PHOENIX_STAGES[0].name;
            const paletteName = getFeatherPalette(user.phoenixPaletteId).name;

            return (
              <div
                key={user.uid}
                className={`relative rounded-[24px] p-4 border text-center space-y-2 overflow-hidden ${medalColors[idx]}`}
              >
                <RumiCorners />
                <div className="relative z-10 flex flex-col items-center space-y-1.5">
                  <span className="text-[11px] font-bold text-[#FFBE0B] font-display">{badges[idx]}</span>
                  <div className="flex items-center justify-center gap-2 py-1">
                    <DilbazMascot
                      size={54}
                      showWings
                      level={phoenixLevel}
                      visualsOverride={resolveVisualsFromPublicProfile(user)}
                      title={`${user.username} · Sv.${phoenixLevel} ${stageName}`}
                    />
                    <KilimAvatar avatar={user.avatar} size={34} />
                  </div>
                  <div className="text-sm font-bold text-white truncate max-w-full px-2">
                    {user.username}
                  </div>
                  <div className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/10 border border-white/12 text-[#00F5D4] font-semibold">
                    Sv.{phoenixLevel} {stageName} · {paletteName}
                  </div>
                  <div className="text-2xl font-bold font-display text-[#FFBE0B] tabular-nums">
                    {user.points} <span className="text-xs font-normal text-[#CBD5E1]">puan</span>
                  </div>
                  <div className="text-[11px] text-[#CBD5E1]">
                    {user.approvedTekerlemeCount} tekerleme · {user.multiplayerWins} galibiyet
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Top 10 Leaderboard Table */}
      <div className="ebru-glass-card rounded-[26px] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white font-display flex items-center gap-2">
            <Award className="w-4 h-4 text-[#00F5D4]" />
            <span>İlk 10 Telaffuz Ustası ({topTen.length})</span>
          </h2>
          <span className="text-[11px] text-[#94A3B8]">Sadece ilk 10 gösterilir · Anlık</span>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-xs text-[#93C5FD]">
            Liderlik panosu yükleniyor...
          </div>
        ) : topTen.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <p className="text-xs text-[#CBD5E1]">
              Henüz liderlik panosunda kayıtlı üye yok. İlk üye olup puan toplamaya başlayın!
            </p>
            {!currentUid && (
              <button
                onClick={onOpenAuth}
                className="px-4 py-2 rounded-xl btn-epic-turquoise text-xs font-bold cursor-pointer"
              >
                Kayıt Ol / Giriş Yap
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {topTen.map((profile, idx) => {
              const isMe = currentUid === profile.uid;
              return (
                <div
                  key={profile.uid}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                    isMe
                      ? 'bg-gradient-to-r from-[#3A86FF]/22 to-[#FF006E]/15 border-[#FFBE0B]/55 text-white'
                      : 'bg-white/5 border-white/10 text-[#CBD5E1]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-display font-bold text-xs shrink-0 ${
                        idx === 0
                          ? 'bg-[#FFBE0B] text-[#14213D]'
                          : idx === 1
                          ? 'bg-slate-200 text-[#14213D]'
                          : idx === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-white/10 text-[#93C5FD]'
                      }`}
                    >
                      #{idx + 1}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <DilbazMascot
                        size={36}
                        showWings={false}
                        level={profile.phoenixLevel || 1}
                        visualsOverride={resolveVisualsFromPublicProfile(profile)}
                        title={`${profile.username} Zümrüdüankası`}
                      />
                      <KilimAvatar avatar={profile.avatar} size={30} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                        <span className="truncate">{profile.username}</span>
                        {isMe && <span className="text-[10px] font-mono text-[#FFBE0B]">(Sen)</span>}
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#00F5D4]/15 text-[#00F5D4] font-bold shrink-0">
                          Sv.{profile.phoenixLevel || 1}
                        </span>
                        {profile.role === 'yonetici' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#FFBE0B]/20 text-[#FFBE0B] border border-[#FFBE0B]/40 font-bold">
                            Yönetici
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#94A3B8]">
                        {profile.approvedTekerlemeCount} onaylı tekerleme · {profile.multiplayerWins} 1. lik
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-base font-bold font-display text-[#FFBE0B] tabular-nums">
                      {profile.points} p
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ADMIN ONLY: MEMBER MANAGEMENT TABLE */}
      {isAdmin && (
        <div className="ebru-glass-card border-[1.5px] border-[#FFBE0B]/45 rounded-[26px] p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#FFBE0B] font-display flex items-center gap-2">
                <Users className="w-5 h-5" />
                <span>Yönetici Üye Tablosu ({allMembers.length} Üye)</span>
              </h2>
              <p className="text-[11px] text-[#CBD5E1] mt-0.5">
                Üyelere Yönetici yetkisi verebilir, yetkiyi geri alabilir veya üyeleri tablodan silebilirsiniz.
              </p>
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-[#93C5FD] absolute left-3 top-2.5" />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Üye ara..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#0d1629]/85 border border-white/15 text-xs text-white focus:border-[#FFBE0B] focus:outline-none"
              />
            </div>
          </div>

          {adminActionMsg && (
            <div className="p-3 rounded-xl bg-[#06D6A0]/18 border border-[#06D6A0]/45 text-emerald-100 text-xs font-semibold">
              {adminActionMsg}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/12 text-[#93C5FD] uppercase font-mono text-[10px]">
                  <th className="py-2.5 px-2">Üye</th>
                  <th className="py-2.5 px-2">Rol</th>
                  <th className="py-2.5 px-2">Puan</th>
                  <th className="py-2.5 px-2 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {filteredMembers.map((member) => {
                  const isSelf = member.uid === currentUid;
                  const isMgr = member.role === 'yonetici';
                  const isBusy = busyUid === member.uid;
                  const isConfirmingDel = confirmDeleteUid === member.uid;

                  return (
                    <tr key={member.uid} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2.5">
                          <DilbazMascot
                            size={30}
                            showWings={false}
                            level={member.phoenixLevel || 1}
                            visualsOverride={resolveVisualsFromPublicProfile(member)}
                          />
                          <KilimAvatar avatar={member.avatar} size={26} />
                          <div>
                            <div className="font-bold text-white flex items-center gap-1">
                              <span>{member.username}</span>
                              {isSelf && <span className="text-[10px] text-[#FFBE0B]">(Sen)</span>}
                            </div>
                            <div className="text-[10px] text-[#94A3B8]">
                              Sv.{member.phoenixLevel || 1} · {member.approvedTekerlemeCount} tekerleme · {member.multiplayerWins} galibiyet
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isMgr
                              ? 'bg-[#FFBE0B]/20 text-[#FFBE0B] border-[#FFBE0B]/45'
                              : 'bg-[#3A86FF]/15 text-[#93C5FD] border-[#3A86FF]/35'
                          }`}
                        >
                          {isMgr ? (
                            <>
                              <ShieldCheck className="w-3 h-3" /> Yönetici
                            </>
                          ) : (
                            'Üye'
                          )}
                        </span>
                      </td>

                      <td className="py-3 px-2 font-mono font-bold text-[#FFBE0B]">
                        {member.points} p
                      </td>

                      <td className="py-3 px-2 text-right">
                        {isSelf ? (
                          <span className="text-[10px] text-[#94A3B8] italic">Mevcut Yönetici</span>
                        ) : isConfirmingDel ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDeleteMember(member)}
                              className="px-2.5 py-1 rounded-lg bg-[#FF006E] text-white font-bold text-[11px] cursor-pointer"
                            >
                              Evet, Sil
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteUid(null)}
                              className="px-2.5 py-1 rounded-lg bg-white/10 text-white font-semibold text-[11px] cursor-pointer"
                            >
                              Vazgeç
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleToggleRole(member)}
                              className={`px-2.5 py-1.5 rounded-xl font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-50 ${
                                isMgr
                                  ? 'bg-white/10 hover:bg-white/15 text-[#CBD5E1] border border-white/15'
                                  : 'bg-[#3A86FF]/25 hover:bg-[#3A86FF]/40 text-white border border-[#3A86FF]/45'
                              }`}
                            >
                              {isMgr ? 'Üye Yap' : 'Yönetici Yap'}
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => {
                                playTone('tap');
                                setConfirmDeleteUid(member.uid);
                              }}
                              className="p-1.5 rounded-xl bg-[#FF006E]/20 hover:bg-[#FF006E]/35 text-rose-200 border border-[#FF006E]/40 cursor-pointer disabled:opacity-50"
                              title="Üyeyi Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
