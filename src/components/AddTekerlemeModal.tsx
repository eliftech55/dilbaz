import React, { useState, useEffect } from 'react';
import { Tekerleme, Difficulty, PhonemeCategory } from '../types/game';
import { playTone } from '../utils/soundEffects';
import { X, Plus, Pencil } from 'lucide-react';

interface AddTekerlemeModalProps {
  isOpen: boolean;
  editingTekerleme?: Tekerleme | null;
  isContributionMode?: boolean;
  isAdmin?: boolean;
  onClose: () => void;
  onSave: (tekerleme: Tekerleme) => void;
}

const CATEGORY_LABELS: Record<PhonemeCategory, string> = {
  tum: 'Genel',
  's-s': 'Ş - S Sesleri',
  'c-c': 'Ç - C Sesleri',
  'p-b': 'P - B Sesleri',
  'r-l': 'R - L Sesleri',
  'k-g': 'K - G Sesleri',
  'm-n': 'M - N Sesleri',
  vurgu: 'Vurgu & Tonlama'
};

export const AddTekerlemeModal: React.FC<AddTekerlemeModalProps> = ({
  isOpen,
  editingTekerleme = null,
  isContributionMode = false,
  isAdmin = false,
  onClose,
  onSave
}) => {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('orta');
  const [category, setCategory] = useState<PhonemeCategory>('s-s');
  const [benchmarkSeconds, setBenchmarkSeconds] = useState(4.5);
  const [tip, setTip] = useState('');
  const [soundsInput, setSoundsInput] = useState('Ş, S');

  useEffect(() => {
    if (isOpen) {
      if (editingTekerleme) {
        setTitle(editingTekerleme.title);
        setText(editingTekerleme.text);
        setDifficulty(editingTekerleme.difficulty);
        setCategory(editingTekerleme.category || 's-s');
        setBenchmarkSeconds(editingTekerleme.benchmarkSeconds);
        setTip(editingTekerleme.tip);
        setSoundsInput((editingTekerleme.targetSounds || []).join(', '));
      } else {
        setTitle('');
        setText('');
        setDifficulty('orta');
        setCategory('s-s');
        setBenchmarkSeconds(4.5);
        setTip('');
        setSoundsInput('Ş, S');
      }
    }
  }, [isOpen, editingTekerleme]);

  if (!isOpen) return null;

  const isEditing = Boolean(editingTekerleme);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !text.trim()) return;

    playTone('correct');
    const targetSounds = soundsInput
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    const savedTekerleme: Tekerleme = {
      ...(editingTekerleme || {}),
      id: editingTekerleme ? editingTekerleme.id : `contrib-${Date.now()}`,
      title: title.trim(),
      text: text.trim(),
      difficulty,
      category,
      categoryLabel: CATEGORY_LABELS[category] || 'Özel Tekerleme',
      targetSounds: targetSounds.length > 0 ? targetSounds : ['DİKSİYON'],
      benchmarkSeconds: Number(benchmarkSeconds) || 4.5,
      tip: tip.trim() || 'Kelimeleri hecelemeden akıcı bir solukla seslendirmeye dikkat edin.',
      addedByUser: editingTekerleme ? editingTekerleme.addedByUser : true
    };

    onSave(savedTekerleme);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#090e1a]/82 backdrop-blur-md">
      <div className="w-full max-w-lg bg-[#14213D] border-[1.5px] border-[#3A86FF]/45 rounded-[28px] shadow-2xl overflow-hidden animate-screen-in">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#0d1629]/60">
          <div>
            <h2 className="text-base font-bold text-[#FFBE0B] font-display flex items-center gap-2">
              {isEditing ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>
                {isEditing
                  ? '✦ Tekerlemeyi Düzenle'
                  : isContributionMode
                  ? '✦ Tekerleme Havuzuna Katkıda Bulun'
                  : '✦ Özel Tekerleme Ekle'}
              </span>
            </h2>
            {!isEditing && isContributionMode && (
              <p className="text-[11px] text-[#93C5FD] mt-0.5">
                {isAdmin
                  ? 'Yönetici olarak doğrudan onaylı havuza eklenir.'
                  : 'Gönderdiğiniz tekerleme yönetici onayından sonra havuza eklenir ve +100 Liderlik Puanı kazandırır.'}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              playTone('tap');
              onClose();
            }}
            className="p-1.5 rounded-xl text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="font-semibold text-[#CBD5E1]">Tekerleme Başlığı</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: Kırk Küp Kara Küp"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1629]/85 border border-white/15 text-white focus:border-[#FFBE0B] focus:outline-none text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-[#CBD5E1]">Tekerleme Metni</label>
            <textarea
              required
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Örn: Şu köşe yaz köşesi, şu köşe kış köşesi..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1629]/85 border border-white/15 text-white focus:border-[#FFBE0B] focus:outline-none text-sm leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-[#CBD5E1]">Zorluk</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0d1629]/85 border border-white/15 text-white focus:border-[#FFBE0B] focus:outline-none capitalize"
              >
                <option value="kolay">Kolay</option>
                <option value="orta">Orta</option>
                <option value="zor">Zor</option>
                <option value="efsane">Efsane</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-[#CBD5E1]">Ses Grubu</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PhonemeCategory)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0d1629]/85 border border-white/15 text-white focus:border-[#FFBE0B] focus:outline-none"
              >
                <option value="s-s">Ş - S</option>
                <option value="p-b">P - B</option>
                <option value="c-c">Ç - C</option>
                <option value="r-l">R - L</option>
                <option value="k-g">K - G</option>
                <option value="m-n">M - N</option>
                <option value="vurgu">Vurgu</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-[#CBD5E1]">Hedef Süre (sn)</label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="30"
                value={benchmarkSeconds}
                onChange={(e) => setBenchmarkSeconds(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0d1629]/85 border border-white/15 text-white focus:border-[#FFBE0B] focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-[#CBD5E1]">Hedef Sesler (Virgülle ayırın)</label>
            <input
              type="text"
              value={soundsInput}
              onChange={(e) => setSoundsInput(e.target.value)}
              placeholder="Ş, S, P"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1629]/85 border border-white/15 text-white focus:border-[#FFBE0B] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-[#CBD5E1]">Diksiyon & Nefes İpucu</label>
            <input
              type="text"
              value={tip}
              onChange={(e) => setTip(e.target.value)}
              placeholder="Örn: Dil ucunuzu üst damağa hafifçe dokundurun."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1629]/85 border border-white/15 text-white focus:border-[#FFBE0B] focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl btn-epic-pomegranate font-bold cursor-pointer"
            >
              {isEditing
                ? 'Değişiklikleri Kaydet'
                : isContributionMode && !isAdmin
                ? 'Onaya Gönder (+100 Puan)'
                : 'Havuza Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
