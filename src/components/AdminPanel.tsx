import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Tekerleme, UserProfile } from '../types/game';
import {
  ADMIN_EMAIL,
  subscribeToAllMembers,
  setMemberRoleAsAdmin,
  deleteMemberAsAdmin,
  POINTS_FOR_APPROVED_TEKERLEME
} from '../firebase/authService';
import { KilimAvatar } from './KilimAvatar';
import { playTone } from '../utils/soundEffects';
import {
  ShieldCheck,
  Users,
  Search,
  Trash2,
  BookOpen,
  Check,
  Lock,
  LogIn,
  AlertTriangle
} from 'lucide-react';

interface AdminPanelProps {
  authUser: User | null;
  currentUid: string | null;
  isAdmin: boolean;
  adminContributions: Tekerleme[];
  onOpenAuth: () => void;
  onOpenLibrary: () => void;
  onApproveContribution: (tekerleme: Tekerleme) => Promise<void> | void;
  onDeleteTekerleme: (tekerleme: Tekerleme) => Promise<void> | void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  authUser,
  currentUid,
  isAdmin,
  adminContributions,
  onOpenAuth,
  onOpenLibrary,
  onApproveContribution,
  onDeleteTekerleme
}) => {
  const [allMembers, setAllMembers] = useState<UserProfile[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'yonetici' | 'uye'>('all');
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [memberEmails, setMemberEmails] = useState<Record<string, string>>({});
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (!isAdmin) {
      setAllMembers([]);
      setMembersLoaded(false);
      setMemberEmails({});
      return;
    }
    setMembersError(null);
    const unsub = subscribeToAllMembers(
      (list) => {
        setAllMembers(list);
        setMembersLoaded(true);
      },
      (err) => {
        setMembersLoaded(true);
        setMembersError(
          err instanceof Error ? err.message : 'Üye listesi yüklenirken bir hata oluştu.'
        );
      }
    );
    return () => unsub();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || allMembers.length === 0) return;
    let active = true;
    async function loadEmails() {
      const map: Record<string, string> = {};
      await Promise.all(
        allMembers.map(async (m) => {
          try {
            const snap = await getDoc(doc(db, 'usersPrivate', m.uid));
            if (snap.exists() && snap.data()?.email) {
              map[m.uid] = snap.data().email;
            }
          } catch {
            // ignore
          }
        })
      );
      if (active) {
        setMemberEmails(map);
      }
    }
    loadEmails();
    return () => {
      active = false;
    };
  }, [isAdmin, allMembers]);

  const pendingContributions = useMemo(
    () => adminContributions.filter((t) => t.status === 'pending'),
    [adminContributions]
  );

  const approvedContributions = useMemo(
    () => adminContributions.filter((t) => t.status === 'approved'),
    [adminContributions]
  );

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLocaleLowerCase('tr-TR');
    return allMembers.filter((m) => {
      const matchesRole =
        roleFilter === 'all' ||
        (roleFilter === 'yonetici' ? m.role === 'yonetici' : m.role !== 'yonetici');
      const matchesQuery =
        !q ||
        m.username.toLocaleLowerCase('tr-TR').includes(q) ||
        m.uid.toLowerCase().includes(q);
      return matchesRole && matchesQuery;
    });
  }, [allMembers, memberSearch, roleFilter]);

  const adminCount = useMemo(
    () => allMembers.filter((m) => m.role === 'yonetici').length,
    [allMembers]
  );

  const handleToggleRole = async (member: UserProfile) => {
    if (!currentUid || member.uid === currentUid) return;
    const targetRole = member.role === 'yonetici' ? 'uye' : 'yonetici';
    playTone('tap');
    setBusyUid(member.uid);
    setActionMsg(null);
    try {
      await setMemberRoleAsAdmin(member.uid, targetRole, currentUid);
      playTone('correct');
      setActionMsg({
        type: 'success',
        text: `${member.username} kullanıcısının rolü "${
          targetRole === 'yonetici' ? 'Yönetici' : 'Üye'
        }" olarak güncellendi.`
      });
    } catch (err: unknown) {
      playTone('wrong');
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Rol güncellenemedi.'
      });
    } finally {
      setBusyUid(null);
    }
  };

  const handleDeleteMember = async (member: UserProfile) => {
    if (!currentUid || member.uid === currentUid) return;
    playTone('wrong');
    setBusyUid(member.uid);
    setActionMsg(null);
    try {
      await deleteMemberAsAdmin(member);
      setConfirmDeleteUid(null);
      setActionMsg({
        type: 'success',
        text: `${member.username} üye tablosundan silindi.`
      });
    } catch (err: unknown) {
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Üye silinemedi.'
      });
    } finally {
      setBusyUid(null);
    }
  };

  if (!authUser || !isAdmin) {
    const isUnverifiedAdminEmail =
      Boolean(authUser) && authUser?.email === ADMIN_EMAIL && !authUser?.emailVerified;

    return (
      <div className="max-w-2xl mx-auto py-8 animate-screen-in">
        <div className="ebru-glass-card rounded-[28px] p-8 text-center space-y-4 border border-[#FFBE0B]/35">
          <div className="w-16 h-16 rounded-2xl bg-[#0d1629] border border-[#FFBE0B]/45 mx-auto flex items-center justify-center">
            <Lock className="w-8 h-8 text-[#FFBE0B]" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">
            Yönetici Paneli
          </h1>
          <p className="text-xs sm:text-sm text-[#CBD5E1] max-w-md mx-auto leading-relaxed">
            {isUnverifiedAdminEmail
              ? 'Yönetici e-postasıyla oturum açtınız ancak yetkilerin aktifleşmesi için Google Hesabı ile doğrulanmış giriş yapmanız gerekir.'
              : 'Kullanıcıları yönetmek ve tekerleme onaylarını görmek için Yönetici hesabıyla giriş yapmalısınız.'}
          </p>
          <button
            type="button"
            onClick={() => {
              playTone('tap');
              onOpenAuth();
            }}
            className="px-6 py-3 rounded-2xl btn-epic-turquoise font-bold text-sm inline-flex items-center gap-2 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>{authUser ? 'Hesap Ayarlarını Aç' : 'Yönetici Girişi Yap'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-screen-in">
      {/* Admin Hero & Stats */}
      <div className="ebru-glass-card border-[1.5px] border-[#FFBE0B]/45 rounded-[28px] p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-display font-bold uppercase tracking-wider text-[#FFBE0B]">
              <ShieldCheck className="w-4 h-4" />
              <span>Dilbaz Yönetim Merkezi</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white font-display mt-1">
              Kullanıcı & İçerik Yönetimi
            </h1>
            <p className="text-xs text-[#CBD5E1] mt-0.5">
              Kayıtlı tüm üyeleri görüntüleyin, yönetici yetkisi verin veya üye çıkarın.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              playTone('tap');
              onOpenLibrary();
            }}
            className="px-4 py-2.5 rounded-2xl bg-[#06D6A0]/20 hover:bg-[#06D6A0]/30 border border-[#06D6A0]/45 text-[#06D6A0] text-xs font-bold flex items-center gap-2 cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            <span>Tekerleme Havuzuna Git</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-white/10">
          <div className="p-3 rounded-2xl bg-[#0d1629]/80 border border-white/10">
            <div className="text-[11px] text-[#93C5FD]">Toplam Üye</div>
            <div className="text-xl font-bold font-display text-white tabular-nums">
              {allMembers.length}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-[#0d1629]/80 border border-[#FFBE0B]/30">
            <div className="text-[11px] text-[#FFBE0B]">Yönetici</div>
            <div className="text-xl font-bold font-display text-[#FFBE0B] tabular-nums">
              {adminCount}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-[#0d1629]/80 border border-[#FF006E]/30">
            <div className="text-[11px] text-[#FF006E]">Onay Bekleyen</div>
            <div className="text-xl font-bold font-display text-white tabular-nums">
              {pendingContributions.length}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-[#0d1629]/80 border border-[#06D6A0]/30">
            <div className="text-[11px] text-[#06D6A0]">Yayındaki Tekerleme</div>
            <div className="text-xl font-bold font-display text-white tabular-nums">
              {approvedContributions.length}
            </div>
          </div>
        </div>
      </div>

      {/* Pending Tekerleme Approvals Quick Queue */}
      {pendingContributions.length > 0 && (
        <section className="ebru-glass-card border-[1.5px] border-[#00F5D4]/45 rounded-[26px] p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-[#00F5D4] font-display flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              <span>Onay Bekleyen Tekerleme Önerileri ({pendingContributions.length})</span>
            </h2>
          </div>

          <div className="space-y-2.5">
            {pendingContributions.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-[#0d1629]/85 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-white">{item.title}</span>
                    <span className="text-[11px] text-[#93C5FD]">
                      Öneren: <strong className="text-white">{item.authorUsername || 'Üye'}</strong>
                    </span>
                  </div>
                  <p className="text-xs text-[#CBD5E1]">{item.text}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      playTone('correct');
                      onApproveContribution(item);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#06D6A0] hover:bg-[#06D6A0]/90 text-[#0d1629] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Onayla (+{POINTS_FOR_APPROVED_TEKERLEME}p)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playTone('wrong');
                      onDeleteTekerleme(item);
                    }}
                    className="px-3 py-2 rounded-xl bg-[#FF006E]/20 hover:bg-[#FF006E]/35 text-rose-200 border border-[#FF006E]/40 text-xs font-semibold cursor-pointer"
                  >
                    Reddet / Sil
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Member Management Table */}
      <section className="ebru-glass-card border-[1.5px] border-[#FFBE0B]/45 rounded-[26px] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#FFBE0B] font-display flex items-center gap-2">
              <Users className="w-5 h-5" />
              <span>Kayıtlı Kullanıcılar ({filteredMembers.length})</span>
            </h2>
            <p className="text-[11px] text-[#CBD5E1] mt-0.5">
              Üyelere Yönetici yetkisi verebilir, yetkiyi geri alabilir veya hesabı silebilirsiniz.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-[#0d1629]/85 p-1 rounded-xl border border-white/10">
              {(['all', 'yonetici', 'uye'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    playTone('tap');
                    setRoleFilter(r);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                    roleFilter === r
                      ? 'bg-[#FFBE0B] text-[#0d1629]'
                      : 'text-[#CBD5E1] hover:text-white'
                  }`}
                >
                  {r === 'all' ? 'Tümü' : r === 'yonetici' ? 'Yönetici' : 'Üye'}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-48">
              <Search className="w-3.5 h-3.5 text-[#93C5FD] absolute left-3 top-2.5" />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Üye ara..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#0d1629]/85 border border-white/15 text-xs text-white focus:border-[#FFBE0B] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {membersError && (
          <div className="p-3 rounded-xl bg-[#FF006E]/20 border border-[#FF006E]/50 text-rose-100 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#FF006E] shrink-0" />
            <span>{membersError}</span>
          </div>
        )}

        {actionMsg && (
          <div
            className={`p-3 rounded-xl border text-xs font-semibold ${
              actionMsg.type === 'success'
                ? 'bg-[#06D6A0]/18 border-[#06D6A0]/45 text-emerald-100'
                : 'bg-[#FF006E]/20 border-[#FF006E]/45 text-rose-100'
            }`}
          >
            {actionMsg.text}
          </div>
        )}

        {!membersLoaded ? (
          <div className="py-10 text-center text-xs text-[#93C5FD]">
            Üye listesi yükleniyor...
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-10 text-center text-xs text-[#94A3B8]">
            Kayıtlı kullanıcı bulunamadı.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/12 text-[#93C5FD] uppercase font-mono text-[10px]">
                  <th className="py-2.5 px-2">Kullanıcı</th>
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
                          <KilimAvatar avatar={member.avatar} size={32} />
                          <div className="min-w-0">
                            <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                              <span className="truncate max-w-[180px]">{member.username}</span>
                              {isSelf && (
                                <span className="text-[10px] text-[#FFBE0B] font-mono">(Sen)</span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#94A3B8]">
                              {member.approvedTekerlemeCount} tekerleme · {member.multiplayerWins} 1. lik
                              {memberEmails[member.uid] && (
                                <span className="block text-[#00F5D4] font-mono mt-0.5">
                                  {memberEmails[member.uid]}
                                </span>
                              )}
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

                      <td className="py-3 px-2 font-mono font-bold text-[#FFBE0B] tabular-nums">
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
                              className={`px-2.5 py-1.5 rounded-xl font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap ${
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
        )}
      </section>
    </div>
  );
};
