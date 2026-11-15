import React, { useState, useMemo } from 'react';
import { User } from 'firebase/auth';
import { Friendship, Room, RoomInvite, UserProfile } from '../types/game';
import { KilimAvatar } from './KilimAvatar';
import { PWAInstallButton } from './PWAInstallButton';
import {
  sendFriendRequestByEmail,
  acceptFriendRequest,
  declineOrRemoveFriend,
  InvitedRoomStatusInfo,
  formatInviteDateTime
} from '../firebase/friendsFirestore';
import {
  getNotificationSupportState,
  requestMobileNotificationPermission,
  sendMobilePushNotification
} from '../utils/mobileNotifications';
import { playTone } from '../utils/soundEffects';
import {
  UserPlus,
  Users,
  Bell,
  BellRing,
  Check,
  X,
  Mail,
  Send,
  Swords,
  Trash2,
  LogIn,
  Lock,
  Smartphone,
  Sparkles,
  Clock
} from 'lucide-react';

interface FriendsPanelProps {
  authUser: User | null;
  userProfile: UserProfile | null;
  friendships: Friendship[];
  incomingInvites: RoomInvite[];
  sentInvites?: RoomInvite[];
  invitedRoomsInfo?: Record<string, InvitedRoomStatusInfo>;
  activeRoom: Room | null;
  onOpenAuth: () => void;
  onCreateRoomAndInvite: (friendUid: string, friendName: string) => Promise<void>;
  onInviteFriendToActiveRoom: (friendUid: string) => Promise<void>;
  onAcceptRoomInvite: (invite: RoomInvite) => Promise<void>;
  onDismissRoomInvite: (invite: RoomInvite) => Promise<void>;
}

export const FriendsPanel: React.FC<FriendsPanelProps> = ({
  authUser,
  userProfile,
  friendships,
  incomingInvites,
  sentInvites = [],
  invitedRoomsInfo = {},
  activeRoom,
  onOpenAuth,
  onCreateRoomAndInvite,
  onInviteFriendToActiveRoom,
  onAcceptRoomInvite,
  onDismissRoomInvite
}) => {
  const [emailInput, setEmailInput] = useState('');
  const [isSendingReq, setIsSendingReq] = useState(false);
  const [reqFeedback, setReqFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [invitedFriendIds, setInvitedFriendIds] = useState<Record<string, boolean>>({});
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [notifState, setNotifState] = useState(() => getNotificationSupportState());
  const [testPushFeedback, setTestPushFeedback] = useState<string | null>(null);

  const myUid = authUser?.uid || '';
  const myName = userProfile?.username || authUser?.email?.split('@')[0] || 'Üye';
  const myAvatar = userProfile?.avatar || 'elibelinde';

  const pendingInvites = useMemo(
    () => incomingInvites.filter((inv) => inv.status === 'pending'),
    [incomingInvites]
  );

  const incomingRequests = useMemo(
    () =>
      friendships.filter((f) => f.status === 'pending' && f.recipientUid === myUid),
    [friendships, myUid]
  );

  const outgoingRequests = useMemo(
    () =>
      friendships.filter((f) => f.status === 'pending' && f.requesterUid === myUid),
    [friendships, myUid]
  );

  const acceptedFriends = useMemo(
    () =>
      friendships
        .filter((f) => f.status === 'accepted')
        .map((f) => {
          const isRequester = f.requesterUid === myUid;
          return {
            friendshipId: f.id,
            uid: isRequester ? f.recipientUid : f.requesterUid,
            name: isRequester ? f.recipientName : f.requesterName,
            avatar: isRequester ? f.recipientAvatar : f.requesterAvatar,
            updatedAt: f.updatedAt
          };
        }),
    [friendships, myUid]
  );

  const handleEnableNotifications = async () => {
    playTone('tap');
    const perm = await requestMobileNotificationPermission();
    setNotifState(getNotificationSupportState());
    if (perm === 'granted') {
      await sendMobilePushNotification({
        title: 'Dilbaz Bildirimleri Aktif!',
        body: 'Arkadaşların seni yarışma odasına davet ettiğinde telefonuna bildirim gelecek.',
        tag: 'dilbaz_notif_ready',
        tab: 'friends'
      });
      setTestPushFeedback('Telefon bildirimleri başarıyla açıldı!');
      setTimeout(() => setTestPushFeedback(null), 3500);
    }
  };

  const handleSendTestNotification = async () => {
    playTone('notification');
    const sent = await sendMobilePushNotification({
      title: 'Dilbaz Test Bildirimi',
      body: 'Oda davetleri ve arkadaşlık teklifleri telefonuna bu şekilde düşecek!',
      tag: 'dilbaz_test_push',
      tab: 'friends'
    });
    setTestPushFeedback(
      sent
        ? 'Test bildirimi gönderildi!'
        : 'Tarayıcı bildirim izni henüz verilmedi veya desteklenmiyor.'
    );
    setTimeout(() => setTestPushFeedback(null), 3500);
  };

  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) return;
    setReqFeedback(null);
    setIsSendingReq(true);
    try {
      const target = await sendFriendRequestByEmail({
        targetEmail: emailInput,
        requesterUid: authUser.uid,
        requesterName: myName,
        requesterAvatar: myAvatar,
        myEmail: authUser.email
      });
      playTone('correct');
      setEmailInput('');
      setReqFeedback({
        type: 'success',
        text: `${target.username} kullanıcısına arkadaşlık teklifi gönderildi!`
      });
    } catch (err: unknown) {
      playTone('wrong');
      setReqFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Arkadaşlık teklifi gönderilemedi.'
      });
    } finally {
      setIsSendingReq(false);
    }
  };

  const handleAcceptRequest = async (f: Friendship) => {
    setBusyIds((prev) => ({ ...prev, [f.id]: true }));
    try {
      await acceptFriendRequest(f.id, myName, myAvatar);
      playTone('correct');
    } finally {
      setBusyIds((prev) => ({ ...prev, [f.id]: false }));
    }
  };

  const handleDeclineOrRemove = async (friendshipId: string) => {
    setBusyIds((prev) => ({ ...prev, [friendshipId]: true }));
    try {
      await declineOrRemoveFriend(friendshipId);
      setConfirmRemoveId(null);
      playTone('tap');
    } finally {
      setBusyIds((prev) => ({ ...prev, [friendshipId]: false }));
    }
  };

  const isActiveInviteableRoom = Boolean(
    activeRoom && activeRoom.status !== 'closed' && activeRoom.status !== 'game_over'
  );

  const handleInviteOrCreate = async (friendUid: string, friendName: string) => {
    setBusyIds((prev) => ({ ...prev, [friendUid]: true }));
    try {
      if (isActiveInviteableRoom) {
        await onInviteFriendToActiveRoom(friendUid);
      } else {
        await onCreateRoomAndInvite(friendUid, friendName);
      }
      setInvitedFriendIds((prev) => ({ ...prev, [friendUid]: true }));
      playTone('notification');
    } finally {
      setBusyIds((prev) => ({ ...prev, [friendUid]: false }));
    }
  };

  if (!authUser) {
    return (
      <div className="max-w-2xl mx-auto space-y-5 animate-screen-in">
        <div className="p-6 sm:p-8 ebru-glass-card rounded-[28px] text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#3A86FF] to-[#00F5D4] p-0.5 mx-auto shadow-lg shadow-[#3A86FF]/30">
            <div className="w-full h-full rounded-full bg-[#0d1629] flex items-center justify-center">
              <Lock className="w-7 h-7 text-[#00F5D4]" />
            </div>
          </div>
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl font-bold text-white">
              Arkadaşlar & Canlı Oda Davetleri
            </h1>
            <p className="text-xs sm:text-sm text-[#CBD5E1] max-w-md mx-auto leading-relaxed">
              E-posta adresiyle arkadaş eklemek, teklifleri kabul etmek ve arkadaşlarına telefon bildirimli yarışma daveti göndermek için giriş yapmalısın.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                playTone('tap');
                onOpenAuth();
              }}
              className="px-6 py-3 rounded-2xl btn-epic-turquoise text-sm font-bold flex items-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Giriş Yap / Kayıt Ol</span>
            </button>
            <PWAInstallButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-screen-in">
      {/* Header & Mobile Push Notifications Card */}
      <div className="p-5 sm:p-6 ebru-glass-card rounded-[28px] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2.5">
              <Users className="w-6 h-6 text-[#00F5D4]" />
              <span>Arkadaşlar & Davetler</span>
            </h1>
            <p className="text-xs text-[#93C5FD] mt-0.5">
              Arkadaşlarının e-posta adresini girerek ekle, tek dokunuşla oda kurup davet gönder.
            </p>
          </div>
          <PWAInstallButton />
        </div>

        {/* Mobile Push Permission Box */}
        <div className="p-3.5 rounded-2xl bg-[#0d1629]/85 border border-[#3A86FF]/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#3A86FF]/20 text-[#00F5D4] flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="space-y-0.5 text-xs">
              <div className="font-bold text-white flex items-center gap-1.5">
                <span>Mobil Bildirimler</span>
                {notifState.permission === 'granted' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#06D6A0]/20 text-[#06D6A0] border border-[#06D6A0]/40">
                    Açık ✓
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#CBD5E1]">
                {notifState.permission === 'granted'
                  ? 'Arkadaşların sana oda daveti veya arkadaşlık teklifi gönderdiğinde telefonuna bildirim düşer.'
                  : notifState.permission === 'denied'
                  ? 'Bildirim izni tarayıcı ayarlarından engellenmiş. Telefon ayarlarından bildirimlere izin verebilirsin.'
                  : 'Yarışma davetlerini anında telefon ekranında görmek için bildirim izni ver.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {notifState.permission === 'granted' ? (
              <button
                type="button"
                onClick={handleSendTestNotification}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-[#00F5D4] flex items-center gap-1.5 cursor-pointer"
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>Test Bildirimi</span>
              </button>
            ) : notifState.supported && notifState.permission !== 'denied' ? (
              <button
                type="button"
                onClick={handleEnableNotifications}
                className="px-4 py-2 rounded-xl btn-epic-turquoise text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Bildirimleri Aç</span>
              </button>
            ) : null}
          </div>
        </div>

        {testPushFeedback && (
          <div className="p-2.5 rounded-xl bg-[#06D6A0]/15 border border-[#06D6A0]/40 text-[#06D6A0] text-xs font-semibold text-center">
            {testPushFeedback}
          </div>
        )}
      </div>

      {/* Incoming Room Invitations */}
      {pendingInvites.length > 0 && (
        <section className="p-5 ebru-glass-card rounded-[28px] border-2 border-[#FFBE0B]/60 space-y-3">
          <h2 className="font-display text-base font-bold text-[#FFBE0B] flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span>Gelen Oda Davetleri ({pendingInvites.length})</span>
          </h2>
          <div className="space-y-2.5">
            {pendingInvites.map((invite) => {
              const roomInfo = invitedRoomsInfo[invite.roomCode];
              const isClosed = Boolean(
                roomInfo && (!roomInfo.exists || roomInfo.status === 'closed')
              );
              const isGameOver = roomInfo?.status === 'game_over';
              const isInProgress =
                roomInfo?.status === 'in_round' ||
                roomInfo?.status === 'round_result' ||
                roomInfo?.status === 'countdown';
              const isUnavailable = isClosed || isGameOver;
              const dateTimeText = formatInviteDateTime(invite.updatedAt || invite.createdAt);

              return (
                <div
                  key={invite.id}
                  className={`p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
                    isUnavailable
                      ? 'bg-[#0d1629]/65 border-white/15 opacity-90'
                      : 'bg-[#0d1629]/90 border-[#FFBE0B]/35'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <KilimAvatar avatar={invite.senderAvatar} size={42} />
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-sm font-bold text-white truncate">
                        {invite.senderName} seni yarışmaya çağırıyor!
                      </div>
                      <div className="text-xs text-[#93C5FD] flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>
                          Oda Kodu:{' '}
                          <strong className="font-mono text-[#FFBE0B]">{invite.roomCode}</strong> ·{' '}
                          {invite.roomTitle}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        {dateTimeText && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-[#CBD5E1]">
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
                        {isInProgress && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3A86FF]/20 text-[#93C5FD] border border-[#3A86FF]/45 font-bold">
                            Oyun Devam Ediyor
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isUnavailable ? (
                      <button
                        type="button"
                        onClick={() => {
                          playTone('tap');
                          onAcceptRoomInvite(invite);
                        }}
                        className="px-4 py-2 rounded-xl btn-epic-turquoise text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Swords className="w-3.5 h-3.5" />
                        <span>Odaya Katıl</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          playTone('tap');
                          onDismissRoomInvite(invite);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-[#CBD5E1] cursor-pointer"
                      >
                        Bildirimi Kapat
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        playTone('tap');
                        onDismissRoomInvite(invite);
                      }}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#CBD5E1] hover:text-white cursor-pointer"
                      title="Yoksay"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Add Friend by Email Form */}
      <section className="p-5 sm:p-6 ebru-glass-card rounded-[28px] space-y-3.5">
        <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-[#FF006E]" />
          <span>E-posta ile Arkadaş Ekle</span>
        </h2>

        <form onSubmit={handleSendFriendRequest} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Mail className="w-4 h-4 text-[#93C5FD] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Arkadaşının kayıtlı e-posta adresi (örn: ornek@gmail.com)"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#0d1629]/90 border border-white/15 text-white text-sm focus:border-[#00F5D4] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isSendingReq || !emailInput.trim()}
            className="px-5 py-3 rounded-xl btn-epic-pomegranate text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>{isSendingReq ? 'Gönderiliyor...' : 'Teklif Gönder'}</span>
          </button>
        </form>

        {reqFeedback && (
          <div
            className={`p-3 rounded-xl border text-xs font-semibold ${
              reqFeedback.type === 'success'
                ? 'bg-[#06D6A0]/15 border-[#06D6A0]/45 text-emerald-200'
                : 'bg-[#FF006E]/15 border-[#FF006E]/45 text-rose-200'
            }`}
          >
            {reqFeedback.text}
          </div>
        )}
      </section>

      {/* Incoming Friend Requests */}
      {incomingRequests.length > 0 && (
        <section className="p-5 sm:p-6 ebru-glass-card rounded-[28px] space-y-3">
          <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#FFBE0B]" />
            <span>Gelen Arkadaşlık Teklifleri ({incomingRequests.length})</span>
          </h2>
          <div className="space-y-2.5">
            {incomingRequests.map((req) => {
              const busy = Boolean(busyIds[req.id]);
              return (
                <div
                  key={req.id}
                  className="p-3.5 rounded-2xl bg-[#0d1629]/85 border border-white/12 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <KilimAvatar avatar={req.requesterAvatar} size={40} />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate">
                        {req.requesterName}
                      </div>
                      <div className="text-[11px] text-[#93C5FD]">
                        Seninle arkadaş olmak istiyor
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleAcceptRequest(req)}
                      className="px-3.5 py-2 rounded-xl bg-[#06D6A0] hover:bg-[#06D6A0]/90 text-[#0d1629] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Kabul Et</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDeclineOrRemove(req.id)}
                      className="px-3 py-2 rounded-xl bg-white/10 hover:bg-[#FF006E]/25 text-rose-200 text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reddet</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Accepted Friends List */}
      <section className="p-5 sm:p-6 ebru-glass-card rounded-[28px] space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#06D6A0]" />
            <span>Arkadaşlarım ({acceptedFriends.length})</span>
          </h2>
          {isActiveInviteableRoom && activeRoom && (
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#3A86FF]/20 text-[#93C5FD] border border-[#3A86FF]/40 font-mono">
              Aktif Oda: {activeRoom.code}
            </span>
          )}
        </div>

        {acceptedFriends.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#0d1629]/75 border border-white/10 text-center text-xs text-[#94A3B8] space-y-1">
            <p className="text-white font-semibold">Henüz arkadaşın yok.</p>
            <p>Yukarıdaki kutuya arkadaşının e-posta adresini yazarak ilk teklifini gönder!</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {acceptedFriends.map((friend) => {
              const busy = Boolean(busyIds[friend.uid]) || Boolean(busyIds[friend.friendshipId]);
              const isInActiveRoom = Boolean(
                activeRoom?.players.some((p) => p.id === friend.uid)
              );
              const latestInviteForFriend =
                (activeRoom
                  ? sentInvites.find(
                      (inv) => inv.recipientUid === friend.uid && inv.roomCode === activeRoom.code
                    )
                  : undefined) || sentInvites.find((inv) => inv.recipientUid === friend.uid);

              const wasDeclined = latestInviteForFriend?.status === 'dismissed';
              const isPendingInvite =
                latestInviteForFriend?.status === 'pending' &&
                (!activeRoom || latestInviteForFriend.roomCode === activeRoom.code);
              const isInvitedNow = Boolean(invitedFriendIds[friend.uid]) || isPendingInvite;
              const isConfirmingRemove = confirmRemoveId === friend.friendshipId;

              return (
                <div
                  key={friend.friendshipId}
                  className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-3 ${
                    wasDeclined && !isInActiveRoom
                      ? 'bg-[#FF006E]/10 border-[#FF006E]/40'
                      : 'bg-[#0d1629]/85 border-white/12'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <KilimAvatar avatar={friend.avatar} size={42} />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">
                          {friend.name}
                        </div>
                        {wasDeclined && !isInActiveRoom ? (
                          <div className="text-[11px] text-rose-300 font-semibold">
                            {latestInviteForFriend?.roomCode} davetini kabul etmedi
                          </div>
                        ) : isInvitedNow && !isInActiveRoom ? (
                          <div className="text-[11px] text-[#06D6A0]">
                            Davet gönderildi · Yanıt bekleniyor
                          </div>
                        ) : (
                          <div className="text-[11px] text-[#06D6A0]">Arkadaş</div>
                        )}
                      </div>
                    </div>

                    {!isConfirmingRemove ? (
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveId(friend.friendshipId)}
                        className="p-1.5 rounded-lg text-[#94A3B8] hover:text-rose-300 hover:bg-white/5 cursor-pointer"
                        title="Arkadaşlıktan çıkar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDeclineOrRemove(friend.friendshipId)}
                          className="px-2 py-1 rounded-lg bg-[#FF006E] text-white text-[10px] font-bold cursor-pointer"
                        >
                          Çıkar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(null)}
                          className="px-2 py-1 rounded-lg bg-white/10 text-white text-[10px] cursor-pointer"
                        >
                          Vazgeç
                        </button>
                      </div>
                    )}
                  </div>

                  {isInActiveRoom ? (
                    <div className="w-full py-2 rounded-xl bg-[#06D6A0]/15 border border-[#06D6A0]/35 text-[#06D6A0] text-xs font-bold text-center">
                      Odada Hazır Bekliyor ✓
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleInviteOrCreate(friend.uid, friend.name)}
                      className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 ${
                        wasDeclined
                          ? 'bg-gradient-to-r from-[#FF006E] to-[#FFBE0B] text-white hover:opacity-95'
                          : isInvitedNow
                          ? 'bg-[#06D6A0]/20 hover:bg-[#06D6A0]/30 border border-[#06D6A0]/45 text-[#06D6A0]'
                          : 'bg-gradient-to-r from-[#3A86FF] to-[#FF006E] text-white hover:opacity-95'
                      }`}
                    >
                      <Swords className="w-3.5 h-3.5" />
                      <span>
                        {busy
                          ? 'Gönderiliyor...'
                          : wasDeclined || isInvitedNow
                          ? isActiveInviteableRoom
                            ? 'Tekrar Davet Et'
                            : 'Yeni Oda Kur & Tekrar Davet Et'
                          : isActiveInviteableRoom
                          ? 'Aktif Odaya Davet Et'
                          : 'Oda Kur & Davet Et'}
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Outgoing Sent Friend Requests */}
      {outgoingRequests.length > 0 && (
        <section className="p-5 ebru-glass-card rounded-[28px] space-y-3">
          <h2 className="font-display text-sm font-bold text-[#CBD5E1] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#93C5FD]" />
            <span>Yanıt Bekleyen Gönderilen İstekler ({outgoingRequests.length})</span>
          </h2>
          <div className="space-y-2">
            {outgoingRequests.map((req) => (
              <div
                key={req.id}
                className="p-3 rounded-2xl bg-[#0d1629]/70 border border-white/10 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <KilimAvatar avatar={req.recipientAvatar} size={34} />
                  <span className="text-xs font-semibold text-white truncate">
                    {req.recipientName}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FFBE0B]/15 text-[#FFBE0B]">
                    Onay Bekliyor
                  </span>
                </div>
                <button
                  type="button"
                  disabled={Boolean(busyIds[req.id])}
                  onClick={() => handleDeclineOrRemove(req.id)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] text-[#CBD5E1] cursor-pointer"
                >
                  İptal Et
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
