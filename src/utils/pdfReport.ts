import { jsPDF } from 'jspdf';
import { PlayerScore, Room } from '../types/game';

interface PlayerReportRow {
  playerId: string;
  playerName: string;
  totalPoints: number;
  isWinner: boolean;
  roundsPlayed: number;
  avgWpm: number;
  bestWpm: number;
  avgAccuracy: number;
  avgDuration: number;
  fastestDuration: number;
  perRound: Record<number, PlayerScore>;
}

const PAGE_W = 1240;
const PAGE_H = 1754; // A4 ratio @ 150 DPI
const MARGIN_X = 72;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

function roundOne(val: number): number {
  return Math.round(val * 10) / 10;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | CanvasGradient,
  stroke?: string,
  lineWidth = 2
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function createA4PageCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('PDF oluşturmak için Canvas bağlamı açılamadı.');
  }

  // Deep Midnight Ebru paper background for high-contrast readability
  ctx.fillStyle = '#0B1324';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  // Subtle decorative top gradient aura
  const topGrad = ctx.createLinearGradient(0, 0, PAGE_W, 240);
  topGrad.addColorStop(0, 'rgba(58, 134, 255, 0.22)');
  topGrad.addColorStop(0.5, 'rgba(255, 0, 110, 0.14)');
  topGrad.addColorStop(1, 'rgba(255, 190, 11, 0.18)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, PAGE_W, 220);

  return { canvas, ctx };
}

function drawPageHeader(
  ctx: CanvasRenderingContext2D,
  room: Room,
  subtitle: string,
  pageNumber: number
): number {
  const headerGrad = ctx.createLinearGradient(MARGIN_X, 46, PAGE_W - MARGIN_X, 178);
  headerGrad.addColorStop(0, '#14213D');
  headerGrad.addColorStop(1, '#1E293B');
  drawRoundedRect(ctx, MARGIN_X, 46, CONTENT_W, 132, 24, headerGrad, '#3A86FF', 2.5);

  ctx.fillStyle = '#FFBE0B';
  ctx.font = 'bold 34px "Fredoka", "Poppins", system-ui, sans-serif';
  ctx.fillText('DİLBAZ · AYRINTILI TURNUVA RAPORU', MARGIN_X + 28, 100);

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '600 20px "Poppins", system-ui, sans-serif';
  ctx.fillText(subtitle, MARGIN_X + 28, 134);

  const dateStr = new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date());

  ctx.fillStyle = '#00F5D4';
  ctx.font = 'bold 18px "JetBrains Mono", monospace';
  ctx.fillText(
    `Oda: ${room.code}  ·  ${room.totalRounds} Tur  ·  Tarih: ${dateStr}`,
    MARGIN_X + 28,
    162
  );

  ctx.textAlign = 'right';
  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 18px "JetBrains Mono", monospace';
  ctx.fillText(`Sayfa ${pageNumber}`, PAGE_W - MARGIN_X - 24, 96);
  ctx.textAlign = 'left';

  return 206;
}

function drawPageFooter(ctx: CanvasRenderingContext2D, roomCode: string) {
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(MARGIN_X, PAGE_H - 68);
  ctx.lineTo(PAGE_W - MARGIN_X, PAGE_H - 68);
  ctx.stroke();

  ctx.fillStyle = '#64748B';
  ctx.font = '500 16px "Poppins", system-ui, sans-serif';
  ctx.fillText(
    `Dilbaz Türkçe Tekerleme & Diksiyon Arenası · Oda ${roomCode}`,
    MARGIN_X,
    PAGE_H - 36
  );
}

function computePlayerRows(room: Room): {
  rows: PlayerReportRow[];
  rounds: number[];
} {
  const rounds = Object.keys(room.roundScores || {})
    .map((k) => Number(k))
    .filter((n) => !Number.isNaN(n) && (room.roundScores?.[n]?.length || 0) > 0)
    .sort((a, b) => a - b);

  const sortedPlayers = [...(room.players || [])].sort(
    (a, b) => (b.totalPoints || 0) - (a.totalPoints || 0)
  );
  const winnerId = room.winnerId || sortedPlayers[0]?.id || '';

  const scoresByPlayer = new Map<string, { round: number; score: PlayerScore }[]>();
  for (const r of rounds) {
    const list = room.roundScores?.[r] || [];
    for (const s of list) {
      if (!scoresByPlayer.has(s.playerId)) scoresByPlayer.set(s.playerId, []);
      scoresByPlayer.get(s.playerId)!.push({ round: r, score: s });
    }
  }
  for (const p of sortedPlayers) {
    if (!scoresByPlayer.has(p.id) && p.currentRoundScore) {
      scoresByPlayer.set(p.id, [{ round: room.currentRound || 1, score: p.currentRoundScore }]);
    }
  }

  const rows: PlayerReportRow[] = sortedPlayers.map((player) => {
    const entries = scoresByPlayer.get(player.id) || [];
    const perRound: Record<number, PlayerScore> = {};
    entries.forEach((e) => {
      perRound[e.round] = e.score;
    });

    const count = entries.length;
    const sumWpm = entries.reduce((acc, e) => acc + (Number(e.score.wpm) || 0), 0);
    const sumAcc = entries.reduce((acc, e) => acc + (Number(e.score.accuracy) || 0), 0);
    const sumDur = entries.reduce((acc, e) => acc + (Number(e.score.durationSeconds) || 0), 0);
    const bestWpm = count > 0 ? Math.max(...entries.map((e) => Number(e.score.wpm) || 0)) : 0;
    const posDurs = entries
      .map((e) => Number(e.score.durationSeconds) || 0)
      .filter((d) => d > 0);
    const fastestDuration = posDurs.length > 0 ? roundOne(Math.min(...posDurs)) : 0;

    return {
      playerId: player.id,
      playerName: player.name,
      totalPoints: Number(player.totalPoints) || 0,
      isWinner: player.id === winnerId,
      roundsPlayed: count,
      avgWpm: count > 0 ? Math.round(sumWpm / count) : 0,
      bestWpm: Math.round(bestWpm),
      avgAccuracy: count > 0 ? Math.round(sumAcc / count) : 0,
      avgDuration: count > 0 ? roundOne(sumDur / count) : 0,
      fastestDuration,
      perRound
    };
  });

  return { rows, rounds };
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}…`;
}

export async function downloadDetailedTournamentPdf(room: Room): Promise<void> {
  if (typeof document === 'undefined') return;
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready.catch(() => undefined);
  }

  const { rows, rounds } = computePlayerRows(room);
  const winner = rows[0];
  const pages: HTMLCanvasElement[] = [];

  // ==================== PAGE 1: SUMMARY + RANKINGS + COMPARISON BAR CHARTS ====================
  const page1 = createA4PageCanvas();
  let ctx = page1.ctx;
  let y = drawPageHeader(
    ctx,
    room,
    `${room.title} · Nihai Sıralama ve Performans Karşılaştırması`,
    1
  );

  // Winner Highlight Card
  if (winner) {
    const winGrad = ctx.createLinearGradient(MARGIN_X, y, PAGE_W - MARGIN_X, y + 122);
    winGrad.addColorStop(0, 'rgba(255, 190, 11, 0.22)');
    winGrad.addColorStop(1, 'rgba(255, 0, 110, 0.16)');
    drawRoundedRect(ctx, MARGIN_X, y, CONTENT_W, 122, 22, winGrad, '#FFBE0B', 2.5);

    ctx.fillStyle = '#FFBE0B';
    ctx.font = 'bold 18px "Poppins", system-ui, sans-serif';
    ctx.fillText('TURNUVA ŞAMPİYONU (SÖZ SULTANI)', MARGIN_X + 26, y + 36);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 34px "Fredoka", "Poppins", system-ui, sans-serif';
    ctx.fillText(truncateText(ctx, winner.playerName, 440), MARGIN_X + 26, y + 78);

    ctx.fillStyle = '#00F5D4';
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.fillText(
      `Toplam: ${winner.totalPoints} Puan   |   Ort. Hız: ${winner.avgWpm} WPM   |   Doğruluk: %${winner.avgAccuracy}   |   Ort. Süre: ${winner.avgDuration} sn`,
      MARGIN_X + 26,
      y + 108
    );
    y += 146;
  }

  // Rankings Table
  ctx.fillStyle = '#00F5D4';
  ctx.font = 'bold 22px "Fredoka", "Poppins", system-ui, sans-serif';
  ctx.fillText('NİHAİ TURNUVA SIRALAMASI VE ORTALAMALAR', MARGIN_X, y + 20);
  y += 36;

  // Table header
  drawRoundedRect(ctx, MARGIN_X, y, CONTENT_W, 44, 12, '#14213D', 'rgba(255,255,255,0.16)', 1.5);
  ctx.fillStyle = '#93C5FD';
  ctx.font = 'bold 17px "Poppins", system-ui, sans-serif';
  ctx.fillText('Sıra', MARGIN_X + 18, y + 28);
  ctx.fillText('Oyuncu', MARGIN_X + 86, y + 28);
  ctx.fillText('Hız (WPM)', MARGIN_X + 430, y + 28);
  ctx.fillText('En İyi Hız', MARGIN_X + 575, y + 28);
  ctx.fillText('Doğruluk', MARGIN_X + 720, y + 28);
  ctx.fillText('Ort. Süre', MARGIN_X + 845, y + 28);
  ctx.fillText('Toplam Puan', MARGIN_X + 970, y + 28);
  y += 52;

  const maxTableRows = Math.min(rows.length, 8);
  for (let idx = 0; idx < maxTableRows; idx++) {
    const r = rows[idx];
    const rowBg = r.isWinner ? 'rgba(255,190,11,0.12)' : 'rgba(255,255,255,0.04)';
    const rowStroke = r.isWinner ? 'rgba(255,190,11,0.45)' : 'rgba(255,255,255,0.09)';
    drawRoundedRect(ctx, MARGIN_X, y, CONTENT_W, 48, 12, rowBg, rowStroke, 1.5);

    ctx.fillStyle = r.isWinner ? '#FFBE0B' : '#00F5D4';
    ctx.font = 'bold 19px "JetBrains Mono", monospace';
    ctx.fillText(`#${idx + 1}`, MARGIN_X + 18, y + 31);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 19px "Poppins", system-ui, sans-serif';
    ctx.fillText(truncateText(ctx, r.playerName, 320), MARGIN_X + 86, y + 31);

    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    ctx.fillText(`${r.avgWpm}`, MARGIN_X + 430, y + 31);

    ctx.fillStyle = '#93C5FD';
    ctx.fillText(`${r.bestWpm}`, MARGIN_X + 575, y + 31);

    ctx.fillStyle = '#06D6A0';
    ctx.fillText(`%${r.avgAccuracy}`, MARGIN_X + 720, y + 31);

    ctx.fillStyle = '#F472B6';
    ctx.fillText(`${r.avgDuration} sn`, MARGIN_X + 845, y + 31);

    ctx.fillStyle = '#FFBE0B';
    ctx.fillText(`${r.totalPoints} p`, MARGIN_X + 970, y + 31);

    y += 56;
  }

  y += 18;

  // Comparison Bar Charts Section (WPM, Accuracy, Duration)
  ctx.fillStyle = '#00F5D4';
  ctx.font = 'bold 22px "Fredoka", "Poppins", system-ui, sans-serif';
  ctx.fillText('KARŞILAŞTIRMALI PERFORMANS GRAFİKLERİ (HIZ · DOĞRULUK · TEPKİ SÜRESİ)', MARGIN_X, y + 20);
  y += 36;

  const chartPlayers = rows.slice(0, 6);
  const maxWpm = Math.max(60, ...chartPlayers.map((p) => p.avgWpm));
  const maxDur = Math.max(
    room.settings?.timeLimitSeconds || 10,
    ...chartPlayers.map((p) => p.avgDuration)
  );

  const cardH = 38 + chartPlayers.length * 42 + 16;
  const availableChartsH = PAGE_H - 92 - y;

  if (chartPlayers.length > 0 && cardH <= availableChartsH) {
    drawRoundedRect(ctx, MARGIN_X, y, CONTENT_W, cardH, 18, '#111C33', 'rgba(58,134,255,0.35)', 1.5);
    const barZoneX = MARGIN_X + 230;
    const colW = 260;

    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 16px "Poppins", system-ui, sans-serif';
    ctx.fillText('HIZ (WPM)', barZoneX, y + 28);

    ctx.fillStyle = '#06D6A0';
    ctx.fillText('DOĞRULUK (%)', barZoneX + colW + 24, y + 28);

    ctx.fillStyle = '#FF006E';
    ctx.fillText('TEPKİ SÜRESİ (SN)', barZoneX + (colW + 24) * 2, y + 28);

    let barY = y + 48;
    for (const p of chartPlayers) {
      ctx.fillStyle = p.isWinner ? '#FFBE0B' : '#F8FAFC';
      ctx.font = 'bold 16px "Poppins", system-ui, sans-serif';
      ctx.fillText(truncateText(ctx, p.playerName, 200), MARGIN_X + 20, barY + 20);

      // Bar 1: WPM
      drawRoundedRect(ctx, barZoneX, barY + 4, colW - 65, 22, 8, 'rgba(255,255,255,0.07)');
      const wpmW = Math.max(8, Math.round(((colW - 65) * p.avgWpm) / maxWpm));
      drawRoundedRect(ctx, barZoneX, barY + 4, wpmW, 22, 8, '#3A86FF');
      ctx.fillStyle = '#E0F2FE';
      ctx.font = 'bold 15px "JetBrains Mono", monospace';
      ctx.fillText(`${p.avgWpm}`, barZoneX + colW - 56, barY + 21);

      // Bar 2: Accuracy
      const accX = barZoneX + colW + 24;
      drawRoundedRect(ctx, accX, barY + 4, colW - 65, 22, 8, 'rgba(255,255,255,0.07)');
      const accW = Math.max(8, Math.round(((colW - 65) * p.avgAccuracy) / 100));
      drawRoundedRect(ctx, accX, barY + 4, accW, 22, 8, '#06D6A0');
      ctx.fillStyle = '#D1FAE5';
      ctx.fillText(`%${p.avgAccuracy}`, accX + colW - 56, barY + 21);

      // Bar 3: Duration
      const durX = barZoneX + (colW + 24) * 2;
      drawRoundedRect(ctx, durX, barY + 4, colW - 65, 22, 8, 'rgba(255,255,255,0.07)');
      const durW = Math.max(8, Math.round(((colW - 65) * p.avgDuration) / maxDur));
      drawRoundedRect(ctx, durX, barY + 4, durW, 22, 8, '#FF006E');
      ctx.fillStyle = '#FCE7F3';
      ctx.fillText(`${p.avgDuration}s`, durX + colW - 56, barY + 21);

      barY += 42;
    }
  }

  drawPageFooter(ctx, room.code);
  pages.push(page1.canvas);

  // ==================== PAGE 2+: ROUND-BY-ROUND BREAKDOWN ====================
  if (rounds.length > 0 && rows.length > 0) {
    let pageNum = 2;
    let currentPage = createA4PageCanvas();
    ctx = currentPage.ctx;
    y = drawPageHeader(
      ctx,
      room,
      `${room.title} · Tur Bazlı Detaylı Okuma Analizi`,
      pageNum
    );

    const flushPage = () => {
      drawPageFooter(ctx, room.code);
      pages.push(currentPage.canvas);
      pageNum += 1;
      currentPage = createA4PageCanvas();
      ctx = currentPage.ctx;
      y = drawPageHeader(
        ctx,
        room,
        `${room.title} · Tur Bazlı Detaylı Okuma Analizi (Devam)`,
        pageNum
      );
    };

    for (const roundNum of rounds) {
      const roundScores = room.roundScores?.[roundNum] || [];
      if (roundScores.length === 0) continue;

      const sortedRound = [...roundScores].sort((a, b) => b.totalScore - a.totalScore);
      const neededHeight = 70 + sortedRound.length * 46 + 24;
      if (y + neededHeight > PAGE_H - 96) {
        flushPage();
      }

      drawRoundedRect(
        ctx,
        MARGIN_X,
        y,
        CONTENT_W,
        neededHeight - 16,
        18,
        '#111C33',
        'rgba(255, 190, 11, 0.35)',
        1.5
      );

      ctx.fillStyle = '#FFBE0B';
      ctx.font = 'bold 20px "Fredoka", "Poppins", system-ui, sans-serif';
      ctx.fillText(`${roundNum}. TUR SONUÇLARI`, MARGIN_X + 22, y + 36);

      ctx.fillStyle = '#93C5FD';
      ctx.font = '600 15px "Poppins", system-ui, sans-serif';
      ctx.fillText(
        `${sortedRound.length} katılımcı performans kaydı`,
        MARGIN_X + 240,
        y + 35
      );

      let ry = y + 58;
      for (let i = 0; i < sortedRound.length; i++) {
        const s = sortedRound[i];
        drawRoundedRect(
          ctx,
          MARGIN_X + 18,
          ry,
          CONTENT_W - 36,
          38,
          10,
          i === 0 ? 'rgba(6, 214, 160, 0.14)' : 'rgba(255, 255, 255, 0.04)'
        );

        ctx.fillStyle = i === 0 ? '#06D6A0' : '#94A3B8';
        ctx.font = 'bold 16px "JetBrains Mono", monospace';
        ctx.fillText(`#${i + 1}`, MARGIN_X + 32, ry + 25);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px "Poppins", system-ui, sans-serif';
        ctx.fillText(truncateText(ctx, s.playerName, 250), MARGIN_X + 82, ry + 25);

        ctx.fillStyle = '#38BDF8';
        ctx.font = 'bold 15px "JetBrains Mono", monospace';
        ctx.fillText(`Hız: ${s.wpm} WPM`, MARGIN_X + 355, ry + 25);

        ctx.fillStyle = '#06D6A0';
        ctx.fillText(`Doğruluk: %${s.accuracy}`, MARGIN_X + 515, ry + 25);

        ctx.fillStyle = '#F472B6';
        ctx.fillText(`Süre: ${s.durationSeconds} sn`, MARGIN_X + 680, ry + 25);

        ctx.fillStyle = '#FFBE0B';
        ctx.fillText(`Puan: +${s.totalScore}`, MARGIN_X + 840, ry + 25);

        if (s.badge) {
          ctx.fillStyle = '#FDE68A';
          ctx.font = '600 14px "Poppins", system-ui, sans-serif';
          ctx.fillText(truncateText(ctx, s.badge, 140), MARGIN_X + 965, ry + 24);
        }

        ry += 44;
      }

      y += neededHeight;
    }

    drawPageFooter(ctx, room.code);
    pages.push(currentPage.canvas);
  }

  // Export multi-page A4 PDF
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  pages.forEach((pageCanvas, index) => {
    if (index > 0) pdf.addPage();
    const imgData = pageCanvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
  });

  const safeCode = (room.code || 'TURNUVA').replace(/[^A-Z0-9_-]/gi, '');
  pdf.save(`Dilbaz-Rapor-${safeCode}.pdf`);
}
