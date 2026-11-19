import React, { Suspense, useState } from 'react';
import { UserProfile } from '../types/game';
import {
  PhoenixComputedState,
  PhoenixWingPattern,
  RelicSlot,
  unlockOrEquipRelic,
  updatePhoenixCustomization,
  upgradeRelicRank
} from '../utils/phoenixProgression';
import { resolveEquippedVisuals } from './PhoenixEquippedVisuals';
import { playTone } from '../utils/soundEffects';

const Phoenix3DViewer = React.lazy(() =>
  import('./Phoenix3DViewer').then((m) => ({ default: m.Phoenix3DViewer }))
);
import {
  X,
  Sparkles,
  Shield,
  ShieldCheck,
  Flame,
  Crown,
  Zap,
  Check,
  Lock,
  ArrowUpCircle,
  Star,
  Eye,
  Palette,
  Feather
} from 'lucide-react';
import zumruduankaRelicImg from '../assets/images/zumruduanka_relics_1794737130585.jpg';

interface PhoenixSanctuaryModalProps {
  isOpen: boolean;
  phoenix: PhoenixComputedState;
  userProfile: UserProfile | null;
  onProgressUpdated: () => void;
  onClose: () => void;
}

export const PhoenixSanctuaryModal: React.FC<PhoenixSanctuaryModalProps> = ({
  isOpen,
  phoenix,
  userProfile,
  onProgressUpdated,
  onClose
}) => {
  const [selectedSlot, setSelectedSlot] = useState<'all' | RelicSlot>('all');
  const [previewRelicId, setPreviewRelicId] = useState<string | null>(null);
  const [previewPaletteId, setPreviewPaletteId] = useState<string | null>(null);
  const [previewPatternId, setPreviewPatternId] = useState<PhoenixWingPattern['id'] | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const baseVisuals = resolveEquippedVisuals(phoenix);
  const previewRelic = previewRelicId
    ? phoenix.relics.find((r) => r.id === previewRelicId) || null
    : null;
  const previewPalette = previewPaletteId
    ? phoenix.featherPalettes.find((p) => p.id === previewPaletteId) || null
    : null;
  const previewPattern = previewPatternId
    ? phoenix.wingPatterns.find((p) => p.id === previewPatternId) || null
    : null;

  const effective3D = {
    auraId: previewRelic?.slot === 'aura' ? previewRelic.id : baseVisuals.auraId,
    auraRank:
      previewRelic?.slot === 'aura'
        ? Math.max(1, previewRelic.rank)
        : baseVisuals.auraRank,
    talismanId:
      previewRelic?.slot === 'talisman' ? previewRelic.id : baseVisuals.talismanId,
    talismanRank:
      previewRelic?.slot === 'talisman'
        ? Math.max(1, previewRelic.rank)
        : baseVisuals.talismanRank,
    crestId: previewRelic?.slot === 'crest' ? previewRelic.id : baseVisuals.crestId,
    crestRank:
      previewRelic?.slot === 'crest'
        ? Math.max(1, previewRelic.rank)
        : baseVisuals.crestRank,
    featherPaletteId: previewPaletteId || baseVisuals.featherPaletteId,
    wingPatternId: previewPatternId || baseVisuals.wingPatternId,
    ringGradient:
      previewPalette
        ? previewPalette.ringGradient
        : (previewRelic?.slot === 'aura' && previewRelic.id === 'aura_pomegranate_flame') ||
          (previewRelic?.slot !== 'aura' && baseVisuals.auraId === 'aura_pomegranate_flame')
        ? 'from-[#FF006E] via-[#FF5400] to-[#FFBE0B]'
        : baseVisuals.ringGradient
  };

  const isPreviewingAny = Boolean(previewRelic || previewPalette || previewPattern);
  const previewTitleParts = [
    previewRelic?.name,
    previewPalette?.name,
    previewPattern?.name
  ].filter(Boolean);

  const ownedRelics = phoenix.relics.filter((r) => r.unlocked);
  const filteredRelics =
    selectedSlot === 'all'
      ? phoenix.relics
      : phoenix.relics.filter((r) => r.slot === selectedSlot);

  const renderBadgeIcon = (
    badge: 'feather' | 'nazar' | 'flame' | 'crown' | 'bolt' | 'halo',
    color: string
  ) => {
    const cls = 'w-5 h-5';
    switch (badge) {
      case 'nazar':
        return <Shield className={cls} style={{ color }} />;
      case 'flame':
        return <Flame className={cls} style={{ color }} />;
      case 'crown':
      case 'halo':
        return <Crown className={cls} style={{ color }} />;
      case 'bolt':
        return <Zap className={cls} style={{ color }} />;
      default:
        return <Sparkles className={cls} style={{ color }} />;
    }
  };

  const handleEquipOrUnlock = (relicId: string) => {
    const res = unlockOrEquipRelic(relicId, userProfile);
    if (res.ok) {
      playTone('correct');
      setFeedback('Öge aktif edildi!');
      onProgressUpdated();
    } else {
      playTone('wrong');
      setFeedback(res.reason || 'Açılmadı');
    }
    setTimeout(() => setFeedback(null), 2200);
  };

  const handleUpgrade = (relicId: string) => {
    const res = upgradeRelicRank(relicId, userProfile);
    if (res.ok) {
      playTone('victory');
      setFeedback('Yükseltme başarılı!');
      onProgressUpdated();
    } else {
      playTone('wrong');
      setFeedback(res.reason || 'Yükseltilemedi');
    }
    setTimeout(() => setFeedback(null), 2200);
  };

  const handleSelectPalette = (paletteId: string, unlocked: boolean, hint: string, name: string) => {
    if (!unlocked) {
      playTone('tap');
      setPreviewPaletteId((prev) => (prev === paletteId ? null : paletteId));
      setFeedback(`Önizleme: ${name} (${hint})`);
      setTimeout(() => setFeedback(null), 2600);
      return;
    }
    setPreviewPaletteId(null);
    const res = updatePhoenixCustomization({ featherPaletteId: paletteId }, userProfile);
    if (res.ok) {
      playTone('correct');
      setFeedback(`Tüy paleti "${name}" uygulandı!`);
      onProgressUpdated();
    } else {
      playTone('wrong');
      setFeedback(res.reason || 'Uygulanamadı');
    }
    setTimeout(() => setFeedback(null), 2200);
  };

  const handleSelectPattern = (
    patternId: PhoenixWingPattern['id'],
    unlocked: boolean,
    hint: string,
    name: string
  ) => {
    if (!unlocked) {
      playTone('tap');
      setPreviewPatternId((prev) => (prev === patternId ? null : patternId));
      setFeedback(`Önizleme: ${name} (${hint})`);
      setTimeout(() => setFeedback(null), 2600);
      return;
    }
    setPreviewPatternId(null);
    const res = updatePhoenixCustomization({ wingPatternId: patternId }, userProfile);
    if (res.ok) {
      playTone('correct');
      setFeedback(`Kanat deseni "${name}" uygulandı!`);
      onProgressUpdated();
    } else {
      playTone('wrong');
      setFeedback(res.reason || 'Uygulanamadı');
    }
    setTimeout(() => setFeedback(null), 2200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#060a14]/80 backdrop-blur-md p-0 sm:p-4 animate-screen-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-t-[30px] sm:rounded-[30px] game-card-3d border border-white/15 p-5 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img
              src={zumruduankaRelicImg}
              alt=""
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-xl object-cover border border-[#FFBE0B]/40"
            />
            <div>
              <h2 className="font-display text-lg font-bold text-white leading-none">
                Zümrüdüanka Yuvası
              </h2>
              <div className="text-[11px] text-[#93C5FD] mt-0.5 tabular-nums">
                Sv. {phoenix.level} · {phoenix.stage.name}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-[#0d1629] border border-[#FFBE0B]/40 text-xs font-display font-bold text-[#FFBE0B] flex items-center gap-1 tabular-nums">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{phoenix.sparks}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                playTone('tap');
                onClose();
              }}
              aria-label="Kapat"
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3D Interactive Character & Relic Preview Viewport */}
        <div className="space-y-3">
          <Suspense
            fallback={
              <div className="w-full h-[280px] sm:h-[340px] rounded-2xl bg-[#0d1629]/85 border border-white/10 flex flex-col items-center justify-center gap-2.5">
                <div className="w-8 h-8 rounded-full border-2 border-[#FFBE0B]/30 border-t-[#FFBE0B] animate-spin" />
                <span className="text-xs font-semibold text-[#93C5FD]">
                  3D Zümrüdüanka hazırlanıyor...
                </span>
              </div>
            }
          >
            <Phoenix3DViewer
              level={phoenix.level}
              stageName={phoenix.stage.name}
              auraId={effective3D.auraId}
              auraRank={effective3D.auraRank}
              talismanId={effective3D.talismanId}
              talismanRank={effective3D.talismanRank}
              crestId={effective3D.crestId}
              crestRank={effective3D.crestRank}
              featherPaletteId={effective3D.featherPaletteId}
              wingPatternId={effective3D.wingPatternId}
              isPreviewing={isPreviewingAny}
              previewItemName={previewTitleParts.join(' · ') || null}
              onResetPreview={() => {
                playTone('tap');
                setPreviewRelicId(null);
                setPreviewPaletteId(null);
                setPreviewPatternId(null);
              }}
            />
          </Suspense>

          {/* Dynamic Feather Palette & Wing Pattern Customizer */}
          <div className="p-3 rounded-2xl bg-[#0d1629]/85 border border-white/12 space-y-3">
            {/* Feather Color Palette Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] px-0.5">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-[#FFBE0B]" />
                  <span>Tüy Rengi Paleti</span>
                </span>
                <span className="text-[#93C5FD] text-[10px]">
                  {phoenix.featherPalettes.find((p) => p.id === effective3D.featherPaletteId)?.name}
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {phoenix.featherPalettes.map((pal) => {
                  const isActive = effective3D.featherPaletteId === pal.id;
                  return (
                    <button
                      key={pal.id}
                      type="button"
                      onClick={() =>
                        handleSelectPalette(pal.id, pal.unlocked, pal.unlockHint, pal.name)
                      }
                      title={pal.unlocked ? pal.name : `${pal.name} (${pal.unlockHint})`}
                      className={`relative p-2 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-white/12 border-[#FFBE0B] shadow-md'
                          : pal.unlocked
                          ? 'bg-white/5 border-white/10 hover:border-white/30'
                          : 'bg-white/[0.03] border-white/8 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center -space-x-1">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/40"
                          style={{ backgroundColor: pal.primaryColor }}
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/40"
                          style={{ backgroundColor: pal.secondaryColor }}
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/40"
                          style={{ backgroundColor: pal.accentColor }}
                        />
                      </div>
                      <span className="text-[9.5px] font-bold text-white truncate w-full text-center">
                        {pal.name.split(' ')[0]}
                      </span>
                      {!pal.unlocked && (
                        <Lock className="w-2.5 h-2.5 text-[#FFBE0B] absolute top-1 right-1" />
                      )}
                      {pal.selected && pal.unlocked && !previewPaletteId && (
                        <Check className="w-2.5 h-2.5 text-[#06D6A0] absolute top-1 right-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Wing Pattern Selector */}
            <div className="space-y-1.5 pt-1 border-t border-white/10">
              <div className="flex items-center justify-between text-[11px] px-0.5">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Feather className="w-3.5 h-3.5 text-[#00F5D4]" />
                  <span>Kanat Deseni</span>
                </span>
                <span className="text-[#93C5FD] text-[10px]">
                  {phoenix.wingPatterns.find((p) => p.id === effective3D.wingPatternId)?.name}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {phoenix.wingPatterns.map((pat) => {
                  const isActive = effective3D.wingPatternId === pat.id;
                  return (
                    <button
                      key={pat.id}
                      type="button"
                      onClick={() =>
                        handleSelectPattern(pat.id, pat.unlocked, pat.unlockHint, pat.name)
                      }
                      title={pat.unlocked ? pat.name : `${pat.name} (${pat.unlockHint})`}
                      className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#00F5D4]/20 border-[#00F5D4] text-[#00F5D4]'
                          : pat.unlocked
                          ? 'bg-white/5 border-white/12 text-[#CBD5E1] hover:text-white'
                          : 'bg-white/[0.03] border-white/8 text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      {!pat.unlocked && <Lock className="w-3 h-3 text-[#FFBE0B]" />}
                      <span>{pat.name}</span>
                      {pat.selected && pat.unlocked && !previewPatternId && (
                        <Check className="w-3 h-3 text-[#06D6A0]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick Preview Strip for Owned Rare Items */}
          {ownedRelics.length > 0 && (
            <div className="p-2.5 rounded-2xl bg-[#0d1629]/85 border border-white/10 space-y-1.5">
              <div className="flex items-center justify-between text-[10.5px] text-[#93C5FD] px-0.5">
                <span className="font-bold">Sahip Olduğun Ögeleri 3D Önizle</span>
                {isPreviewingAny && (
                  <button
                    type="button"
                    onClick={() => {
                      playTone('tap');
                      setPreviewRelicId(null);
                      setPreviewPaletteId(null);
                      setPreviewPatternId(null);
                    }}
                    className="text-[#FFBE0B] hover:underline font-semibold cursor-pointer"
                  >
                    Önizlemeyi Temizle
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ownedRelics.map((owned) => {
                  const isBeingPreviewed = previewRelicId === owned.id;
                  return (
                    <button
                      key={owned.id}
                      type="button"
                      onClick={() => {
                        playTone('tap');
                        setPreviewRelicId(isBeingPreviewed ? null : owned.id);
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                        isBeingPreviewed
                          ? 'bg-[#00F5D4]/20 border-[#00F5D4] text-[#00F5D4]'
                          : owned.equipped
                          ? 'bg-[#FFBE0B]/15 border-[#FFBE0B]/45 text-[#FFBE0B]'
                          : 'bg-white/5 border-white/10 text-[#CBD5E1] hover:text-white'
                      }`}
                    >
                      <Eye className="w-3 h-3 shrink-0" />
                      <span>{owned.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Equipped Slots & Compact Stats */}
          <div className="p-3.5 rounded-[22px] bg-[#0d1629]/85 border border-white/10 space-y-2.5">
            <div className="grid grid-cols-3 gap-1.5 text-[10.5px]">
              <div className="px-2 py-1.5 rounded-xl bg-white/5 border border-white/10 truncate">
                <span className="text-[#94A3B8] block text-[9.5px]">Aura</span>
                <span className="font-bold text-[#00F5D4] truncate block">
                  {phoenix.relics.find((r) => r.id === effective3D.auraId)?.name || phoenix.activeAura.name}
                </span>
              </div>
              <div className="px-2 py-1.5 rounded-xl bg-white/5 border border-white/10 truncate">
                <span className="text-[#94A3B8] block text-[9.5px]">Tılsım</span>
                <span className={`font-bold truncate block ${effective3D.talismanId ? 'text-[#3A86FF]' : 'text-[#64748B]'}`}>
                  {phoenix.relics.find((r) => r.id === effective3D.talismanId)?.name || 'Boş'}
                </span>
              </div>
              <div className="px-2 py-1.5 rounded-xl bg-white/5 border border-white/10 truncate">
                <span className="text-[#94A3B8] block text-[9.5px]">Taç & İbik</span>
                <span className={`font-bold truncate block ${effective3D.crestId ? 'text-[#FFBE0B]' : 'text-[#64748B]'}`}>
                  {phoenix.relics.find((r) => r.id === effective3D.crestId)?.name || 'Boş'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                <div className="text-sm font-display font-bold text-[#00F5D4] tabular-nums">
                  {phoenix.progress.practicesCompleted + phoenix.progress.roundsCompleted}
                </div>
                <div className="text-[10px] text-[#94A3B8]">Tur & Pratik</div>
              </div>
              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                <div className="text-sm font-display font-bold text-[#FFBE0B] tabular-nums">
                  {phoenix.progress.bestWpm || 0}
                </div>
                <div className="text-[10px] text-[#94A3B8]">En Hızlı K/Dk</div>
              </div>
              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                <div className="text-sm font-display font-bold text-[#06D6A0] tabular-nums">
                  %{phoenix.progress.bestAccuracy || 0}
                </div>
                <div className="text-[10px] text-[#94A3B8]">En İyi Oran</div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] tabular-nums">
                <span className="text-[#CBD5E1] font-semibold">Evrim İlerlemesi</span>
                <span className="text-[#FFBE0B] font-bold">
                  {phoenix.xpIntoLevel} / {phoenix.xpForNextLevel} XP
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${effective3D.ringGradient}`}
                  style={{ width: `${phoenix.progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {feedback && (
          <div className="py-2 px-3 rounded-xl bg-[#06D6A0]/20 border border-[#06D6A0]/50 text-[#06D6A0] text-xs font-bold text-center">
            {feedback}
          </div>
        )}

        {/* Slot Filter */}
        <div className="grid grid-cols-4 gap-1.5 bg-[#0d1629]/80 p-1 rounded-2xl border border-white/10">
          {[
            { id: 'all', label: 'Tümü' },
            { id: 'aura', label: 'Aura' },
            { id: 'talisman', label: 'Tılsım' },
            { id: 'crest', label: 'Taç' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                playTone('tap');
                setSelectedSlot(tab.id as 'all' | RelicSlot);
              }}
              className={`min-h-[38px] rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedSlot === tab.id
                  ? 'bg-gradient-to-r from-[#3A86FF] to-[#00F5D4] text-[#0d1629]'
                  : 'text-[#CBD5E1] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Inventory & Upgrades Grid */}
        <div className="grid sm:grid-cols-2 gap-2.5">
          {filteredRelics.map((item) => {
            const lockedByReq =
              !item.unlocked &&
              (phoenix.level < item.unlockLevel ||
                (item.unlockWins ? (userProfile?.multiplayerWins ?? 0) < item.unlockWins : false));

            const isPreviewingItem = previewRelicId === item.id;

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-3 transition-all ${
                  isPreviewingItem
                    ? 'bg-gradient-to-br from-[#00F5D4]/15 to-[#0d1629]/95 border-[#00F5D4] shadow-lg'
                    : item.equipped
                    ? 'bg-gradient-to-br from-[#3A86FF]/20 to-[#0d1629]/95 border-[#FFBE0B]/70 shadow-lg'
                    : item.unlocked
                    ? 'bg-[#0d1629]/85 border-white/14'
                    : 'bg-[#0d1629]/60 border-white/8 opacity-90'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl bg-white/5 border border-white/12 flex items-center justify-center shrink-0"
                      style={{
                        boxShadow: item.unlocked ? `0 0 14px ${item.glowColor}33` : undefined
                      }}
                    >
                      {renderBadgeIcon(item.badgeIcon, item.glowColor)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-display font-bold text-white truncate">
                        {item.name}
                      </div>
                      <div className="text-[10.5px] text-[#93C5FD]">
                        {item.slotLabel} · {item.shortEffect}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  {/* Stars / Rank */}
                  {item.unlocked ? (
                    <div className="flex items-center gap-0.5" title={`Seviye ${item.rank}/${item.maxRank}`}>
                      {Array.from({ length: item.maxRank }).map((_, idx) => (
                        <Star
                          key={idx}
                          className={`w-3.5 h-3.5 ${
                            idx < item.rank
                              ? 'text-[#FFBE0B] fill-[#FFBE0B]'
                              : 'text-white/20'
                          }`}
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10.5px] text-[#94A3B8] font-semibold flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      {item.unlockWins
                        ? `Sv.${item.unlockLevel} · ${item.unlockWins} Galibiyet`
                        : `Sv.${item.unlockLevel}`}
                    </span>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        playTone('tap');
                        setPreviewRelicId(isPreviewingItem ? null : item.id);
                      }}
                      title="3D Kuş Üzerinde Önizle"
                      className={`min-h-[34px] px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                        isPreviewingItem
                          ? 'bg-[#00F5D4] text-[#0d1629]'
                          : 'bg-white/10 hover:bg-white/20 text-[#CBD5E1] hover:text-white'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{isPreviewingItem ? 'Önizlemede' : 'Önizle'}</span>
                    </button>

                    {item.unlocked ? (
                      <>
                        {item.nextUpgradeCost !== null && (
                          <button
                            type="button"
                            onClick={() => handleUpgrade(item.id)}
                            disabled={!item.canAffordUpgrade}
                            className={`min-h-[34px] px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer tabular-nums ${
                              item.canAffordUpgrade
                                ? 'bg-[#FFBE0B] text-[#0d1629] hover:brightness-105'
                                : 'bg-white/8 text-[#94A3B8] cursor-not-allowed'
                            }`}
                          >
                            <ArrowUpCircle className="w-3.5 h-3.5" />
                            <span>{item.nextUpgradeCost}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewRelicId(null);
                            handleEquipOrUnlock(item.id);
                          }}
                          title={item.equipped ? 'Aktif öge' : 'Ögeyi kuşan'}
                          aria-label={item.equipped ? `${item.name} aktif` : `${item.name} kuşan`}
                          className={`min-h-[34px] px-3 py-1 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer ${
                            item.equipped
                              ? 'bg-[#06D6A0]/20 text-[#06D6A0] border border-[#06D6A0]/45'
                              : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                        >
                          {item.equipped ? (
                            <ShieldCheck className="w-4 h-4" />
                          ) : (
                            <span>Kuşan</span>
                          )}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={lockedByReq || phoenix.sparks < item.unlockCostSparks}
                        onClick={() => {
                          setPreviewRelicId(null);
                          handleEquipOrUnlock(item.id);
                        }}
                        className={`min-h-[34px] px-3 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 tabular-nums ${
                          !lockedByReq && phoenix.sparks >= item.unlockCostSparks
                            ? 'btn-epic-turquoise cursor-pointer'
                            : 'bg-white/8 text-[#94A3B8] cursor-not-allowed'
                        }`}
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Aç · {item.unlockCostSparks}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
