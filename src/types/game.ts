export type Difficulty = 'kolay' | 'orta' | 'zor' | 'efsane';

export type PhonemeCategory =
  | 'tum'
  | 's-s'
  | 'c-c'
  | 'p-b'
  | 'r-l'
  | 'k-g'
  | 'm-n'
  | 'vurgu';

export type ContributionStatus = 'pending' | 'approved' | 'rejected';

export type UserRole = 'uye' | 'yonetici';

export interface Tekerleme {
  id: string;
  text: string;
  title: string;
  difficulty: Difficulty;
  category: PhonemeCategory;
  categoryLabel: string;
  targetSounds: string[];
  benchmarkSeconds: number;
  tip: string;
  addedByUser?: boolean;
  authorId?: string;
  authorUsername?: string;
  status?: ContributionStatus;
  rewardClaimed?: boolean;
  adminNote?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface UserProfile {
  uid: string;
  username: string;
  avatar: string;
  role?: UserRole;
  points: number;
  approvedTekerlemeCount: number;
  multiplayerWins: number;
  lastClaimId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface UserNotification {
  id: string;
  recipientUid: string;
  type: 'tekerleme_approved' | 'tekerleme_deleted' | 'tekerleme_rejected' | 'role_updated';
  title: string;
  message: string;
  tekerlemeTitle?: string;
  pointsAwarded?: number;
  read: boolean;
  createdAt: number;
}

export interface PlayerScore {
  playerId: string;
  playerName: string;
  avatar: string;
  isHost: boolean;
  isCurrentUser: boolean;
  accuracy: number; // 0 - 100
  durationSeconds: number;
  wpm: number;
  speedScore: number; // 0 - 100
  totalScore: number;
  wordBreakdown?: {
    word: string;
    status: 'correct' | 'imperfect' | 'missed';
    recognizedAs?: string;
  }[];
  rank?: number;
  badge?: string;
}

export type RoomStatus = 'waiting' | 'countdown' | 'in_round' | 'round_result' | 'game_over' | 'closed';

export type RoomProgressionMode = 'host' | 'auto';

export type RoomJoinMethod = 'pin' | 'invite' | 'active_list';

export interface RoomSettings {
  roundCount: number;
  timeLimitSeconds: number;
  difficulty: 'karisik' | Difficulty;
  category: PhonemeCategory;
  progressionMode?: RoomProgressionMode;
}

export interface Room {
  code: string;
  title: string;
  hostId: string;
  originalHostId?: string;
  hostName: string;
  hostLeftAutoMode?: boolean;
  status: RoomStatus;
  currentRound: number;
  totalRounds: number;
  settings: RoomSettings;
  currentTekerleme?: Tekerleme;
  winnerId?: string;
  participantIds?: string[];
  invitedUids?: string[];
  updatedAt?: number;
  players: {
    id: string;
    name: string;
    avatar: string;
    isHost: boolean;
    isReady: boolean;
    totalPoints: number;
    currentRoundScore?: PlayerScore;
  }[];
  roundScores?: Record<number, PlayerScore[]>;
}

export interface EmailDirectoryEntry {
  uid: string;
  username: string;
  avatar: string;
  updatedAt: number;
}

export type FriendshipStatus = 'pending' | 'accepted';

export interface Friendship {
  id: string;
  users: [string, string];
  requesterUid: string;
  requesterName: string;
  requesterAvatar: string;
  recipientUid: string;
  recipientName: string;
  recipientAvatar: string;
  status: FriendshipStatus;
  createdAt: number;
  updatedAt: number;
}

export type RoomInviteStatus = 'pending' | 'accepted' | 'dismissed';

export interface RoomInvite {
  id: string;
  roomCode: string;
  roomTitle: string;
  senderUid: string;
  senderName: string;
  senderAvatar: string;
  recipientUid: string;
  status: RoomInviteStatus;
  createdAt: number;
  updatedAt: number;
}

