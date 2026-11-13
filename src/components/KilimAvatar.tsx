import React from 'react';

export interface KilimMotif {
  id: string;
  name: string;
  meaningTag: string;
  description: string;
  accentColor: string;
}

export const KILIM_MOTIFS: KilimMotif[] = [
  {
    id: 'kilim-elibelinde',
    name: 'Elibelinde',
    meaningTag: 'Analık & Bereket',
    description:
      'Anadolu kilim dokumalarında analığın, bereketin ve doğurganlığın simgesidir. Elleri belinde duran figür; koruyuculuğu, üretkenliği ve yaşam sevincini anlatır.',
    accentColor: '#FF006E'
  },
  {
    id: 'kilim-kocboynuzu',
    name: 'Koçboynuzu',
    meaningTag: 'Güç & Cesaret',
    description:
      'Güç, yiğitlik, kahramanlık ve cesaretin sembolüdür. İki yana açılan kıvrımlı boynuz formu, zorluklar karşısında kararlı ve özgüvenli duruşu simgeler.',
    accentColor: '#FFBE0B'
  },
  {
    id: 'kilim-hayatagaci',
    name: 'Hayat Ağacı',
    meaningTag: 'Bilgelik & Gelişim',
    description:
      'Kökleri yeryüzüne, dalları gökyüzüne uzanan ölümsüzlük, bilgelik ve sürekli gelişim simgesidir. Geçmiş ile geleceği birbirine bağlayan bilgi köprüsünü temsil eder.',
    accentColor: '#06D6A0'
  },
  {
    id: 'kilim-pitrak',
    name: 'Pıtrak',
    meaningTag: 'Korunma & Bolluk',
    description:
      'Tarlalarda giysilere tutunan dikenli pıtrak bitkisinden esinlenilmiştir. Kem gözleri uzaklaştırdığına, aynı zamanda bolluk ve bereket getirdiğine inanılır.',
    accentColor: '#FF5400'
  },
  {
    id: 'kilim-yildiz',
    name: 'Yıldız',
    meaningTag: 'Aydınlık & Umut',
    description:
      'Sekiz köşeli Anadolu yıldızı; yol göstericiliği, umudu, üretkenliği ve aydınlık zihni sembolize eder. Başarı ve parlak geleceğin habercisidir.',
    accentColor: '#3A86FF'
  },
  {
    id: 'kilim-goz',
    name: 'Göz (Nazarlık)',
    meaningTag: 'Odak & Koruma',
    description:
      'İç içe geçen eşkenar dörtgen ve üçgen formlarıyla dikkati, keskin gözlemi ve kötü bakışlara karşı korunmayı temsil eden geleneksel nazar motifidir.',
    accentColor: '#00F5D4'
  },
  {
    id: 'kilim-suyolu',
    name: 'Su Yolu',
    meaningTag: 'Akıcılık & Yaşam',
    description:
      'Zikzak ve dalgalı akışıyla yaşamın kaynağı olan suyu, arınmayı, sürekliliği ve tıpkı su gibi akıcı konuşmayı temsil eden kilim bordür motifidir.',
    accentColor: '#38BDF8'
  },
  {
    id: 'kilim-kus',
    name: 'Turna Kuşu',
    meaningTag: 'Özgürlük & Söz',
    description:
      'Özgürlüğün, güzel haberlerin, iyi şansın ve gökyüzüne yükselen zarif sözlerin elçisidir. Anadolu dokumalarında sevinci ve dostluğu simgeler.',
    accentColor: '#A855F7'
  }
];

export function getKilimMotif(avatarIdOrEmoji?: string): KilimMotif | undefined {
  if (!avatarIdOrEmoji) return undefined;
  return KILIM_MOTIFS.find((m) => m.id === avatarIdOrEmoji);
}

interface KilimAvatarProps {
  avatar?: string;
  size?: number;
  className?: string;
}

export const KilimAvatar: React.FC<KilimAvatarProps> = ({
  avatar = 'kilim-elibelinde',
  size = 40,
  className = ''
}) => {
  const motif = getKilimMotif(avatar);

  // Backward compatibility if a legacy room has an emoji avatar
  if (!motif) {
    return (
      <span
        className={`inline-flex items-center justify-center select-none ${className}`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.56) }}
      >
        {avatar}
      </span>
    );
  }

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={motif.name}
    >
      {/* Dokuma Kilim Zemini */}
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#14213D" stroke={motif.accentColor} strokeWidth="2.5" />
      <rect x="6" y="6" width="52" height="52" rx="10" stroke="rgba(255,255,255,0.16)" strokeWidth="1" strokeDasharray="3 2" />

      {motif.id === 'kilim-elibelinde' && (
        <g>
          {/* Baş ve Taç */}
          <polygon points="32,10 38,17 32,23 26,17" fill="#FFBE0B" />
          {/* Gövde ve Elbise Üçgeni */}
          <polygon points="24,25 40,25 35,38 29,38" fill="#FF006E" />
          <polygon points="27,38 37,38 44,52 20,52" fill="#3A86FF" />
          {/* Beldeki Kıvrımlı Kollar */}
          <path d="M24 26 L13 33 L21 41 L28 36" stroke="#00F5D4" strokeWidth="3.2" strokeLinecap="square" strokeLinejoin="miter" />
          <path d="M40 26 L51 33 L43 41 L36 36" stroke="#00F5D4" strokeWidth="3.2" strokeLinecap="square" strokeLinejoin="miter" />
          {/* İç Bereket Noktası */}
          <polygon points="32,42 35,46 32,50 29,46" fill="#FFBE0B" />
        </g>
      )}

      {motif.id === 'kilim-kocboynuzu' && (
        <g>
          {/* Merkez Gövde Eşkenarı */}
          <polygon points="32,25 39,32 32,40 25,32" fill="#FF006E" />
          {/* Sol ve Sağ Kıvrımlı Boynuzlar */}
          <path d="M27 28 L16 18 L12 24 L18 32 L13 38" stroke="#FFBE0B" strokeWidth="3.5" strokeLinecap="square" />
          <path d="M37 28 L48 18 L52 24 L46 32 L51 38" stroke="#FFBE0B" strokeWidth="3.5" strokeLinecap="square" />
          {/* Alt Dayanıklılık Kaidesi */}
          <path d="M24 44 L32 52 L40 44" stroke="#00F5D4" strokeWidth="3" strokeLinecap="square" />
          <polygon points="32,12 36,18 32,22 28,18" fill="#3A86FF" />
        </g>
      )}

      {motif.id === 'kilim-hayatagaci' && (
        <g>
          {/* Merkez Gövde */}
          <line x1="32" y1="12" x2="32" y2="52" stroke="#FFBE0B" strokeWidth="3.2" />
          {/* Üst Dallar */}
          <path d="M32 21 L20 14 M32 21 L44 14" stroke="#06D6A0" strokeWidth="3" strokeLinecap="square" />
          {/* Orta Dallar */}
          <path d="M32 33 L15 24 M32 33 L49 24" stroke="#00F5D4" strokeWidth="3" strokeLinecap="square" />
          {/* Kökler */}
          <path d="M32 45 L18 52 M32 45 L46 52" stroke="#FF006E" strokeWidth="3" strokeLinecap="square" />
          {/* Tepe Meyvesi / Yıldızı */}
          <polygon points="32,8 36,13 32,18 28,13" fill="#FF006E" />
          <circle cx="20" cy="14" r="2.3" fill="#FFBE0B" />
          <circle cx="44" cy="14" r="2.3" fill="#FFBE0B" />
        </g>
      )}

      {motif.id === 'kilim-pitrak' && (
        <g>
          {/* Merkez Çokgen */}
          <polygon points="32,17 47,32 32,47 17,32" fill="#FF5400" stroke="#FFBE0B" strokeWidth="2" />
          <polygon points="32,24 40,32 32,40 24,32" fill="#14213D" />
          <polygon points="32,27 37,32 32,37 27,32" fill="#00F5D4" />
          {/* Koruyucu Diken Çentikleri */}
          <path d="M32 10 V17 M32 47 V54 M10 32 H17 M47 32 H54" stroke="#FF006E" strokeWidth="3" />
          <path d="M17 17 L22 22 M47 17 L42 22 M17 47 L22 42 M47 47 L42 42" stroke="#FFBE0B" strokeWidth="2.8" />
        </g>
      )}

      {motif.id === 'kilim-yildiz' && (
        <g>
          {/* Sekiz Köşeli Anadolu Yıldızı (Kare + Döndürülmüş Kare) */}
          <rect x="20" y="20" width="24" height="24" fill="#3A86FF" stroke="#00F5D4" strokeWidth="2" />
          <rect x="20" y="20" width="24" height="24" transform="rotate(45 32 32)" fill="#FF006E" fillOpacity="0.85" stroke="#FFBE0B" strokeWidth="2" />
          <polygon points="32,24 40,32 32,40 24,32" fill="#FFBE0B" />
          <circle cx="32" cy="32" r="3.5" fill="#14213D" />
        </g>
      )}

      {motif.id === 'kilim-goz' && (
        <g>
          {/* Dış Koruyucu Eşkenar */}
          <polygon points="32,11 53,32 32,53 11,32" fill="#3A86FF" stroke="#00F5D4" strokeWidth="2.2" />
          <polygon points="32,18 46,32 32,46 18,32" fill="#EDF2F4" />
          <polygon points="32,23 41,32 32,41 23,32" fill="#FFBE0B" />
          <polygon points="32,27 37,32 32,37 27,32" fill="#14213D" />
          {/* Yan Göz Kanatları */}
          <path d="M11 32 L15 26 M11 32 L15 38 M53 32 L49 26 M53 32 L49 38" stroke="#FF006E" strokeWidth="2.2" />
        </g>
      )}

      {motif.id === 'kilim-suyolu' && (
        <g>
          {/* Üç Katmanlı Zikzak Su Yolu */}
          <polyline points="10,22 21,13 32,22 43,13 54,22" stroke="#00F5D4" strokeWidth="3.2" strokeLinecap="square" strokeLinejoin="miter" />
          <polyline points="10,34 21,25 32,34 43,25 54,34" stroke="#3A86FF" strokeWidth="3.5" strokeLinecap="square" strokeLinejoin="miter" />
          <polyline points="10,46 21,37 32,46 43,37 54,46" stroke="#FFBE0B" strokeWidth="3.2" strokeLinecap="square" strokeLinejoin="miter" />
          {/* Su Damlaları */}
          <polygon points="21,18 24,22 21,26 18,22" fill="#FF006E" />
          <polygon points="43,30 46,34 43,38 40,34" fill="#FF006E" />
        </g>
      )}

      {motif.id === 'kilim-kus' && (
        <g>
          {/* Çift Stilize Kuş / Turna Kanatları */}
          <path d="M14 26 L26 20 L32 29 L38 20 L50 26" stroke="#00F5D4" strokeWidth="3.2" strokeLinecap="square" />
          {/* Gövde ve Kuyruk */}
          <polygon points="32,16 39,30 32,44 25,30" fill="#A855F7" stroke="#FFBE0B" strokeWidth="1.8" />
          <path d="M32 44 L22 52 M32 44 L42 52" stroke="#FF006E" strokeWidth="3" strokeLinecap="square" />
          {/* Kuşbaşı */}
          <circle cx="32" cy="14" r="3.5" fill="#FFBE0B" />
        </g>
      )}
    </svg>
  );
};
