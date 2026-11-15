import React, { useMemo, useState } from 'react';
import { PlayerScore, Room } from '../types/game';
import { KilimAvatar } from './KilimAvatar';
import { BarChart3, Gauge, Target, Timer, Crown } from 'lucide-react';
import { playTone } from '../utils/soundEffects';

interface ComprehensiveStatsPanelProps {
  room: Room;
  currentUserId: string;
}

type MetricFocus = 'all' | 'wpm' | 'accuracy' | 'duration';

interface PlayerComputedStats {
  playerId: string;
  playerName: string;
  avatar: string;
  totalPoints: number;
  isWinner: boolean;
  isCurrentUser: boolean;
  roundsPlayed: number;
  avgWpm: number;
  bestWpm: number;
  avgAccuracy: number;
  avgDuration: number;
  fastestDuration: number;
  perRound: Record<number, PlayerScore>;
}

function roundOneDecimal(val: number): number {
  return Math.round(val * 10) / 10;
}

export const ComprehensiveStatsPanel: React.FC<ComprehensiveStatsPanelProps> = ({
  room,
  currentUserId
}) => {
  const [metricFocus, setMetricFocus] = useState<MetricFocus>('all');
  const [selectedRound, setSelectedRound] = useState<'all' | number>('all');
  const [hoveredPlayerId, setHoveredPlayerId] = useState<string | null>(null);

  const availableRounds = useMemo(() => {
    const keys = Object.keys(room.roundScores || {})
      .map((k) => Number(k))
      .filter((n) => !Number.isNaN(n) && (room.roundScores?.[n]?.length || 0) > 0)
      .sort((a, b) => a - b);
    return keys;
  }, [room.roundScores]);

  const playerStats = useMemo<PlayerComputedStats[]>(() => {
    const sortedPlayers = [...(room.players || [])].sort(
      (a, b) => (b.totalPoints || 0) - (a.totalPoints || 0)
    );
    const winnerId = room.winnerId || sortedPlayers[0]?.id || '';

    // Collect scores per player across all recorded rounds
    const scoresByPlayer = new Map<string, { round: number; score: PlayerScore }[]>();

    for (const roundNum of availableRounds) {
      const list = room.roundScores?.[roundNum] || [];
      for (const s of list) {
        if (!scoresByPlayer.has(s.playerId)) {
          scoresByPlayer.set(s.playerId, []);
        }
        scoresByPlayer.get(s.playerId)!.push({ round: roundNum, score: s });
      }
    }

    // Fallback to player.currentRoundScore if roundScores was empty for a player
    for (const p of sortedPlayers) {
      if (!scoresByPlayer.has(p.id) && p.currentRoundScore) {
        scoresByPlayer.set(p.id, [{ round: room.currentRound || 1, score: p.currentRoundScore }]);
      }
    }

    return sortedPlayers.map((player) => {
      const entries = scoresByPlayer.get(player.id) || [];
      const perRound: Record<number, PlayerScore> = {};
      for (const entry of entries) {
        perRound[entry.round] = entry.score;
      }

      const activeEntries =
        selectedRound === 'all'
          ? entries.map((e) => e.score)
          : perRound[selectedRound]
          ? [perRound[selectedRound]]
          : [];

      const count = activeEntries.length;
      const sumWpm = activeEntries.reduce((acc, s) => acc + (Number(s.wpm) || 0), 0);
      const sumAcc = activeEntries.reduce((acc, s) => acc + (Number(s.accuracy) || 0), 0);
      const sumDur = activeEntries.reduce((acc, s) => acc + (Number(s.durationSeconds) || 0), 0);

      const bestWpm =
        count > 0 ? Math.max(...activeEntries.map((s) => Number(s.wpm) || 0)) : 0;
      const positiveDurs = activeEntries
        .map((s) => Number(s.durationSeconds) || 0)
        .filter((d) => d > 0);
      const fastestDuration =
        positiveDurs.length > 0 ? roundOneDecimal(Math.min(...positiveDurs)) : 0;

      return {
        playerId: player.id,
        playerName: player.name,
        avatar: player.avatar,
        totalPoints: Number(player.totalPoints) || 0,
        isWinner: player.id === winnerId,
        isCurrentUser: player.id === currentUserId,
        roundsPlayed: count,
        avgWpm: count > 0 ? Math.round(sumWpm / count) : 0,
        bestWpm: Math.round(bestWpm),
        avgAccuracy: count > 0 ? Math.round(sumAcc / count) : 0,
        avgDuration: count > 0 ? roundOneDecimal(sumDur / count) : 0,
        fastestDuration,
        perRound
      };
    });
  }, [room.players, room.winnerId, room.currentRound, availableRounds, room.roundScores, selectedRound, currentUserId]);

  const hasAnyMetrics = playerStats.some((p) => p.roundsPlayed > 0);

  const winnerStats = playerStats.find((p) => p.isWinner) || playerStats[0];

  const leaders = useMemo(() => {
    const active = playerStats.filter((p) => p.roundsPlayed > 0);
    if (active.length === 0) return null;

    const fastestWpm = [...active].sort((a, b) => b.avgWpm - a.avgWpm)[0];
    const highestAccuracy = [...active].sort((a, b) => b.avgAccuracy - a.avgAccuracy)[0];
    const quickestReaction = [...active]
      .filter((p) => p.avgDuration > 0)
      .sort((a, b) => a.avgDuration - b.avgDuration)[0];

    const avgAllWpm = Math.round(active.reduce((s, p) => s + p.avgWpm, 0) / active.length);
    const avgAllAcc = Math.round(active.reduce((s, p) => s + p.avgAccuracy, 0) / active.length);
    const avgAllDur = roundOneDecimal(
      active.reduce((s, p) => s + p.avgDuration, 0) / active.length
    );

    return {
      fastestWpm,
      highestAccuracy,
      quickestReaction,
      avgAllWpm,
      avgAllAcc,
      avgAllDur
    };
  }, [playerStats]);

  const maxWpm = Math.max(60, ...playerStats.map((p) => p.avgWpm));
  const maxDuration = Math.max(
    room.settings?.timeLimitSeconds || 10,
    ...playerStats.map((p) => p.avgDuration)
  );

  const inspectedPlayer =
    playerStats.find((p) => p.playerId === hoveredPlayerId) || winnerStats || null;

  return (
    <section
      aria-label="Kapsamlı İstatistik Paneli"
      className="ebru-glass-card rounded-[24px] p-5 sm:p-6 space-y-5"
    >
      {/* Header + Scope Metadata */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="space-y-1">
          <h2 className="font-display text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#00F5D4] shrink-0" />
            <span>Kapsamlı İstatistik Paneli</span>
          </h2>
          <p className="text-xs text-[#94A3B8]">
            {selectedRound === 'all'
              ? `${room.totalRounds} turluk turnuva ortalamaları`
              : `${selectedRound}. tur performans verileri`}
            {' · '}
            {playerStats.length} oyuncu karşılaştırması
          </p>
        </div>

        {/* Round Selector (only when multiple rounds exist) */}
        {availableRounds.length > 1 && (
          <div
            role="group"
            aria-label="Tur filtresi"
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#0d1629]/80 border border-white/10 self-start sm:self-auto overflow-x-auto max-w-full"
          >
            <button
              type="button"
              onClick={() => {
                playTone('tap');
                setSelectedRound('all');
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedRound === 'all'
                  ? 'bg-[#3A86FF] text-white'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              Tüm Turlar
            </button>
            {availableRounds.map((rNum) => (
              <button
                key={rNum}
                type="button"
                onClick={() => {
                  playTone('tap');
                  setSelectedRound(rNum);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold tabular-nums transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedRound === rNum
                    ? 'bg-[#3A86FF] text-white'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                Tur {rNum}
              </button>
            ))}
          </div>
        )}
      </div>

      {!hasAnyMetrics ? (
        <div className="py-8 text-center text-xs text-[#94A3B8]">
          Bu oda için henüz karşılaştırılacak hız, doğruluk ve tepki süresi verisi kaydedilmedi.
        </div>
      ) : (
        <>
          {/* Winner Performance Highlight + Category Leaders Strip */}
          {winnerStats && leaders && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-white/10">
              {/* Champion Summary */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#FFBE0B] flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 shrink-0" />
                  <span>Kazananın Performans Özeti</span>
                </div>
                <div className="flex items-center gap-3">
                  <KilimAvatar avatar={winnerStats.avatar} size={42} />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">
                      {winnerStats.playerName}
                      {winnerStats.isCurrentUser ? ' (Sen)' : ''}
                    </div>
                    <div className="text-xs text-[#CBD5E1] tabular-nums">
                      {winnerStats.avgWpm} Kelime/Dk · %{winnerStats.avgAccuracy} Doğruluk ·{' '}
                      {winnerStats.avgDuration} sn Tepki
                    </div>
                  </div>
                </div>
              </div>

              {/* Three Category Leaders */}
              <div className="grid grid-cols-3 gap-3 text-left">
                <div className="space-y-0.5">
                  <div className="text-[11px] text-[#93C5FD] flex items-center gap-1">
                    <Gauge className="w-3 h-3 shrink-0" />
                    <span className="truncate">En Hızlı</span>
                  </div>
                  <div className="text-sm font-bold font-mono text-white tabular-nums">
                    {leaders.fastestWpm.avgWpm} WPM
                  </div>
                  <div className="text-[11px] text-[#94A3B8] truncate">
                    {leaders.fastestWpm.playerName}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <div className="text-[11px] text-[#06D6A0] flex items-center gap-1">
                    <Target className="w-3 h-3 shrink-0" />
                    <span className="truncate">En Doğru</span>
                  </div>
                  <div className="text-sm font-bold font-mono text-white tabular-nums">
                    %{leaders.highestAccuracy.avgAccuracy}
                  </div>
                  <div className="text-[11px] text-[#94A3B8] truncate">
                    {leaders.highestAccuracy.playerName}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <div className="text-[11px] text-[#FFBE0B] flex items-center gap-1">
                    <Timer className="w-3 h-3 shrink-0" />
                    <span className="truncate">En Çabuk</span>
                  </div>
                  <div className="text-sm font-bold font-mono text-white tabular-nums">
                    {leaders.quickestReaction ? `${leaders.quickestReaction.avgDuration} sn` : '—'}
                  </div>
                  <div className="text-[11px] text-[#94A3B8] truncate">
                    {leaders.quickestReaction ? leaders.quickestReaction.playerName : '—'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Metric Segmented Controls & Legend */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div
              role="group"
              aria-label="Karşılaştırılacak metrik"
              className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#0d1629]/85 border border-white/10"
            >
              <button
                type="button"
                onClick={() => {
                  playTone('tap');
                  setMetricFocus('all');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  metricFocus === 'all'
                    ? 'bg-[#00F5D4] text-[#0d1629]'
                    : 'text-[#CBD5E1] hover:text-white'
                }`}
              >
                Tümü (Karşılaştırma)
              </button>
              <button
                type="button"
                onClick={() => {
                  playTone('tap');
                  setMetricFocus('wpm');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  metricFocus === 'wpm'
                    ? 'bg-[#3A86FF] text-white'
                    : 'text-[#CBD5E1] hover:text-white'
                }`}
              >
                Hız (WPM)
              </button>
              <button
                type="button"
                onClick={() => {
                  playTone('tap');
                  setMetricFocus('accuracy');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  metricFocus === 'accuracy'
                    ? 'bg-[#06D6A0] text-[#0d1629]'
                    : 'text-[#CBD5E1] hover:text-white'
                }`}
              >
                Doğruluk (%)
              </button>
              <button
                type="button"
                onClick={() => {
                  playTone('tap');
                  setMetricFocus('duration');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  metricFocus === 'duration'
                    ? 'bg-[#FFBE0B] text-[#0d1629]'
                    : 'text-[#CBD5E1] hover:text-white'
                }`}
              >
                Tepki Süresi (sn)
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#CBD5E1]">
              {(metricFocus === 'all' || metricFocus === 'wpm') && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#3A86FF]" aria-hidden="true" />
                  <span>Hız (WPM)</span>
                </span>
              )}
              {(metricFocus === 'all' || metricFocus === 'accuracy') && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#06D6A0]" aria-hidden="true" />
                  <span>Doğruluk (%)</span>
                </span>
              )}
              {(metricFocus === 'all' || metricFocus === 'duration') && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#FFBE0B]" aria-hidden="true" />
                  <span>Tepki Süresi (sn)</span>
                </span>
              )}
            </div>
          </div>

          {/* Interactive Bar Chart Area */}
          {metricFocus === 'all' ? (
            <div className="space-y-4">
              {playerStats.map((player, idx) => {
                const wpmPct = Math.max(4, Math.min(100, Math.round((player.avgWpm / maxWpm) * 100)));
                const accPct = Math.max(4, Math.min(100, player.avgAccuracy));
                const durPct =
                  player.avgDuration > 0
                    ? Math.max(4, Math.min(100, Math.round((player.avgDuration / maxDuration) * 100)))
                    : 0;
                const isInspected = inspectedPlayer?.playerId === player.playerId;

                return (
                  <div
                    key={player.playerId}
                    onMouseEnter={() => setHoveredPlayerId(player.playerId)}
                    onFocus={() => setHoveredPlayerId(player.playerId)}
                    onClick={() => setHoveredPlayerId(player.playerId)}
                    tabIndex={0}
                    className={`py-2.5 px-3 rounded-xl transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#00F5D4] ${
                      isInspected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-xs text-[#94A3B8] tabular-nums w-5">
                          #{idx + 1}
                        </span>
                        <KilimAvatar avatar={player.avatar} size={26} />
                        <span className="text-xs sm:text-sm font-bold text-white truncate">
                          {player.playerName}
                        </span>
                        {player.isWinner && (
                          <span className="text-[11px] font-semibold text-[#FFBE0B] whitespace-nowrap">
                            · Kazanan
                          </span>
                        )}
                        {player.isCurrentUser && (
                          <span className="text-[11px] font-mono text-[#00F5D4] whitespace-nowrap">
                            · Sen
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono font-bold text-[#FFBE0B] tabular-nums whitespace-nowrap">
                        {player.totalPoints} puan
                      </span>
                    </div>

                    {/* Grouped 3 Horizontal Comparison Bars per Player */}
                    <div className="space-y-1.5 pl-7">
                      {/* WPM Bar */}
                      <div className="flex items-center gap-2.5">
                        <span className="w-16 text-[11px] text-[#93C5FD] shrink-0">Hız</span>
                        <div className="flex-1 h-2.5 rounded-full bg-[#0d1629] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#3A86FF] to-[#00F5D4] transition-all duration-300"
                            style={{ width: `${player.roundsPlayed > 0 ? wpmPct : 0}%` }}
                          />
                        </div>
                        <span className="w-20 text-right font-mono text-xs font-semibold text-white tabular-nums shrink-0">
                          {player.roundsPlayed > 0 ? `${player.avgWpm} WPM` : '—'}
                        </span>
                      </div>

                      {/* Accuracy Bar */}
                      <div className="flex items-center gap-2.5">
                        <span className="w-16 text-[11px] text-[#6EE7B7] shrink-0">Doğruluk</span>
                        <div className="flex-1 h-2.5 rounded-full bg-[#0d1629] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#06D6A0] to-[#00F5D4] transition-all duration-300"
                            style={{ width: `${player.roundsPlayed > 0 ? accPct : 0}%` }}
                          />
                        </div>
                        <span className="w-20 text-right font-mono text-xs font-semibold text-[#06D6A0] tabular-nums shrink-0">
                          {player.roundsPlayed > 0 ? `%${player.avgAccuracy}` : '—'}
                        </span>
                      </div>

                      {/* Duration / Reaction Bar */}
                      <div className="flex items-center gap-2.5">
                        <span className="w-16 text-[11px] text-[#FDE68A] shrink-0">Tepki</span>
                        <div className="flex-1 h-2.5 rounded-full bg-[#0d1629] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#FFBE0B] to-[#FF5400] transition-all duration-300"
                            style={{ width: `${durPct}%` }}
                          />
                        </div>
                        <span className="w-20 text-right font-mono text-xs font-semibold text-[#FFBE0B] tabular-nums shrink-0">
                          {player.avgDuration > 0 ? `${player.avgDuration} sn` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Single-Metric Vertical SVG Column Bar Chart with Average Reference Line */
            <div className="space-y-3">
              {leaders && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#94A3B8]">
                  <span>
                    {metricFocus === 'wpm' && 'Okuma ve konuşma hızı karşılaştırması (kelime/dakika)'}
                    {metricFocus === 'accuracy' && 'Telaffuz ve kelime doğruluğu karşılaştırması (%)'}
                    {metricFocus === 'duration' &&
                      'Tepki ve tamamlama süresi karşılaştırması (kısa süre daha hızlı tepki)'}
                  </span>
                  <span className="font-mono text-[#CBD5E1] tabular-nums">
                    Oda Ortalaması:{' '}
                    <strong className="text-white">
                      {metricFocus === 'wpm'
                        ? `${leaders.avgAllWpm} WPM`
                        : metricFocus === 'accuracy'
                        ? `%${leaders.avgAllAcc}`
                        : `${leaders.avgAllDur} sn`}
                    </strong>
                  </span>
                </div>
              )}

              <div className="w-full overflow-x-auto pb-1">
                <div
                  className="min-w-[320px] grid gap-3 items-end pt-6 pb-2 px-2 bg-[#0d1629]/75 rounded-2xl border border-white/10"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(1, playerStats.length)}, minmax(68px, 1fr))`
                  }}
                >
                  {playerStats.map((player) => {
                    const value =
                      metricFocus === 'wpm'
                        ? player.avgWpm
                        : metricFocus === 'accuracy'
                        ? player.avgAccuracy
                        : player.avgDuration;

                    const scaleMax =
                      metricFocus === 'wpm'
                        ? maxWpm
                        : metricFocus === 'accuracy'
                        ? 100
                        : maxDuration;

                    const barHeightPct =
                      player.roundsPlayed > 0 && scaleMax > 0
                        ? Math.max(8, Math.min(100, Math.round((value / scaleMax) * 100)))
                        : 0;

                    const barGradient =
                      metricFocus === 'wpm'
                        ? 'from-[#3A86FF] to-[#00F5D4]'
                        : metricFocus === 'accuracy'
                        ? 'from-[#06D6A0] to-[#00F5D4]'
                        : 'from-[#FF5400] to-[#FFBE0B]';

                    const formattedValue =
                      player.roundsPlayed === 0
                        ? '—'
                        : metricFocus === 'wpm'
                        ? `${value}`
                        : metricFocus === 'accuracy'
                        ? `%${value}`
                        : `${value}s`;

                    return (
                      <button
                        key={player.playerId}
                        type="button"
                        onMouseEnter={() => setHoveredPlayerId(player.playerId)}
                        onClick={() => setHoveredPlayerId(player.playerId)}
                        className="flex flex-col items-center gap-2 group cursor-pointer focus:outline-none"
                      >
                        <div className="w-full h-36 flex flex-col items-center justify-end px-2">
                          <span className="font-mono text-xs font-bold text-white tabular-nums mb-1.5">
                            {formattedValue}
                          </span>
                          <div
                            className={`w-full max-w-[44px] rounded-t-xl bg-gradient-to-t ${barGradient} transition-all duration-300 group-hover:brightness-110 ${
                              player.isWinner ? 'ring-2 ring-[#FFBE0B]/75' : ''
                            }`}
                            style={{ height: `${barHeightPct}%` }}
                          />
                        </div>
                        <div className="flex flex-col items-center gap-1 w-full min-w-0 pt-1 border-t border-white/10">
                          <KilimAvatar avatar={player.avatar} size={24} />
                          <span className="text-[11px] font-semibold text-[#E2E8F0] truncate max-w-full">
                            {player.playerName}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Inspected Player Quick Breakdown */}
          {inspectedPlayer && inspectedPlayer.roundsPlayed > 0 && (
            <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-[#CBD5E1]">
              <div className="flex items-center gap-2 min-w-0">
                <KilimAvatar avatar={inspectedPlayer.avatar} size={22} />
                <span className="font-bold text-white truncate">{inspectedPlayer.playerName}</span>
                <span className="text-[#94A3B8]">·</span>
                <span className="tabular-nums">
                  En Yüksek Hız: <strong className="text-[#00F5D4] font-mono">{inspectedPlayer.bestWpm} WPM</strong>
                </span>
              </div>
              <div className="tabular-nums">
                En Hızlı Tur:{' '}
                <strong className="text-[#FFBE0B] font-mono">
                  {inspectedPlayer.fastestDuration > 0 ? `${inspectedPlayer.fastestDuration} sn` : '—'}
                </strong>
                {' · '}
                Katılım: <strong className="text-white font-mono">{inspectedPlayer.roundsPlayed} tur</strong>
              </div>
            </div>
          )}

          {/* Compact Tabular Comparison Matrix */}
          <div className="overflow-x-auto pt-2 border-t border-white/10">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="text-[#94A3B8] border-b border-white/10">
                  <th className="py-2 pr-3 font-semibold">Oyuncu</th>
                  <th className="py-2 px-2 text-right font-semibold">Hız (WPM)</th>
                  <th className="py-2 px-2 text-right font-semibold">Doğruluk</th>
                  <th className="py-2 px-2 text-right font-semibold">Tepki Süresi</th>
                  <th className="py-2 pl-2 text-right font-semibold">Toplam Puan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {playerStats.map((player) => (
                  <tr
                    key={player.playerId}
                    className={`transition-colors ${
                      player.isCurrentUser ? 'bg-[#3A86FF]/10 text-white' : 'text-[#CBD5E1]'
                    }`}
                  >
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <KilimAvatar avatar={player.avatar} size={22} />
                        <span className="font-semibold text-white truncate max-w-[130px]">
                          {player.playerName}
                        </span>
                        {player.isWinner && (
                          <Crown className="w-3.5 h-3.5 text-[#FFBE0B] shrink-0" aria-label="Kazanan" />
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[#93C5FD]">
                      {player.roundsPlayed > 0 ? `${player.avgWpm}` : '—'}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[#06D6A0]">
                      {player.roundsPlayed > 0 ? `%${player.avgAccuracy}` : '—'}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[#FFBE0B]">
                      {player.avgDuration > 0 ? `${player.avgDuration} sn` : '—'}
                    </td>
                    <td className="py-2.5 pl-2 text-right font-mono font-bold tabular-nums text-white">
                      {player.totalPoints} p
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};
