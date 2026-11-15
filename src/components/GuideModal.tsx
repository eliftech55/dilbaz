import React, { useState } from 'react';
import { X, Smartphone, Cpu, Network, Database, Award, Milestone, Copy, Check } from 'lucide-react';
import { PhoenixWingPair } from './DilbazMascot';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'stack' | 'speech' | 'realtime' | 'db' | 'scoring' | 'roadmap'>('stack');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-[#090e1a]/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#14213D] border-[1.5px] border-[#3A86FF]/45 rounded-[28px] shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col animate-screen-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#0d1629]/70">
          <div className="flex items-center gap-3.5 pl-1.5">
            <div className="relative w-9 h-9 shrink-0 mx-1">
              <PhoenixWingPair compact />
              <img
                src={`${import.meta.env.BASE_URL}assets/aistudio/logo_785c16ab.png`}
                alt="Dilbaz"
                className="relative z-10 w-full h-full rounded-full object-cover ring-2 ring-[#FFBE0B]/60 animate-phoenix-bird-flap"
              />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#FFBE0B] font-display">
                ✦ Dilbaz Hakkında & Mimari Rehber
              </h2>
              <p className="text-xs text-[#93C5FD]">
                Ebru & Zümrüdüanka konsepti, ses analizi ve canlı oda altyapısı
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#94A3B8] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 border-b border-slate-800 flex gap-2 overflow-x-auto no-scrollbar bg-slate-900/60">
          <button
            onClick={() => setActiveTab('stack')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'stack' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Mobil Teknoloji Yığını</span>
          </button>

          <button
            onClick={() => setActiveTab('speech')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'speech' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Ses & Diksiyon Analizi</span>
          </button>

          <button
            onClick={() => setActiveTab('realtime')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'realtime' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Network className="w-4 h-4" />
            <span>Oda & Eşzamanlılık</span>
          </button>

          <button
            onClick={() => setActiveTab('scoring')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'scoring' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Hız & Telaffuz Formülü</span>
          </button>

          <button
            onClick={() => setActiveTab('db')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'db' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Veritabanı Şeması</span>
          </button>

          <button
            onClick={() => setActiveTab('roadmap')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'roadmap' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Milestone className="w-4 h-4" />
            <span>4 Haftalık Yol Haritası</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-sm text-slate-300">
          {/* TAB 1: STACK */}
          {activeTab === 'stack' && (
            <div className="space-y-5">
              <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-2xl">
                <h3 className="font-bold text-amber-300 text-base mb-1">
                  💡 Tavsiye Edilen Teknoloji Yığını: React Native + Expo veya Flutter
                </h3>
                <p className="text-xs text-amber-200/80 leading-relaxed">
                  Öğrenciler hem iOS (iPhone/iPad) hem de Android cihazlar kullanacağı için çapraz platform (cross-platform) framework seçmek geliştirme süresini %60 kısaltır.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
                  <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    Seçenek A: React Native + Expo (Önerilen)
                  </h4>
                  <ul className="text-xs space-y-2 text-slate-300">
                    <li>• <strong>Ses Kütüphanesi:</strong> `@react-native-voice/voice` veya `expo-speech` + WebSpeech.</li>
                    <li>• <strong>Gerçek Zamanlı İletişim:</strong> `socket.io-client` veya Supabase/Firebase Realtime.</li>
                    <li>• <strong>Animasyon:</strong> `react-native-reanimated` ile 60/120 FPS mikrofon dalgası ve sayaç.</li>
                    <li>• <strong>Hızlı Prototipleme:</strong> Expo Go ile QR kod okutarak saniyeler içinde telefonda test imkanı.</li>
                  </ul>
                </div>

                <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
                  <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    Seçenek B: Flutter (Dart)
                  </h4>
                  <ul className="text-xs space-y-2 text-slate-300">
                    <li>• <strong>Ses Kütüphanesi:</strong> `speech_to_text` eklentisi (iOS Speech Framework & Android SpeechRecognizer).</li>
                    <li>• <strong>Gerçek Zamanlı İletişim:</strong> `web_socket_channel` veya Firebase.</li>
                    <li>• <strong>Avantaj:</strong> Yüksek grafik performansı ve kusursuz materyal/Cupertino widget desteği.</li>
                    <li>• <strong>Dezavantaj:</strong> JavaScript ekosistemindeki zengin WebSpeech ve Levenshtein kütüphaneleri manuel yazım gerektirebilir.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SPEECH */}
          {activeTab === 'speech' && (
            <div className="space-y-4">
              <h3 className="font-bold text-white text-base">
                Ses Tanıma ve Diksiyon Değerlendirmesi Nasıl Yapılır?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tekerleme yarışmasında en kritik konu <strong>gecikmesiz (ultra-low latency)</strong> ve <strong>Türkçe fonetik doğruluğu yüksek</strong> ses tanımadır.
              </p>

              <div className="space-y-3">
                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-xs font-mono font-bold text-amber-400 uppercase">1. Aşama: Cihaz Üstü (On-Device) Speech-to-Text</span>
                  <p className="text-xs text-slate-300 mt-1">
                    iOS'te `SFSpeechRecognizer(locale: "tr_TR")`, Android'de `RecognitionListener`. Ücretsizdir, internet kotasını tüketmez ve gecikme &lt;100 milisaniyedir. Bu prototipte tarayıcı eşdeğeri olan <strong>Web Speech API (webkitSpeechRecognition)</strong> kullanılmaktadır.
                  </p>
                </div>

                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-xs font-mono font-bold text-cyan-400 uppercase">2. Aşama: Kelime ve Fonetik Eşleştirme (Levenshtein + Metaphone)</span>
                  <p className="text-xs text-slate-300 mt-1">
                    Öğrencinin söylediği metin `normalizeTurkish()` fonksiyonu ile küçük harfe ve noktalama işaretlerinden arındırılmış hale getirilir. Ardından orijinal tekerleme ile kelime kelime Levenshtein algoritmasıyla kıyaslanır. %85 üzeri benzerlik "Kusursuz", %60-84 arası "Yakın/Kısmi Doğru", %60 altı "Hatalı/Atlanmış" kabul edilir.
                  </p>
                </div>

                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-xs font-mono font-bold text-emerald-400 uppercase">3. Aşama (İleri Seviye): Whisper AI veya Bulut Analizi</span>
                  <p className="text-xs text-slate-300 mt-1">
                    Turnuva finallerinde arka planda kaydedilen ses dosyası (AAC/M4A) Whisper AI modeline gönderilerek harf ve hece bazında telaffuz analizi yapılabilir.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: REALTIME */}
          {activeTab === 'realtime' && (
            <div className="space-y-4">
              <h3 className="font-bold text-white text-base">
                Oda ve Eşzamanlı Öğrenci Yarışma Mimarisi
              </h3>
              <p className="text-xs text-slate-400">
                Öğretmen oda açar, öğrenciler 4-6 haneli PIN (Örn: <code className="text-amber-400 font-mono">DLBZ-4821</code>) ile katılır. Herkes aynı anda aynı tekerlemeyi görür.
              </p>

              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
                <div className="text-amber-400 font-bold mb-2">// WebSocket Olay Akışı (Event-Driven Architecture)</div>
                <div>1. <span className="text-cyan-400">room:create</span> → Oda ayarları (raund sayısı, süre, zorluk)</div>
                <div>2. <span className="text-cyan-400">room:join</span> → Öğrenci PIN ve avatar ile lobiye girer</div>
                <div>3. <span className="text-cyan-400">room:start_countdown</span> → 3, 2, 1 Geri sayım sinyali tüm cihazlara eşzamanlı gider</div>
                <div>4. <span className="text-cyan-400">round:deliver_twister</span> → Sunucu rastgele seçilen tekerlemeyi odaya yollar</div>
                <div>5. <span className="text-cyan-400">player:submit_result</span> → Öğrenci bitirdiğinde ses süresi ve doğruluk skoru sunucuya iletilir</div>
                <div>6. <span className="text-cyan-400">round:leaderboard</span> → Tüm öğrenciler bitirince sıralama tablosu ve puanlar gösterilir</div>
              </div>

              <div className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-xl text-xs text-rose-200">
                <strong>Anti-Cheat (Hile Önleme):</strong> İstemcinin süreyi manipüle etmesini engellemek için, süre sayacı sunucu zaman damgası (Server timestamp) ile kilitlenmelidir.
              </div>
            </div>
          )}

          {/* TAB 4: SCORING */}
          {activeTab === 'scoring' && (
            <div className="space-y-4">
              <h3 className="font-bold text-white text-base">
                Dilbaz Puanlama Formülü: Hız ve Diksiyon Dengesi
              </h3>
              <p className="text-xs text-slate-400">
                Sadece hızlı okuyan ama kelimeleri yutan öğrenci kazanamaz! En yüksek puanı <strong>hem hızlı hem de tane tane doğru okuyan</strong> öğrenci alır.
              </p>

              <div className="grid sm:grid-cols-3 gap-3">
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center">
                  <div className="text-2xl font-black text-emerald-400 font-display">%60</div>
                  <div className="text-xs font-bold text-white mt-1">Telaffuz Skoru</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Kelimelerin doğru ve eksiksiz telaffuz yüzdesi (0 - 100)
                  </div>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center">
                  <div className="text-2xl font-black text-amber-400 font-display">%40</div>
                  <div className="text-xs font-bold text-white mt-1">Hız Skoru</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Tekerlemenin ideal hedef süresine (benchmark) göre bitirme hızı
                  </div>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center">
                  <div className="text-2xl font-black text-cyan-400 font-display">+250</div>
                  <div className="text-xs font-bold text-white mt-1">Kusursuzluk Bonusu</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    %95 üzeri doğruluk ve benchmark altında bitirme rozet puanı
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-950/70 rounded-xl border border-slate-800 font-mono text-xs">
                <div className="text-slate-400 mb-1">// Dilbaz Toplam Puan Formülü:</div>
                <div className="text-amber-300 font-bold">
                  ToplamSkor = (TelaffuzSkoru × 10) + (HızSkoru × 5) + RozetBonusu
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: DB */}
          {activeTab === 'db' && (
            <div className="space-y-4">
              <h3 className="font-bold text-white text-base">
                Önerilen İlişkisel / NoSQL Veritabanı Modeli
              </h3>
              
              <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 font-mono text-xs overflow-x-auto">
                <pre className="text-slate-300">
{`-- 1. Tekerlemeler Tablosu (Tongue Twisters Pool)
CREATE TABLE tekerlemeler (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(100) NOT NULL,
  text TEXT NOT NULL,
  difficulty VARCHAR(20) NOT NULL, -- 'kolay', 'orta', 'zor', 'efsane'
  category VARCHAR(30) NOT NULL,   -- 's-s', 'p-b', 'r-l', 'c-c', 'k-g'
  benchmark_seconds NUMERIC(4,1) NOT NULL,
  tip TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Yarışma Odaları (Multiplayer Rooms)
CREATE TABLE rooms (
  code VARCHAR(10) PRIMARY KEY, -- 'DLBZ-4821'
  host_id VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'waiting', -- 'waiting', 'playing', 'finished'
  round_count INT DEFAULT 5,
  current_round INT DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Raund Skorları (Student Submissions)
CREATE TABLE round_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code VARCHAR(10) REFERENCES rooms(code),
  player_id VARCHAR(50) NOT NULL,
  player_name VARCHAR(50) NOT NULL,
  tekerleme_id UUID REFERENCES tekerlemeler(id),
  accuracy_score NUMERIC(5,2) NOT NULL,
  duration_seconds NUMERIC(5,2) NOT NULL,
  speed_score INT NOT NULL,
  total_score INT NOT NULL,
  badge VARCHAR(50)
);`}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 6: ROADMAP */}
          {activeTab === 'roadmap' && (
            <div className="space-y-4">
              <h3 className="font-bold text-white text-base">
                4 Haftalık MVP Geliştirme Yol Haritası
              </h3>
              
              <div className="grid gap-3">
                <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-xs">1</span>
                  <div>
                    <h4 className="font-bold text-white text-xs">Hafta 1: Veritabanı & Ses Tanıma Motoru</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Tekerleme veritabanını oluşturma, mobil mikrofon erişimi ve Türkçe WebSpeech/SpeechRecognizer testleri, kelime karşılaştırma algoritmasının entegrasyonu.</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0 text-xs">2</span>
                  <div>
                    <h4 className="font-bold text-white text-xs">Hafta 2: Canlı Oda & Çok Oyunculu Senkronizasyon</h4>
                    <p className="text-xs text-slate-400 mt-0.5">WebSocket veya Firebase ile oda oluşturma, PIN ile katılma, lobi ekranı ve aynı tekerlemenin tüm öğrencilere aynı anda gönderilmesi.</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">3</span>
                  <div>
                    <h4 className="font-bold text-white text-xs">Hafta 3: Mobil Oyunlaştırma, Ses Dalgaları ve Podyum</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Öğrenci avatarları, konfeti efektleri, rozetler, mikrofon görselleştiricisi ve tur sonu canlı liderlik tablosu.</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center shrink-0 text-xs">4</span>
                  <div>
                    <h4 className="font-bold text-white text-xs">Hafta 4: Sınıf İçi Pilot Test & Mağaza Yayını</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Öğretmenler ve 20-30 öğrenci ile canlı sınıf testi yapılması, gürültülü ortamlarda mikrofon hassasiyetinin kalibrasyonu ve App Store / Google Play yayını.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Dilbaz © 2026 · Tekerleme & Diksiyon Arenası
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-md transition-colors"
          >
            Uygulamayı Test Etmeye Devam Et
          </button>
        </div>
      </div>
    </div>
  );
};
