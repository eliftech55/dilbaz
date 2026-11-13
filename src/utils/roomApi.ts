import { Room, PlayerScore, Difficulty, PhonemeCategory } from '../types/game';

export class RoomApi {
  private static eventSource: EventSource | null = null;

  public static async createRoom(params: {
    hostId: string;
    hostName: string;
    avatar: string;
    roundCount: number;
    difficulty: 'karisik' | Difficulty;
    category: PhonemeCategory;
  }): Promise<Room> {
    const res = await fetch('/api/rooms/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Oda oluşturulamadı');
    }
    const data = await res.json();
    return data.room;
  }

  public static async joinRoom(code: string, params: {
    playerId: string;
    playerName: string;
    avatar: string;
  }): Promise<Room> {
    const res = await fetch(`/api/rooms/${code.toUpperCase()}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Odaya katılım başarısız');
    }
    const data = await res.json();
    return data.room;
  }

  public static async getRoom(code: string): Promise<Room> {
    const res = await fetch(`/api/rooms/${code.toUpperCase()}`);
    if (!res.ok) {
      throw new Error('Oda bulunamadı');
    }
    const data = await res.json();
    return data.room;
  }

  public static async toggleReady(code: string, playerId: string): Promise<void> {
    await fetch(`/api/rooms/${code.toUpperCase()}/ready`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId })
    });
  }

  public static async startGame(code: string, hostId: string): Promise<void> {
    const res = await fetch(`/api/rooms/${code.toUpperCase()}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostId })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Oyun başlatılamadı');
    }
  }

  public static async submitScore(code: string, score: PlayerScore): Promise<void> {
    await fetch(`/api/rooms/${code.toUpperCase()}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score })
    });
  }

  public static async nextRound(code: string, hostId: string): Promise<void> {
    await fetch(`/api/rooms/${code.toUpperCase()}/next`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostId })
    });
  }

  public static async restartGame(code: string, hostId: string): Promise<void> {
    await fetch(`/api/rooms/${code.toUpperCase()}/restart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostId })
    });
  }

  public static async addTestBot(code: string): Promise<void> {
    await fetch(`/api/rooms/${code.toUpperCase()}/add-bot`, {
      method: 'POST'
    });
  }

  public static async leaveRoom(code: string, playerId: string): Promise<void> {
    await fetch(`/api/rooms/${code.toUpperCase()}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId })
    });
    this.closeStream();
  }

  // Realtime SSE subscription
  public static subscribeToRoom(code: string, onUpdate: (room: Room) => void, onError?: (err: any) => void): () => void {
    this.closeStream();

    const streamUrl = `/api/rooms/${code.toUpperCase()}/stream`;
    const es = new EventSource(streamUrl);
    this.eventSource = es;

    es.onmessage = (event) => {
      try {
        const roomData: Room = JSON.parse(event.data);
        onUpdate(roomData);
      } catch (e) {
        console.error('Failed to parse room SSE event', e);
      }
    };

    es.onerror = (err) => {
      onError?.(err);
    };

    return () => {
      if (this.eventSource === es) {
        this.closeStream();
      }
    };
  }

  public static closeStream() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
