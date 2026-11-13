import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User } from 'firebase/auth';
import {
  Tekerleme,
  Room,
  PlayerScore,
  Difficulty,
  PhonemeCategory,
  UserProfile,
  UserNotification,
  Friendship,
  RoomInvite
} from './types/game';
import { INITIAL_TEKERLEMELER } from './data/tekerlemeler';
import { RoomFirestore } from './firebase/roomFirestore';
import {
  subscribeToAuth,
  subscribeToUserProfile,
  subscribeToMyNotifications,
  markNotificationRead,
  deleteNotification,
  checkIsAdmin,
  consumeGoogleRedirectResult
} from './firebase/authService';
import {
  subscribeToApprovedTekerlemeler,
  subscribeToMyContributions,
  subscribeToAllTekerlemelerForAdmin,
  submitTekerlemeContribution,
  updateTekerlemeContribution,
  deleteTekerlemeContribution,
  deleteTekerlemeContributionAsAdmin,
  approveTekerlemeContribution,
  normalizeTekerlemeText,
  syncUniqueSeedTekerlemeler
} from './firebase/tekerlemeFirestore';
import {
  syncMyEmailDirectory,
  subscribeToMyFriendships,
  subscribeToMyRoomInvites,
  sendRoomInviteToFriend,
  respondToRoomInvite
} from './firebase/friendsFirestore';
import { Navbar, AppTab } from './components/Navbar';
import { EbruBackground } from './components/EbruBackground';
import { FxCanvas } from './components/FxCanvas';
import { IntroSplash } from './components/IntroSplash';
import { RoomLobby } from './components/RoomLobby';
import { GameArena } from './components/GameArena';
import { RoundResults } from './components/RoundResults';
import { Leaderboard } from './components/Leaderboard';
import { GlobalLeaderboard } from './components/GlobalLeaderboard';
import { SoloPractice } from './components/SoloPractice';
import { TekerlemeLibrary } from './components/TekerlemeLibrary';
import { FriendsPanel } from './components/FriendsPanel';
import { GuideModal } from './components/GuideModal';
import { AddTekerlemeModal } from './components/AddTekerlemeModal';
import { AuthModal } from './components/AuthModal';
import { KILIM_MOTIFS, getKilimMotif } from './components/KilimAvatar';
import { setSoundMuted, playTone } from './utils/soundEffects';
import {
  registerServiceWorker,
  sendMobilePushNotification,
  subscribeToNotificationClicks
} from './utils/mobileNotifications';
import { Users, Mic, BookOpen, Trophy, Bell, X, UserPlus, Swords } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('room');
  const [isMobileView, setIsMobileView] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [editingTekerleme, setEditingTekerleme] = useState<Tekerleme | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [initialCodeParam, setInitialCodeParam] = useState('');
  const [selectedPracticeTekerlemeId, setSelectedPracticeTekerlemeId] = useState<string | undefined>(undefined);

  // Firebase Auth + User Profile + Notifications state
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [profileLoaded, setProfileLoaded] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [roomInvites, setRoomInvites] = useState<RoomInvite[]>([]);
  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  const seenFriendReqIdsRef = useRef<Set<string>>(new Set());
  const seenInviteKeysRef = useRef<Set<string>>(new Set());
  const initialFriendshipsLoadedRef = useRef<boolean>(false);
  const initialInvitesLoadedRef = useRef<boolean>(false);

  // Intro video splash state (skip automatically if joining directly via ?oda= link)
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('oda') || params.get('room')) return false;
    return !sessionStorage.getItem('dilbaz_intro_seen');
  });

  const [isMuted, setIsMuted] = useState<boolean>(false);

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    setSoundMuted(nextMuted);
    if (!nextMuted) {
      playTone('tap');
    }
  };

  const handleCompleteIntro = () => {
    try {
      sessionStorage.setItem('dilbaz_intro_seen', '1');
    } catch {
      // ignore
    }
    setShowIntro(false);
  };

  // Built-in / local fallback tekerlemeler (v2 merges all 78 unique deduplicated entries)
  const [localTekerlemeler, setLocalTekerlemeler] = useState<Tekerleme[]>(() => {
    try {
      const savedV2 = localStorage.getItem('dilbaz_tekerlemeler_v2');
      if (savedV2) {
        const parsed = JSON.parse(savedV2);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return INITIAL_TEKERLEMELER;
    } catch {
      return INITIAL_TEKERLEMELER;
    }
  });

  // Firestore community tekerlemeler
  const [approvedCommunityTekerlemeler, setApprovedCommunityTekerlemeler] = useState<Tekerleme[]>([]);
  const [myContributions, setMyContributions] = useState<Tekerleme[]>([]);
  const [adminContributions, setAdminContributions] = useState<Tekerleme[]>([]);
  const seedSyncAttemptedRef = useRef<boolean>(false);

  const tekerlemeler = useMemo(() => {
    const sourceList =
      approvedCommunityTekerlemeler.length > 0
        ? approvedCommunityTekerlemeler
        : localTekerlemeler;

    const seenIds = new Set<string>();
    const seenTexts = new Set<string>();
    const unique: Tekerleme[] = [];

    for (const item of sourceList) {
      const norm = normalizeTekerlemeText(item.text);
      if (!seenIds.has(item.id) && !seenTexts.has(norm)) {
        seenIds.add(item.id);
        seenTexts.add(norm);
        unique.push(item);
      }
    }
    return unique;
  }, [approvedCommunityTekerlemeler, localTekerlemeler]);

  // Unique per-tab/device guest user session (overridden by Firebase UID when signed in)
  const [guestUser, setGuestUser] = useState(() => {
    const defaultMotif = KILIM_MOTIFS[0];
    let id = '';
    let name = '';
    let avatar = defaultMotif.id;

    if (typeof window !== 'undefined') {
      try {
        id = sessionStorage.getItem('dilbaz_session_id') || '';
        name = sessionStorage.getItem('dilbaz_session_name') || '';
        const savedAvatar = sessionStorage.getItem('dilbaz_session_avatar') || '';

        if (savedAvatar && getKilimMotif(savedAvatar)) {
          avatar = savedAvatar;
        }
        if (!id) {
          id = `usr_${Math.random().toString(36).substring(2, 9)}`;
          sessionStorage.setItem('dilbaz_session_id', id);
        }
      } catch {
        id = `usr_${Date.now()}`;
      }
    }

    const activeMotif = getKilimMotif(avatar) || defaultMotif;
    const resolvedName = !name || name === 'Öğrenci' ? activeMotif.name : name;

    return {
      id: id || 'usr_1',
      name: resolvedName,
      avatar
    };
  });

  const currentUser = useMemo(() => {
    if (authUser) {
      return {
        id: authUser.uid,
        name: userProfile?.username || authUser.email?.split('@')[0] || guestUser.name,
        avatar:
          userProfile?.avatar && getKilimMotif(userProfile.avatar)
            ? userProfile.avatar
            : guestUser.avatar
      };
    }
    return guestUser;
  }, [authUser, userProfile, guestUser]);

  // Subscribe to Firebase Auth state & profile & notifications & friendships & room invites
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubNotifs: (() => void) | null = null;
    let unsubFriends: (() => void) | null = null;
    let unsubInvites: (() => void) | null = null;

    consumeGoogleRedirectResult();
    const unsubAuth = subscribeToAuth(async (user) => {
      setAuthUser(user);
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      if (unsubNotifs) {
        unsubNotifs();
        unsubNotifs = null;
      }
      if (unsubFriends) {
        unsubFriends();
        unsubFriends = null;
      }
      if (unsubInvites) {
        unsubInvites();
        unsubInvites = null;
      }

      initialFriendshipsLoadedRef.current = false;
      initialInvitesLoadedRef.current = false;
      seenFriendReqIdsRef.current.clear();
      seenInviteKeysRef.current.clear();

      if (!user) {
        setUserProfile(null);
        setIsAdmin(false);
        setProfileLoaded(false);
        setMyContributions([]);
        setAdminContributions([]);
        setNotifications([]);
        setFriendships([]);
        setRoomInvites([]);
        return;
      }

      setProfileLoaded(false);
      const adminFlag = await checkIsAdmin(user);
      setIsAdmin(adminFlag);

      unsubProfile = subscribeToUserProfile(user.uid, (profile) => {
        setUserProfile(profile);
        setProfileLoaded(true);
        if (profile?.role === 'yonetici') {
          setIsAdmin(true);
        }
        if (!profile) {
          setIsAuthModalOpen(true);
        }
      });

      unsubNotifs = subscribeToMyNotifications(user.uid, (list) => {
        setNotifications(list);
        for (const n of list) {
          if (!n.read && !seenNotifIdsRef.current.has(n.id)) {
            seenNotifIdsRef.current.add(n.id);
            playTone('notification');
            break;
          }
        }
      });

      unsubFriends = subscribeToMyFriendships(user.uid, (list) => {
        setFriendships(list);
        const incomingPending = list.filter(
          (f) => f.status === 'pending' && f.recipientUid === user.uid
        );

        if (!initialFriendshipsLoadedRef.current) {
          initialFriendshipsLoadedRef.current = true;
          incomingPending.forEach((f) => seenFriendReqIdsRef.current.add(f.id));
          return;
        }

        for (const f of incomingPending) {
          if (!seenFriendReqIdsRef.current.has(f.id)) {
            seenFriendReqIdsRef.current.add(f.id);
            playTone('notification');
            sendMobilePushNotification({
              title: 'Yeni Arkadaşlık Teklifi!',
              body: `${f.requesterName} sana Dilbaz'da arkadaşlık teklifi gönderdi.`,
              tag: `friend_${f.id}`,
              tab: 'friends'
            });
          }
        }
      });

      unsubInvites = subscribeToMyRoomInvites(user.uid, (list) => {
        setRoomInvites(list);
        const pending = list.filter((inv) => inv.status === 'pending');

        if (!initialInvitesLoadedRef.current) {
          initialInvitesLoadedRef.current = true;
          pending.forEach((inv) => seenInviteKeysRef.current.add(`${inv.id}_${inv.updatedAt}`));
          return;
        }

        for (const inv of pending) {
          const key = `${inv.id}_${inv.updatedAt}`;
          if (!seenInviteKeysRef.current.has(key)) {
            seenInviteKeysRef.current.add(key);
            playTone('notification');
            sendMobilePushNotification({
              title: 'Dilbaz Oda Daveti!',
              body: `${inv.senderName} seni ${inv.roomCode} yarışma odasına davet etti!`,
              tag: `invite_${inv.id}`,
              roomCode: inv.roomCode,
              tab: 'room'
            });
          }
        }
      });
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
      if (unsubNotifs) unsubNotifs();
      if (unsubFriends) unsubFriends();
      if (unsubInvites) unsubInvites();
    };
  }, []);

  // Automatically sync hashed email index so existing & new members can be found by email
  useEffect(() => {
    if (!authUser || !userProfile || !authUser.email) return;
    syncMyEmailDirectory({
      uid: authUser.uid,
      email: authUser.email,
      username: userProfile.username,
      avatar: userProfile.avatar
    });
  }, [authUser, userProfile]);

  // Subscribe to approved community tekerlemeler only when signed in
  useEffect(() => {
    if (!authUser) {
      setApprovedCommunityTekerlemeler([]);
      return;
    }
    const unsub = subscribeToApprovedTekerlemeler(setApprovedCommunityTekerlemeler);
    return () => unsub();
  }, [authUser]);

  // Subscribe to user's own contributions
  useEffect(() => {
    if (!authUser) {
      setMyContributions([]);
      return;
    }
    const unsub = subscribeToMyContributions(authUser.uid, setMyContributions);
    return () => unsub();
  }, [authUser]);

  // Subscribe to all contributions if admin & auto-sync seed dataset once per v2 upgrade
  useEffect(() => {
    if (!isAdmin || !authUser) {
      setAdminContributions([]);
      return;
    }
    const unsub = subscribeToAllTekerlemelerForAdmin(setAdminContributions);

    if (!seedSyncAttemptedRef.current) {
      seedSyncAttemptedRef.current = true;
      let alreadySynced = false;
      try {
        alreadySynced = localStorage.getItem('dilbaz_seed_v2_done') === '1';
      } catch {
        alreadySynced = false;
      }
      if (!alreadySynced) {
        const adminName = userProfile?.username || authUser.email || 'Yönetici';
        syncUniqueSeedTekerlemeler(INITIAL_TEKERLEMELER, authUser.uid, adminName)
          .then(() => {
            try {
              localStorage.setItem('dilbaz_seed_v2_done', '1');
            } catch {
              // ignore
            }
          })
          .catch((err) => {
            console.warn('Admin tekerleme seed sync warning:', err);
          });
      }
    }

    return () => unsub();
  }, [isAdmin, authUser, userProfile?.username]);

  // Active Multiplayer Room
  const [room, setRoom] = useState<Room | null>(null);
  const [currentRoundUserScore, setCurrentRoundUserScore] = useState<PlayerScore | null>(null);
  const sseUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    registerServiceWorker();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const codeFromUrl = params.get('oda') || params.get('room');
      if (codeFromUrl) {
        setInitialCodeParam(codeFromUrl.toUpperCase());
        setActiveTab('room');
      }
    }
  }, []);

  useEffect(() => {
    if (!room?.code) {
      if (sseUnsubRef.current) {
        sseUnsubRef.current();
        sseUnsubRef.current = null;
      }
      return;
    }

    const unsub = RoomFirestore.subscribeToRoom(
      room.code,
      (updatedRoom) => {
        setRoom((prev) => {
          if (prev && prev.currentRound !== updatedRoom.currentRound) {
            setCurrentRoundUserScore(null);
          }
          return updatedRoom;
        });
      },
      (err) => {
        console.warn('Room Firestore stream warning:', err);
      }
    );

    sseUnsubRef.current = unsub;

    return () => {
      unsub();
    };
  }, [room?.code]);

  useEffect(() => {
    try {
      localStorage.setItem('dilbaz_tekerlemeler_v2', JSON.stringify(localTekerlemeler));
    } catch {
      // ignore
    }
  }, [localTekerlemeler]);

  const handleCreateRoom = async (settings: {
    roundCount: number;
    difficulty: 'karisik' | Difficulty;
    category: PhonemeCategory;
    creatorName: string;
    creatorAvatar: string;
  }) => {
    setIsLoading(true);
    setRoomError(null);
    try {
      setGuestUser((prev) => ({
        ...prev,
        name: settings.creatorName,
        avatar: settings.creatorAvatar
      }));

      sessionStorage.setItem('dilbaz_session_name', settings.creatorName);
      sessionStorage.setItem('dilbaz_session_avatar', settings.creatorAvatar);

      const created = await RoomFirestore.createRoom({
        hostId: currentUser.id,
        hostName: settings.creatorName,
        avatar: settings.creatorAvatar,
        roundCount: settings.roundCount,
        difficulty: settings.difficulty,
        category: settings.category
      });

      setRoom(created);
      setCurrentRoundUserScore(null);
    } catch (err: any) {
      setRoomError(err.message || 'Oda oluşturulurken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (code: string, playerName: string, avatar: string) => {
    setIsLoading(true);
    setRoomError(null);
    try {
      setGuestUser((prev) => ({
        ...prev,
        name: playerName,
        avatar
      }));

      sessionStorage.setItem('dilbaz_session_name', playerName);
      sessionStorage.setItem('dilbaz_session_avatar', avatar);

      const joinedRoom = await RoomFirestore.joinRoom(code, {
        id: currentUser.id,
        name: playerName,
        avatar: avatar
      });

      setRoom(joinedRoom);
      setCurrentRoundUserScore(null);
    } catch (err: any) {
      setRoomError(err.message || 'Odaya katılım sağlanamadı. Lütfen PIN kodunu kontrol edin.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddBotPlayer = async () => {
    if (!room) return;
    try {
      await RoomFirestore.addTestBot(room.code);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleReady = async () => {
    if (!room) return;
    try {
      await RoomFirestore.toggleReady(room.code, currentUser.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartGame = async () => {
    if (!room) return;
    setRoomError(null);
    try {
      await RoomFirestore.startGame(room.code, currentUser.id, tekerlemeler);
      setCurrentRoundUserScore(null);
    } catch (err: any) {
      console.error('Start game error:', err);
      setRoomError(err.message || 'Oyun başlatılamadı');
    }
  };

  const handleFinishRound = async (userScore: PlayerScore) => {
    if (!room) return;
    setCurrentRoundUserScore(userScore);
    try {
      await RoomFirestore.submitScore(room.code, userScore);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNextRound = async () => {
    if (!room) return;
    try {
      await RoomFirestore.nextRound(room.code, currentUser.id, tekerlemeler);
      setCurrentRoundUserScore(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRestartGame = async () => {
    if (!room) return;
    try {
      await RoomFirestore.restartGame(room.code, currentUser.id, tekerlemeler);
      setCurrentRoundUserScore(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLeaveRoom = async () => {
    if (room) {
      try {
        await RoomFirestore.leaveRoom(room.code, currentUser.id);
      } catch {
        // ignore
      }
    }
    setRoom(null);
    setCurrentRoundUserScore(null);
    setRoomError(null);
  };

  const handleSaveTekerleme = async (saved: Tekerleme) => {
    if (editingTekerleme && editingTekerleme.authorId) {
      await updateTekerlemeContribution(saved);
      setEditingTekerleme(null);
      return;
    }

    if (editingTekerleme && !editingTekerleme.authorId) {
      setLocalTekerlemeler((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
      setEditingTekerleme(null);
      return;
    }

    if (authUser) {
      await submitTekerlemeContribution({
        tekerleme: saved,
        authorId: authUser.uid,
        authorUsername: userProfile?.username || authUser.email || 'Üye',
        isAdmin
      });
      setEditingTekerleme(null);
      return;
    }

    setLocalTekerlemeler((prev) => [saved, ...prev]);
    setEditingTekerleme(null);
  };

  const handleDeleteTekerleme = async (item: Tekerleme) => {
    if (item.authorId) {
      if (isAdmin && authUser) {
        await deleteTekerlemeContributionAsAdmin(item, authUser.uid);
      } else {
        await deleteTekerlemeContribution(item.id);
      }
    }
    setLocalTekerlemeler((prev) => prev.filter((t) => t.id !== item.id));
    if (selectedPracticeTekerlemeId === item.id) {
      setSelectedPracticeTekerlemeId(undefined);
    }
  };

  const handleDismissNotification = async (notificationId: string) => {
    await markNotificationRead(notificationId).catch(() => undefined);
    await deleteNotification(notificationId).catch(() => undefined);
  };

  const handleResetDefaultTekerlemeler = () => {
    setLocalTekerlemeler(INITIAL_TEKERLEMELER);
  };

  const handleSyncSeedToFirestore = async () => {
    if (!isAdmin || !authUser) return undefined;
    const adminName = userProfile?.username || authUser.email || 'Yönetici';
    const result = await syncUniqueSeedTekerlemeler(INITIAL_TEKERLEMELER, authUser.uid, adminName);
    try {
      localStorage.setItem('dilbaz_seed_v2_done', '1');
    } catch {
      // ignore
    }
    return result;
  };

  const handleAcceptRoomInvite = async (invite: RoomInvite) => {
    await respondToRoomInvite(invite.id, 'accepted').catch(() => undefined);
    setActiveTab('room');
    await handleJoinRoom(invite.roomCode, currentUser.name, currentUser.avatar);
  };

  const handleDismissRoomInvite = async (invite: RoomInvite) => {
    await respondToRoomInvite(invite.id, 'dismissed').catch(() => undefined);
  };

  const handleInviteFriendToActiveRoom = async (friendUid: string) => {
    if (!room || !authUser) return;
    await sendRoomInviteToFriend({
      roomCode: room.code,
      roomTitle: room.title,
      senderUid: authUser.uid,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      recipientUid: friendUid
    });
  };

  const handleCreateRoomAndInviteFriend = async (friendUid: string) => {
    if (!authUser) {
      setIsAuthModalOpen(true);
      return;
    }
    setIsLoading(true);
    setRoomError(null);
    try {
      const created = await RoomFirestore.createRoom({
        hostId: currentUser.id,
        hostName: currentUser.name,
        avatar: currentUser.avatar,
        roundCount: 3,
        difficulty: 'karisik',
        category: 'tum'
      });
      setRoom(created);
      setCurrentRoundUserScore(null);
      setActiveTab('room');
      await sendRoomInviteToFriend({
        roomCode: created.code,
        roomTitle: created.title,
        senderUid: authUser.uid,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        recipientUid: friendUid
      });
    } catch (err: unknown) {
      setRoomError(err instanceof Error ? err.message : 'Oda oluşturulurken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const notifClickHandlerRef = useRef<(detail: { roomCode?: string; tab?: string }) => void>(() => undefined);
  notifClickHandlerRef.current = ({ roomCode, tab }) => {
    if (roomCode) {
      setActiveTab('room');
      if (room?.code !== roomCode) {
        setInitialCodeParam(roomCode.toUpperCase());
        handleJoinRoom(roomCode, currentUser.name, currentUser.avatar);
      }
      return;
    }
    if (tab === 'friends' || tab === 'room' || tab === 'library' || tab === 'leaderboard') {
      setActiveTab(tab);
    }
  };

  useEffect(() => {
    return subscribeToNotificationClicks((detail) => {
      notifClickHandlerRef.current(detail);
    });
  }, []);

  const unreadNotifications = notifications.filter((n) => !n.read);
  const pendingRoomInvites = useMemo(
    () => roomInvites.filter((inv) => inv.status === 'pending' && inv.roomCode !== room?.code),
    [roomInvites, room?.code]
  );
  const incomingFriendRequestsCount = useMemo(
    () =>
      authUser
        ? friendships.filter((f) => f.status === 'pending' && f.recipientUid === authUser.uid).length
        : 0,
    [friendships, authUser]
  );
  const pendingFriendsBadgeCount = incomingFriendRequestsCount + pendingRoomInvites.length;

  const acceptedFriendsSummary = useMemo(() => {
    if (!authUser) return [];
    return friendships
      .filter((f) => f.status === 'accepted')
      .map((f) => {
        const isRequester = f.requesterUid === authUser.uid;
        return {
          uid: isRequester ? f.recipientUid : f.requesterUid,
          name: isRequester ? f.recipientName : f.requesterName,
          avatar: isRequester ? f.recipientAvatar : f.requesterAvatar
        };
      });
  }, [friendships, authUser]);

  const roundScoresForCurrentRound: PlayerScore[] =
    room?.roundScores?.[room.currentRound] ||
    room?.players.filter((p) => Boolean(p.currentRoundScore)).map((p) => p.currentRoundScore!) ||
    [];

  const mySubmittedScore: PlayerScore | null =
    currentRoundUserScore ||
    roundScoresForCurrentRound.find((s) => s.playerId === currentUser.id) ||
    room?.players.find((p) => p.id === currentUser.id)?.currentRoundScore ||
    null;

  return (
    <div className="relative min-h-screen text-[#F8FAFC] flex flex-col">
      <EbruBackground />
      <FxCanvas />

      {showIntro && <IntroSplash onComplete={handleCompleteIntro} />}

      <div className="relative z-40">
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isMobileView={isMobileView}
          setIsMobileView={setIsMobileView}
          onOpenGuide={() => setIsGuideOpen(true)}
          pointsCount={userProfile?.points ?? 0}
          pendingFriendsCount={pendingFriendsBadgeCount}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onReplayIntro={() => setShowIntro(true)}
          authUser={authUser}
          userProfile={userProfile}
          isAdmin={isAdmin}
          onOpenAuth={() => setIsAuthModalOpen(true)}
        />
      </div>

      {/* Live Incoming Room Invitation Banner */}
      {authUser && pendingRoomInvites.length > 0 && (
        <div className="relative z-30 max-w-4xl w-full mx-auto px-3 sm:px-4 pt-3 space-y-2">
          {pendingRoomInvites.slice(0, 2).map((invite) => (
            <div
              key={invite.id}
              className="p-3 rounded-2xl border-2 border-[#FFBE0B]/65 bg-gradient-to-r from-[#FFBE0B]/20 via-[#FF006E]/20 to-[#3A86FF]/20 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg animate-screen-in"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Bell className="w-4 h-4 text-[#FFBE0B] shrink-0 animate-bounce" />
                <div className="min-w-0 text-white">
                  <strong className="text-[#FFBE0B]">{invite.senderName}</strong> seni{' '}
                  <span className="font-mono font-bold text-[#00F5D4]">{invite.roomCode}</span>{' '}
                  yarışma odasına davet etti!
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    playTone('tap');
                    handleAcceptRoomInvite(invite);
                  }}
                  className="px-3.5 py-1.5 rounded-xl btn-epic-turquoise text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Swords className="w-3.5 h-3.5" />
                  <span>Odaya Katıl</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playTone('tap');
                    handleDismissRoomInvite(invite);
                  }}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  aria-label="Daveti kapat"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Live Unread User Notifications Strip (Approved / Deleted / Role Updated) */}
      {authUser && unreadNotifications.length > 0 && (
        <div className="relative z-30 max-w-4xl w-full mx-auto px-3 sm:px-4 pt-3 space-y-2">
          {unreadNotifications.slice(0, 2).map((notif) => {
            const isPositive =
              notif.type === 'tekerleme_approved' || notif.type === 'role_updated';
            return (
              <div
                key={notif.id}
                className={`p-3 rounded-2xl border backdrop-blur-md flex items-center justify-between gap-3 text-xs shadow-lg animate-screen-in ${
                  isPositive
                    ? 'bg-[#06D6A0]/20 border-[#06D6A0]/55 text-emerald-100'
                    : 'bg-[#FF006E]/20 border-[#FF006E]/55 text-rose-100'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Bell
                    className={`w-4 h-4 shrink-0 ${
                      isPositive ? 'text-[#06D6A0]' : 'text-[#FF006E]'
                    }`}
                  />
                  <div className="min-w-0">
                    <span className="font-bold mr-1.5">{notif.title}:</span>
                    <span className="opacity-90">{notif.message}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    playTone('tap');
                    handleDismissNotification(notif.id);
                  }}
                  className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white shrink-0 cursor-pointer"
                  aria-label="Bildirimi kapat"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <main className="relative z-10 flex-1 px-3 sm:px-4 pt-5 pb-24 md:py-8 flex justify-center items-start">
        <div
          className={`w-full transition-all duration-300 ${
            isMobileView
              ? 'max-w-[390px] device-shell-frame p-4 min-h-[780px] flex flex-col relative overflow-hidden'
              : 'max-w-5xl'
          }`}
        >
          {isMobileView && (
            <div className="w-28 h-3.5 bg-[#24365c] rounded-full mx-auto mb-3 shrink-0" />
          )}

          {/* TAB 1: YARIŞMA ODALARI */}
          {activeTab === 'room' && (
            <>
              {(!room || room.status === 'waiting') && (
                <RoomLobby
                  room={room}
                  currentUser={currentUser}
                  initialCode={initialCodeParam}
                  error={roomError}
                  isLoading={isLoading}
                  authUser={authUser}
                  userProfile={userProfile}
                  friends={acceptedFriendsSummary}
                  incomingInvites={pendingRoomInvites}
                  pendingFriendsCount={pendingFriendsBadgeCount}
                  onOpenAuth={() => setIsAuthModalOpen(true)}
                  onNavigateTab={setActiveTab}
                  onAcceptInvite={handleAcceptRoomInvite}
                  onDismissInvite={handleDismissRoomInvite}
                  onInviteFriendToRoom={handleInviteFriendToActiveRoom}
                  onCreateRoom={handleCreateRoom}
                  onJoinRoom={handleJoinRoom}
                  onStartGame={handleStartGame}
                  onAddBotPlayer={handleAddBotPlayer}
                  onToggleReady={handleToggleReady}
                  onLeaveRoom={handleLeaveRoom}
                />
              )}

              {room && room.status === 'in_round' && room.currentTekerleme && !mySubmittedScore && (
                <GameArena
                  tekerleme={room.currentTekerleme}
                  currentRound={room.currentRound}
                  totalRounds={room.totalRounds}
                  timeLimitSeconds={room.settings.timeLimitSeconds}
                  currentUser={currentUser}
                  isHost={room.hostId === currentUser.id}
                  onFinishRound={handleFinishRound}
                />
              )}

              {room && ((room.status === 'in_round' && mySubmittedScore) || room.status === 'round_result') && (
                <RoundResults
                  currentUserScore={
                    mySubmittedScore || {
                      playerId: currentUser.id,
                      playerName: currentUser.name,
                      avatar: currentUser.avatar,
                      isHost: room.hostId === currentUser.id,
                      isCurrentUser: true,
                      accuracy: 0,
                      durationSeconds: room.settings.timeLimitSeconds,
                      wpm: 0,
                      speedScore: 0,
                      totalScore: 0
                    }
                  }
                  allPlayerScores={
                    roundScoresForCurrentRound.length > 0
                      ? roundScoresForCurrentRound
                      : mySubmittedScore
                      ? [mySubmittedScore]
                      : []
                  }
                  currentRound={room.currentRound}
                  totalRounds={room.totalRounds}
                  totalPlayersCount={room.players.length}
                  isWaitingForOthers={room.status === 'in_round'}
                  isHost={room.hostId === currentUser.id}
                  onForceFinishRound={() => RoomFirestore.finishRoundNow(room.code, currentUser.id)}
                  onNextRound={handleNextRound}
                />
              )}

              {room && room.status === 'game_over' && (
                <Leaderboard
                  room={room}
                  currentUserId={currentUser.id}
                  authUid={authUser?.uid || null}
                  onRestartGame={handleRestartGame}
                  onReturnToLobby={handleLeaveRoom}
                  onOpenLeaderboard={() => setActiveTab('leaderboard')}
                />
              )}
            </>
          )}

          {/* TAB 2: BİREYSEL PRATİK */}
          {activeTab === 'solo' && (
            <SoloPractice
              tekerlemeler={tekerlemeler}
              initialTekerlemeId={selectedPracticeTekerlemeId}
            />
          )}

          {/* TAB 3: TEKERLEME HAVUZU & YÖNETİM */}
          {activeTab === 'library' && (
            <TekerlemeLibrary
              tekerlemeler={tekerlemeler}
              myContributions={myContributions}
              adminContributions={adminContributions}
              notifications={unreadNotifications}
              isSignedIn={Boolean(authUser)}
              currentUid={authUser?.uid || null}
              isAdmin={isAdmin}
              onOpenAuth={() => setIsAuthModalOpen(true)}
              onSelectForPractice={(selected) => {
                setSelectedPracticeTekerlemeId(selected.id);
                setActiveTab('solo');
              }}
              onOpenAddModal={() => {
                if (!authUser) {
                  setIsAuthModalOpen(true);
                  return;
                }
                if (profileLoaded && !userProfile) {
                  setIsAuthModalOpen(true);
                  return;
                }
                setEditingTekerleme(null);
                setIsAddModalOpen(true);
              }}
              onEditTekerleme={(item) => {
                setEditingTekerleme(item);
                setIsAddModalOpen(true);
              }}
              onDeleteTekerleme={handleDeleteTekerleme}
              onApproveContribution={approveTekerlemeContribution}
              onDismissNotification={handleDismissNotification}
              onResetDefaults={handleResetDefaultTekerlemeler}
              onSyncSeedToFirestore={handleSyncSeedToFirestore}
            />
          )}

          {/* TAB 4: ARKADAŞLAR & ODA DAVETLERİ */}
          {activeTab === 'friends' && (
            <FriendsPanel
              authUser={authUser}
              userProfile={userProfile}
              friendships={friendships}
              incomingInvites={roomInvites}
              activeRoom={room}
              onOpenAuth={() => setIsAuthModalOpen(true)}
              onCreateRoomAndInvite={handleCreateRoomAndInviteFriend}
              onInviteFriendToActiveRoom={handleInviteFriendToActiveRoom}
              onAcceptRoomInvite={handleAcceptRoomInvite}
              onDismissRoomInvite={handleDismissRoomInvite}
            />
          )}

          {/* TAB 5: DİLBAZ LİDERLİK PANOSU & YÖNETİCİ ÜYE TABLOSU */}
          {activeTab === 'leaderboard' && (
            <GlobalLeaderboard
              currentUid={authUser?.uid || null}
              currentUserProfile={userProfile}
              isAdmin={isAdmin}
              onOpenAuth={() => setIsAuthModalOpen(true)}
            />
          )}

          {isMobileView && (
            <div className="w-28 h-1 bg-[#3A86FF]/40 rounded-full mx-auto mt-auto pt-4 shrink-0" />
          )}
        </div>
      </main>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0d1629]/95 backdrop-blur-md border-t border-white/10 grid grid-cols-5 items-center h-14 px-1">
        <button
          onClick={() => {
            playTone('tap');
            setActiveTab('room');
          }}
          className={`flex flex-col items-center justify-center h-full transition-colors cursor-pointer ${
            activeTab === 'room' ? 'text-[#FFBE0B] font-bold' : 'text-[#94A3B8]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span className="text-[10px] mt-0.5 font-display whitespace-nowrap">Odalar</span>
        </button>

        <button
          onClick={() => {
            playTone('tap');
            setActiveTab('solo');
          }}
          className={`flex flex-col items-center justify-center h-full transition-colors cursor-pointer ${
            activeTab === 'solo' ? 'text-[#FF006E] font-bold' : 'text-[#94A3B8]'
          }`}
        >
          <Mic className="w-4 h-4" />
          <span className="text-[10px] mt-0.5 font-display whitespace-nowrap">Pratik</span>
        </button>

        <button
          onClick={() => {
            playTone('tap');
            setActiveTab('library');
          }}
          className={`flex flex-col items-center justify-center h-full transition-colors cursor-pointer ${
            activeTab === 'library' ? 'text-[#00F5D4] font-bold' : 'text-[#94A3B8]'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span className="text-[10px] mt-0.5 font-display whitespace-nowrap">Havuz</span>
        </button>

        <button
          onClick={() => {
            playTone('tap');
            setActiveTab('friends');
          }}
          className={`relative flex flex-col items-center justify-center h-full transition-colors cursor-pointer ${
            activeTab === 'friends' ? 'text-[#EC4899] font-bold' : 'text-[#94A3B8]'
          }`}
        >
          <div className="relative">
            <UserPlus className="w-4 h-4" />
            {pendingFriendsBadgeCount > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1 min-w-[14px] h-[14px] rounded-full bg-[#FF006E] text-white text-[9px] font-bold flex items-center justify-center">
                {pendingFriendsBadgeCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 font-display whitespace-nowrap">Arkadaş</span>
        </button>

        <button
          onClick={() => {
            playTone('tap');
            setActiveTab('leaderboard');
          }}
          className={`flex flex-col items-center justify-center h-full transition-colors cursor-pointer ${
            activeTab === 'leaderboard' ? 'text-[#FFBE0B] font-bold' : 'text-[#94A3B8]'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span className="text-[10px] mt-0.5 font-display whitespace-nowrap">Liderlik</span>
        </button>
      </div>

      {/* Guide & Architecture Modal */}
      <GuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      {/* Auth / Profile Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        authUser={authUser}
        userProfile={userProfile}
        isAdmin={isAdmin}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Add / Edit Tekerleme Modal */}
      <AddTekerlemeModal
        isOpen={isAddModalOpen}
        editingTekerleme={editingTekerleme}
        isContributionMode={Boolean(authUser) && !editingTekerleme}
        isAdmin={isAdmin}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingTekerleme(null);
        }}
        onSave={handleSaveTekerleme}
      />
    </div>
  );
}
