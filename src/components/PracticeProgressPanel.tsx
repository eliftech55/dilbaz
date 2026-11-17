import React, { useMemo, useState } from 'react';
import { Difficulty, PracticeAttempt } from '../types/game';
import {
  TrendingUp,
  History,
  RotateCcw,
  Trash2,
  Award,
  Gauge,
  Target,
  Clock,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { playTone } from '../utils/soundEffects';

interface PracticeProgressPanelProps {
  attempts: PracticeAttempt[];
  onReplayTekerleme: (tekerlemeId: string, difficulty: Difficulty) => void;
  onDeleteAttempt: (attemptId: string) => void;
  onClearHistory: () => void;
}

type TrendMetric = 'accuracy' | 'wpm' | 'totalScore';
type HistoryDifficultyFilter = 'all' | Difficulty;

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  kolay: 'Kolay',
  orta: 'Orta',
  zor: 'Zor',
  efsane: 'Efsane'
};

const DIFFICULTY_TEXT_COLORS: Record<Difficulty, string> = {
  kolay: 'text-[#06D6A0]',
  orta: 'text-[#3A86FF]',
  zor: 'text-[#FFBE0B]',
  efsane: 'text-[#FF006E]'
};

const DIFFICULTY_BAR_GRADIENTS: Record<Difficulty, string> = {
  kolay: 'from-[#06D6A0] to-[#00F5D4]',
  orta: 'from-[#3A86FF] to-[#00F5D4]',
  zor: 'from-[#FFBE0B] to-[#FF5400]',
  efsane: 'from-[#FF006E] to-[#FFBE0B]'
};

function formatTurkishTimestamp(ts: number): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(ts));
  } catch {
    return '';
  }
}

function formatTotalDuration(totalSeconds: number): string {
  const rounded = Math.max(0, Math.round(totalSeconds));
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  if (mins === 0) return `${secs} sn`;
  return `${mins} dk ${secs} sn`;
}

export const PracticeProgressPanel: React.FC<PracticeProgressPanelProps> = ({
  attempts,
  onReplayTekerleme,
  onDeleteAttempt,
  onClearHistory
}) => {
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('accuracy');
  const [historyFilter, setHistoryFilter] = useState<HistoryDifficultyFilter>('all');
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const summary = useMemo(() => {
    const count = attempts.length;
    if (count === 0) {
      return {
        count: 0,
        avgAccuracy: 0,
        bestAccuracy: 0,
        avgWpm: 0,
        bestWpm: 0,
        bestScore: 0,
        totalDuration: 0,
        accuracyDelta: 0,
        wpmDelta: 0
      };
    }

    const sumAcc = attempts.reduce((s, a) => s + a.accuracy, 0);
    const sumWpm = attempts.reduce((s, a) => s + a.wpm, 0);
    const totalDuration = attempts.reduce((s, a) => s + a.durationSeconds, 0);
    const bestAccuracy = Math.max(...attempts.map((a) => a.accuracy));
    const bestWpm = Math.max(...attempts.map((a) => a.wpm));
    const bestScore = Math.max(...attempts.map((a) => a.totalScore));

    // Compare newest half vs older half (only meaningful when >= 4 attempts)
    let accuracyDelta = 0;
    let wpmDelta = 0;
    if (count >= 4) {
      const split = Math.min(5, Math.floor(count / 2));
      const recent = attempts.slice(0, split);
      const earlier = attempts.slice(split, split * 2);
      if (earlier.length > 0) {
        const recentAcc = recent.reduce((s, a) => s + a.accuracy, 0) / recent.length;
        const earlierAcc = earlier.reduce((s, a) => s + a.accuracy, 0) / earlier.length;
        const recentWpm = recent.reduce((s, a) => s + a.wpm, 0) / recent.length;
        const earlierWpm = earlier.reduce((s, a) => s + a.wpm, 0) / earlier.length;
        accuracyDelta = Math.round(recentAcc - earlierAcc);
        wpmDelta = Math.round(recentWpm - earlierWpm);
      }
    }

    return {
      count,
      avgAccuracy: Math.round(sumAcc / count),
      bestAccuracy,
      avgWpm: Math.round(sumWpm / count),
      bestWpm,
      bestScore,
      totalDuration,
      accuracyDelta,
      wpmDelta
    };
  }, [attempts]);

  const difficultyBreakdown = useMemo(() => {
    const tiers: Difficulty[] = ['kolay', 'orta', 'zor', 'efsane'];
    return tiers.map((tier) => {
      const list = attempts.filter((a) => a.difficulty === tier);
      const count = list.length;
      const avgAcc = count > 0 ? Math.round(list.reduce((s, a) => s + a.accuracy, 0) / count) : 0;
      const bestWpm = count > 0 ? Math.max(...list.map((a) => a.wpm)) : 0;
      return {
        tier,
        label: DIFFICULTY_LABELS[tier],
        count,
        avgAcc,
        bestWpm
      };
    });
  }, [attempts]);

  // Chronological oldest -> newest for the last 14 rehearsals
  const chartAttempts = useMemo(() => {
    return [...attempts.slice(0, 14)].reverse();
  }, [attempts]);

  const chartMax = useMemo(() => {
    if (trendMetric === 'accuracy') return 100;
    if (trendMetric === 'wpm') {
      return Math.max(120, ...chartAttempts.map((a) => a.wpm));
    }
    return Math.max(100, ...chartAttempts.map((a) => a.totalScore));
  }, [chartAttempts, trendMetric]);

  const inspectedAttempt = useMemo(() => {
    if (chartAttempts.length === 0) return null;
    if (selectedAttemptId) {
      const found = chartAttempts.find((a) => a.id === selectedAttemptId);
      if (found) return found;
    }
    return chartAttempts[chartAttempts.length - 1];
  }, [chartAttempts, selectedAttemptId]);

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return attempts;
    return attempts.filter((a) => a.difficulty === historyFilter);
  }, [attempts, historyFilter]);

  const visibleHistory = showAllHistory ? filteredHistory : filteredHistory.slice(0, 8);

  return (
    <section
      aria-label="İlerleme Takibi ve Prova Geçmişi"
      className="ebru-glass-card rounded-[28px] p-5 sm:p-6 space-y-6"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="text-[11px] font-display font-bold uppercase tracking-wider text-[#00F5D4] flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Kişisel Gelişim Özeti</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white font-display">
            İlerleme & Prova Geçmişi
          </h2>
        </div>
        {attempts.length > 0 && (
          <div className="text-xs text-[#CBD5E1] font-mono tabular-nums">
            {summary.count} prova · {formatTotalDuration(summary.totalDuration)} toplam çalışma
          </div>
        )}
      </div>

      {attempts.length === 0 ? (
        <div className="py-10 text-center space-y-2 border border-dashed border-white/15 rounded-2xl px-4">
          <History className="w-8 h-8 text-[#93C5FD]/70 mx-auto" />
          <div className="text-sm font-semibold text-white">
            Henüz kayıtlı bir prova bulunmuyor
          </div>
          <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
            Yukarıdan Kolay, Orta veya Zor seviyelerinden birini seçip ilk tekerleme provanızı tamamladığınızda doğruluk, hız gelişiminiz ve geçmiş kayıtlarınız burada görünecektir.
          </p>
        </div>
      ) : (
        <>
          {/* 4-Metric KPI Strip (Single elevation, hairline separated) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/10 border border-white/10 rounded-2xl bg-[#0d1629]/55">
            <div className="p-3.5 space-y-1">
              <div className="text-[11px] text-[#94A3B8] flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-[#00F5D4] shrink-0" />
                <span>Toplam Prova</span>
              </div>
              <div className="text-xl font-bold text-white font-display tabular-nums">
                {summary.count}
              </div>
              <div className="text-[11px] text-[#93C5FD] tabular-nums">
                En yüksek puan: {summary.bestScore}
              </div>
            </div>

            <div className="p-3.5 space-y-1">
              <div className="text-[11px] text-[#94A3B8] flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-[#06D6A0] shrink-0" />
                <span>Ort. Doğruluk</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-[#06D6A0] font-display tabular-nums">
                  %{summary.avgAccuracy}
                </span>
                {summary.accuracyDelta !== 0 && (
                  <span
                    className={`text-[11px] font-mono font-semibold inline-flex items-center tabular-nums ${
                      summary.accuracyDelta > 0 ? 'text-[#06D6A0]' : 'text-[#FF006E]'
                    }`}
                  >
                    {summary.accuracyDelta > 0 ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    {summary.accuracyDelta > 0 ? `+${summary.accuracyDelta}` : summary.accuracyDelta}%
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[#94A3B8] tabular-nums">
                En iyi: %{summary.bestAccuracy}
              </div>
            </div>

            <div className="p-3.5 space-y-1">
              <div className="text-[11px] text-[#94A3B8] flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-[#3A86FF] shrink-0" />
                <span>Ort. Hız</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-[#3A86FF] font-display tabular-nums">
                  {summary.avgWpm}
                </span>
                <span className="text-[11px] text-[#94A3B8]">WPM</span>
                {summary.wpmDelta !== 0 && (
                  <span
                    className={`text-[11px] font-mono font-semibold inline-flex items-center tabular-nums ${
                      summary.wpmDelta > 0 ? 'text-[#06D6A0]' : 'text-[#FFBE0B]'
                    }`}
                  >
                    {summary.wpmDelta > 0 ? `+${summary.wpmDelta}` : summary.wpmDelta}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[#94A3B8] tabular-nums">
                En iyi: {summary.bestWpm} WPM
              </div>
            </div>

            <div className="p-3.5 space-y-1">
              <div className="text-[11px] text-[#94A3B8] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#FFBE0B] shrink-0" />
                <span>Pratik Süresi</span>
              </div>
              <div className="text-xl font-bold text-[#FFBE0B] font-display tabular-nums">
                {formatTotalDuration(summary.totalDuration)}
              </div>
              <div className="text-[11px] text-[#94A3B8] tabular-nums">
                Son {Math.min(14, summary.count)} prova grafikte
              </div>
            </div>
          </div>

          {/* Trend Chart & Difficulty Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 pt-1">
            {/* Trend Chart (Last 14 Attempts) */}
            <div className="lg:col-span-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-white">
                  Son Provalar İlerleme Grafiği
                </div>
                <div
                  role="group"
                  aria-label="Grafik metriği"
                  className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#0d1629]/85 border border-white/10"
                >
                  {(
                    [
                      { id: 'accuracy', label: 'Doğruluk (%)' },
                      { id: 'wpm', label: 'Hız (WPM)' },
                      { id: 'totalScore', label: 'Puan' }
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        playTone('tap');
                        setTrendMetric(m.id);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        trendMetric === m.id
                          ? 'bg-[#3A86FF] text-white'
                          : 'text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#0d1629]/70 border border-white/10 space-y-3">
                <div
                  className="h-36 flex items-end gap-1.5 sm:gap-2 pt-4"
                  role="img"
                  aria-label="Son provaların performans çubuk grafiği"
                >
                  {chartAttempts.map((item, idx) => {
                    const rawValue =
                      trendMetric === 'accuracy'
                        ? item.accuracy
                        : trendMetric === 'wpm'
                        ? item.wpm
                        : item.totalScore;
                    const heightPct = Math.max(
                      10,
                      Math.min(100, Math.round((rawValue / chartMax) * 100))
                    );
                    const isSelected = inspectedAttempt?.id === item.id;
                    const barColor =
                      trendMetric === 'accuracy'
                        ? 'from-[#06D6A0] to-[#00F5D4]'
                        : trendMetric === 'wpm'
                        ? 'from-[#3A86FF] to-[#00F5D4]'
                        : 'from-[#FFBE0B] to-[#FF5400]';

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedAttemptId(item.id)}
                        onMouseEnter={() => setSelectedAttemptId(item.id)}
                        title={`${item.tekerlemeTitle} · %${item.accuracy} · ${item.wpm} WPM`}
                        className="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-1 group cursor-pointer focus:outline-none"
                      >
                        <span className="text-[10px] font-mono text-[#CBD5E1] tabular-nums leading-none">
                          {trendMetric === 'accuracy' ? `%${rawValue}` : rawValue}
                        </span>
                        <div
                          className={`w-full max-w-[26px] rounded-t-lg bg-gradient-to-t ${barColor} transition-all duration-200 ${
                            isSelected
                              ? 'ring-2 ring-white/80 brightness-110'
                              : 'opacity-75 group-hover:opacity-100'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                        <span className="text-[10px] font-mono text-[#64748B] tabular-nums leading-none">
                          {idx + 1}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {inspectedAttempt && (
                  <div className="pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 truncate font-semibold text-white">
                      {inspectedAttempt.tekerlemeTitle}
                      <span className="text-[#94A3B8] font-normal">
                        {' '}
                        · {DIFFICULTY_LABELS[inspectedAttempt.difficulty]} ·{' '}
                        {formatTurkishTimestamp(inspectedAttempt.createdAt)}
                      </span>
                    </div>
                    <div className="font-mono text-[#CBD5E1] tabular-nums shrink-0">
                      <span className="text-[#06D6A0]">%{inspectedAttempt.accuracy}</span>
                      {' · '}
                      <span className="text-[#93C5FD]">{inspectedAttempt.wpm} WPM</span>
                      {' · '}
                      <span className="text-[#FFBE0B]">{inspectedAttempt.totalScore} Puan</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Difficulty Tier Mastery */}
            <div className="lg:col-span-2 space-y-3">
              <div className="text-xs font-bold text-white">
                Zorluk Seviyesi İlerlemesi
              </div>
              <div className="p-3.5 rounded-2xl bg-[#0d1629]/70 border border-white/10 space-y-3">
                {difficultyBreakdown.map((row) => (
                  <div key={row.tier} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className={`font-semibold ${DIFFICULTY_TEXT_COLORS[row.tier]}`}>
                        {row.label}
                      </span>
                      <span className="font-mono text-[11px] text-[#CBD5E1] tabular-nums">
                        {row.count > 0
                          ? `${row.count} prova · Ort %${row.avgAcc} · ${row.bestWpm} WPM`
                          : 'Henüz yok'}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${DIFFICULTY_BAR_GRADIENTS[row.tier]} transition-all duration-300`}
                        style={{ width: `${row.count > 0 ? Math.max(6, row.avgAcc) : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Rehearsal History List */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <History className="w-4 h-4 text-[#FFBE0B] shrink-0" />
                <span>Prova Geçmişi</span>
                <span className="text-xs font-mono text-[#94A3B8] font-normal tabular-nums">
                  ({filteredHistory.length})
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div
                  role="group"
                  aria-label="Prova geçmişi zorluk filtresi"
                  className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#0d1629]/85 border border-white/10"
                >
                  {(
                    [
                      { id: 'all', label: 'Tümü' },
                      { id: 'kolay', label: 'Kolay' },
                      { id: 'orta', label: 'Orta' },
                      { id: 'zor', label: 'Zor' },
                      { id: 'efsane', label: 'Efsane' }
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        playTone('tap');
                        setHistoryFilter(f.id);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        historyFilter === f.id
                          ? 'bg-[#00F5D4] text-[#0d1629]'
                          : 'text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {!confirmClear ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-rose-300/80 hover:text-rose-200 hover:bg-[#FF006E]/15 border border-white/10 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Geçmişi Temizle
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-1.5 text-[11px]">
                    <span className="text-rose-200">Emin misiniz?</span>
                    <button
                      type="button"
                      onClick={() => {
                        playTone('wrong');
                        onClearHistory();
                        setConfirmClear(false);
                      }}
                      className="px-2 py-1 rounded-lg bg-[#FF006E] text-white font-semibold cursor-pointer"
                    >
                      Evet, Sil
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClear(false)}
                      className="px-2 py-1 rounded-lg bg-white/10 text-[#CBD5E1] cursor-pointer"
                    >
                      Vazgeç
                    </button>
                  </div>
                )}
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#94A3B8]">
                Seçilen zorluk seviyesinde henüz prova kaydı bulunmuyor.
              </div>
            ) : (
              <div className="divide-y divide-white/10 border border-white/10 rounded-2xl bg-[#0d1629]/50">
                {visibleHistory.map((item) => (
                  <div
                    key={item.id}
                    className="px-3.5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-xs sm:text-sm font-semibold text-white truncate">
                        {item.tekerlemeTitle}
                      </div>
                      <div className="text-[11px] text-[#94A3B8] flex flex-wrap items-center gap-1.5 tabular-nums">
                        <span className={`font-semibold ${DIFFICULTY_TEXT_COLORS[item.difficulty]}`}>
                          {DIFFICULTY_LABELS[item.difficulty]}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatTurkishTimestamp(item.createdAt)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.durationSeconds} sn</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#06D6A0]">+{item.xpEarned} XP</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
                        <span className="font-bold text-[#06D6A0]">%{item.accuracy}</span>
                        <span className="text-[#93C5FD]">{item.wpm} WPM</span>
                        <span className="font-bold text-[#FFBE0B]">{item.totalScore}p</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            playTone('tap');
                            onReplayTekerleme(item.tekerlemeId, item.difficulty);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-[#3A86FF]/30 text-[11px] font-semibold text-white transition-colors whitespace-nowrap cursor-pointer"
                          title="Bu tekerlemeyi tekrar çalış"
                        >
                          <RotateCcw className="w-3 h-3 text-[#00F5D4]" />
                          <span>Tekrar Çalış</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            playTone('tap');
                            onDeleteAttempt(item.id);
                          }}
                          className="p-1.5 rounded-lg text-[#94A3B8] hover:text-rose-300 hover:bg-[#FF006E]/15 transition-colors cursor-pointer"
                          title="Kaydı sil"
                          aria-label={`${item.tekerlemeTitle} provasını sil`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {filteredHistory.length > 8 && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowAllHistory((prev) => !prev)}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold text-[#93C5FD] hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
                >
                  {showAllHistory
                    ? 'Daha Az Göster'
                    : `Tüm Provaları Göster (${filteredHistory.length})`}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};
