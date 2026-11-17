import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  PhoenixFeatherPalette,
  PhoenixWingPattern,
  getFeatherPalette,
  getPhoenixFlapSpeed
} from '../utils/phoenixProgression';
import { Eye, RotateCcw } from 'lucide-react';

export type PhoenixCameraPreset = 'overview' | 'wings' | 'crest';

interface Phoenix3DViewerProps {
  level: number;
  stageName: string;
  auraId: string;
  auraRank: number;
  talismanId: string;
  talismanRank: number;
  crestId: string;
  crestRank: number;
  featherPaletteId: string;
  wingPatternId: PhoenixWingPattern['id'];
  isPreviewing: boolean;
  previewItemName?: string | null;
  onResetPreview?: () => void;
}

const CAMERA_PRESETS: Record<
  PhoenixCameraPreset,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  overview: { pos: [0.18, 1.62, 4.95], target: [0, 1.34, 0] },
  wings: { pos: [2.35, 1.88, 3.75], target: [0, 1.48, 0] },
  crest: { pos: [0.68, 2.18, 2.28], target: [0.06, 1.72, 0.14] }
};

// Pre-allocated math helpers outside animation loop (zero GC)
const _camGoalPos = new THREE.Vector3();
const _camGoalTarget = new THREE.Vector3();
const _moteDummy = new THREE.Object3D();

function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

function createEbruPedestalTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 256);
  grad.addColorStop(0, '#1e3a6e');
  grad.addColorStop(0.55, '#122244');
  grad.addColorStop(1, '#091022');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  const ringColors = [
    'rgba(0,245,212,0.4)',
    'rgba(58,134,255,0.34)',
    'rgba(255,190,11,0.42)',
    'rgba(255,0,110,0.3)'
  ];
  for (let i = 0; i < 14; i += 1) {
    ctx.beginPath();
    const r = 42 + i * 15;
    for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.1) {
      const wobble = Math.sin(a * 5 + i * 0.9) * 5 + Math.cos(a * 3 - i * 0.5) * 3;
      const x = 256 + Math.cos(a) * (r + wobble);
      const y = 256 + Math.sin(a) * (r + wobble);
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = ringColors[i % ringColors.length];
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255, 190, 11, 0.82)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * Math.PI * 2;
    const inner = i % 3 === 0 ? 208 : 222;
    ctx.beginPath();
    ctx.moveTo(256 + Math.cos(a) * inner, 256 + Math.sin(a) * inner);
    ctx.lineTo(256 + Math.cos(a) * 238, 256 + Math.sin(a) * 238);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function createBirdPlumageTexture(
  palette: PhoenixFeatherPalette,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const baseGrad = ctx.createLinearGradient(0, 0, 512, 512);
  baseGrad.addColorStop(0, palette.primaryColor);
  baseGrad.addColorStop(0.45, palette.secondaryColor);
  baseGrad.addColorStop(0.8, palette.bodyBaseColor);
  baseGrad.addColorStop(1, palette.primaryColor);
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, 512, 512);

  // Flowing Ottoman Ebru marbling spirals & combed waves (high-chroma logo chest plumage)
  const [c0, c1, c2, c3] = palette.swirlColors;
  const swirlList = [c0, c1, c3, c2, c0, c1];
  for (let i = 0; i < 20; i += 1) {
    ctx.beginPath();
    const yStart = (i / 20) * 550 - 20;
    ctx.moveTo(-20, yStart);
    for (let x = 0; x <= 540; x += 18) {
      const wave =
        Math.sin(x * 0.022 + i * 0.72) * 38 +
        Math.cos(x * 0.041 - i * 0.48) * 22;
      ctx.lineTo(x, yStart + wave);
    }
    ctx.strokeStyle = swirlList[i % swirlList.length];
    ctx.globalAlpha = i % 2 === 0 ? 0.78 : 0.55;
    ctx.lineWidth = 15 + (i % 4) * 5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Signature Dilbaz gold filigree hairlines inside the Ebru marbling
  ctx.globalAlpha = 0.78;
  ctx.strokeStyle = palette.accentColor;
  ctx.lineWidth = 3;
  for (let i = 0; i < 12; i += 1) {
    ctx.beginPath();
    const y0 = 22 + i * 42;
    ctx.moveTo(0, y0);
    for (let x = 0; x <= 512; x += 16) {
      ctx.lineTo(x, y0 + Math.sin(x * 0.026 + i * 0.85) * 24);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function createFeatherPatternTexture(
  palette: PhoenixFeatherPalette,
  patternId: PhoenixWingPattern['id'],
  variant: 'primary' | 'secondary',
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const cLead = variant === 'primary' ? palette.primaryColor : palette.secondaryColor;
  const cMid = variant === 'primary' ? palette.swirlColors[2] : palette.primaryColor;
  const cRoot = palette.bodyBaseColor;

  // Root-to-tip luminous gradient (u=0 root -> u=1 tip)
  const g = ctx.createLinearGradient(0, 128, 512, 128);
  g.addColorStop(0, cRoot);
  g.addColorStop(0.28, cMid);
  g.addColorStop(0.72, cLead);
  g.addColorStop(1, palette.accentColor);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);

  if (patternId === 'ebru_wave') {
    const bands =
      variant === 'primary'
        ? [palette.primaryColor, palette.secondaryColor, palette.swirlColors[2], palette.accentColor]
        : [palette.secondaryColor, palette.accentColor, palette.primaryColor, palette.swirlColors[2]];
    for (let i = 0; i < 8; i += 1) {
      ctx.beginPath();
      const yBase = 24 + i * 30;
      ctx.moveTo(0, yBase);
      for (let x = 0; x <= 512; x += 16) {
        ctx.lineTo(x, yBase + Math.sin(x * 0.03 + i * 0.9) * 20);
      }
      ctx.strokeStyle = bands[i % bands.length];
      ctx.globalAlpha = 0.72;
      ctx.lineWidth = 11;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (patternId === 'peacock_eye') {
    const centers = [
      { x: 205, y: 128, rx: 44, ry: 34 },
      { x: 378, y: 128, rx: 64, ry: 48 }
    ];
    for (const c of centers) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.fillStyle = palette.accentColor;
      ctx.beginPath();
      ctx.ellipse(0, 0, c.rx, c.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = palette.secondaryColor;
      ctx.beginPath();
      ctx.ellipse(-4, 0, c.rx * 0.76, c.ry * 0.76, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = palette.primaryColor;
      ctx.beginPath();
      ctx.ellipse(-6, 0, c.rx * 0.5, c.ry * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#091022';
      ctx.beginPath();
      ctx.ellipse(-8, 0, c.rx * 0.27, c.ry * 0.29, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (patternId === 'flame_streak') {
    for (let i = 0; i < 10; i += 1) {
      const y = 22 + i * 23;
      const fg = ctx.createLinearGradient(70, y, 512, y);
      fg.addColorStop(0, 'rgba(255, 190, 11, 0)');
      fg.addColorStop(0.55, palette.accentColor);
      fg.addColorStop(1, '#FFFBEB');
      ctx.strokeStyle = fg;
      ctx.lineWidth = i % 2 === 0 ? 7 : 4;
      ctx.beginPath();
      ctx.moveTo(40 + i * 16, y);
      ctx.quadraticCurveTo(280, y + (i % 2 === 0 ? -18 : 18), 512, y);
      ctx.stroke();
    }
  } else if (patternId === 'royal_filigree') {
    ctx.strokeStyle = '#FFBE0B';
    ctx.lineWidth = 4.5;
    for (let x = 70; x <= 440; x += 92) {
      ctx.beginPath();
      ctx.moveTo(x, 42);
      ctx.quadraticCurveTo(x + 38, 128, x, 214);
      ctx.quadraticCurveTo(x - 38, 128, x, 42);
      ctx.stroke();

      ctx.fillStyle = '#FFF3B0';
      ctx.beginPath();
      ctx.arc(x, 128, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (patternId === 'star_bolt') {
    ctx.strokeStyle = '#FFFBEB';
    ctx.lineWidth = 5;
    for (let x = 90; x <= 430; x += 85) {
      ctx.beginPath();
      ctx.moveTo(x - 26, 56);
      ctx.lineTo(x + 22, 128);
      ctx.lineTo(x - 26, 200);
      ctx.stroke();

      ctx.fillStyle = palette.accentColor;
      ctx.beginPath();
      ctx.arc(x + 26, 128, 6.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Diagonal feather barbs
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 1.8;
  for (let x = 18; x < 480; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 128);
    ctx.lineTo(x + 38, 18);
    ctx.moveTo(x, 128);
    ctx.lineTo(x + 38, 238);
    ctx.stroke();
  }

  // Crisp Gold Outer Rim + Central Rachis Shaft (hugs exact local-width feather UV!)
  const rimGrad = ctx.createLinearGradient(0, 0, 512, 0);
  rimGrad.addColorStop(0, palette.accentColor);
  rimGrad.addColorStop(0.6, '#FFE58F');
  rimGrad.addColorStop(1, '#FFF8D6');
  ctx.fillStyle = rimGrad;
  ctx.fillRect(0, 0, 512, 18);
  ctx.fillRect(0, 238, 512, 18);
  ctx.fillRect(482, 0, 30, 256);

  ctx.fillStyle = '#FFF3B0';
  ctx.fillRect(0, 124, 488, 8);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function createCrestPlumeTexture(
  palette: PhoenixFeatherPalette,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const g = ctx.createLinearGradient(0, 128, 512, 128);
  g.addColorStop(0, palette.secondaryColor);
  g.addColorStop(0.55, palette.swirlColors[1] || palette.secondaryColor);
  g.addColorStop(0.84, '#FF8C42');
  g.addColorStop(1, palette.accentColor);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);

  // Subtle Ebru streak along crest plume
  ctx.strokeStyle = palette.accentColor;
  ctx.globalAlpha = 0.65;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(16, 128);
  ctx.quadraticCurveTo(260, 88, 496, 128);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Gold edge trim matching logo pink-to-gold crown feathers
  ctx.fillStyle = palette.accentColor;
  ctx.fillRect(0, 0, 512, 16);
  ctx.fillRect(0, 240, 512, 16);
  ctx.fillRect(474, 0, 38, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function createTailPlumeTexture(
  palette: PhoenixFeatherPalette,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const g = ctx.createLinearGradient(0, 128, 512, 128);
  g.addColorStop(0, palette.bodyBaseColor);
  g.addColorStop(0.32, palette.secondaryColor);
  g.addColorStop(0.68, palette.primaryColor);
  g.addColorStop(1, palette.accentColor);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);

  // Flowing marbling veins
  for (let i = 0; i < 6; i += 1) {
    ctx.beginPath();
    const y0 = 32 + i * 38;
    ctx.moveTo(0, y0);
    for (let x = 0; x <= 512; x += 20) {
      ctx.lineTo(x, y0 + Math.sin(x * 0.025 + i) * 14);
    }
    ctx.strokeStyle = i % 2 === 0 ? palette.primaryColor : palette.secondaryColor;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 8;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Signature Peacock-Eye Ocellus near tail plume tip (u ~ 0.77)
  ctx.save();
  ctx.translate(388, 128);
  ctx.fillStyle = palette.accentColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, 82, 62, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = palette.secondaryColor;
  ctx.beginPath();
  ctx.ellipse(-6, 0, 62, 46, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = palette.primaryColor;
  ctx.beginPath();
  ctx.ellipse(-10, 0, 40, 30, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#091022';
  ctx.beginPath();
  ctx.ellipse(-14, 0, 20, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(-20, -6, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Gold rim + central spine
  ctx.fillStyle = palette.accentColor;
  ctx.fillRect(0, 0, 512, 16);
  ctx.fillRect(0, 240, 512, 16);
  ctx.fillRect(486, 0, 26, 256);
  ctx.fillStyle = '#FFF3B0';
  ctx.fillRect(0, 125, 320, 6);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 16, 128, 128, 124);
  g.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  g.addColorStop(0.55, 'rgba(6, 12, 26, 0.34)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Builds a symmetric extruded feather blade, computes distortion-free local-width UVs
 * (v = 0 bottom edge, v = 0.5 quill spine, v = 1 top edge), and then bends it in 3D.
 */
function createCurvedFeatherGeometry(params: {
  length: number;
  width: number;
  curveY: number;
  camberZ?: number;
  waveY?: number;
  flareTip?: boolean;
}): THREE.ExtrudeGeometry {
  const { length, width, curveY, camberZ = 0.04, waveY = 0, flareTip = false } = params;
  const shape = new THREE.Shape();
  const midWidth = flareTip ? width * 0.42 : width * 0.56;
  const tipBulb = flareTip ? width * 0.64 : width * 0.32;

  shape.moveTo(0, 0);
  shape.bezierCurveTo(
    length * 0.24,
    midWidth,
    length * 0.76,
    tipBulb,
    length,
    0
  );
  shape.bezierCurveTo(
    length * 0.76,
    -tipBulb * 0.92,
    length * 0.24,
    -midWidth * 0.92,
    0,
    0
  );

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.016,
    bevelEnabled: true,
    bevelThickness: 0.007,
    bevelSize: 0.007,
    bevelSegments: 2,
    curveSegments: 20
  });
  geo.translate(0, 0, -0.008);

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const BUCKETS = 32;
  const minYPerBucket = new Float32Array(BUCKETS + 1).fill(Infinity);
  const maxYPerBucket = new Float32Array(BUCKETS + 1).fill(-Infinity);

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const u = THREE.MathUtils.clamp(x / length, 0, 1);
    const b = Math.min(BUCKETS, Math.round(u * BUCKETS));
    if (y < minYPerBucket[b]) minYPerBucket[b] = y;
    if (y > maxYPerBucket[b]) maxYPerBucket[b] = y;
  }

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const u = THREE.MathUtils.clamp(x / length, 0, 1);
    const b = Math.min(BUCKETS, Math.round(u * BUCKETS));
    const yMin = minYPerBucket[b];
    const yMax = maxYPerBucket[b];
    const span = yMax - yMin;
    const v = span > 0.002 ? THREE.MathUtils.clamp((y - yMin) / span, 0, 1) : 0.5;
    uv.setXY(i, u, v);

    const bendY = curveY * Math.pow(u, 1.55) + waveY * Math.sin(u * Math.PI * 1.65);
    const cupZ = camberZ * Math.sin(u * Math.PI);
    const tipTaper = 1 - u * 0.35;
    pos.setXYZ(i, x, y + bendY, z * tipTaper + cupZ);
  }

  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

function createSculptedHookedBeakGeometry(): THREE.ExtrudeGeometry {
  // Side profile in XY plane (X = forward before -PI/2 Y-rotation, Y = up)
  const shape = new THREE.Shape();
  shape.moveTo(-0.02, 0.095);
  shape.bezierCurveTo(0.09, 0.115, 0.215, 0.055, 0.235, -0.105);
  shape.bezierCurveTo(0.205, -0.135, 0.175, -0.075, 0.145, -0.028);
  shape.bezierCurveTo(0.095, -0.008, 0.03, -0.014, -0.02, -0.018);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.11,
    bevelEnabled: true,
    bevelThickness: 0.026,
    bevelSize: 0.02,
    bevelSegments: 3,
    curveSegments: 22
  });
  geo.translate(0, 0, -0.055);

  // Smooth lateral taper toward the hooked tip so it reads like a natural sculpted macaw beak
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = THREE.MathUtils.clamp((x + 0.02) / 0.26, 0, 1);
    const lateralScale = 1 - Math.pow(t, 1.25) * 0.86;
    pos.setXYZ(i, x, y, z * lateralScale);
  }
  pos.needsUpdate = true;
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function createSculptedLowerMandibleGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.015, -0.012);
  shape.bezierCurveTo(0.055, -0.01, 0.125, -0.025, 0.138, -0.068);
  shape.bezierCurveTo(0.092, -0.095, 0.028, -0.088, -0.015, -0.068);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.082,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.014,
    bevelSegments: 2,
    curveSegments: 14
  });
  geo.translate(0, 0, -0.041);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = THREE.MathUtils.clamp((x + 0.015) / 0.16, 0, 1);
    const lateralScale = 1 - Math.pow(t, 1.2) * 0.78;
    pos.setXYZ(i, x, y, z * lateralScale);
  }
  pos.needsUpdate = true;
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function createSculptedTorsoGeometry(): THREE.LatheGeometry {
  const torsoPoints = [
    new THREE.Vector2(0.01, -0.38),
    new THREE.Vector2(0.14, -0.32),
    new THREE.Vector2(0.26, -0.15),
    new THREE.Vector2(0.325, 0.04),
    new THREE.Vector2(0.305, 0.23),
    new THREE.Vector2(0.225, 0.39),
    new THREE.Vector2(0.165, 0.52),
    new THREE.Vector2(0.01, 0.56)
  ];
  const geo = new THREE.LatheGeometry(torsoPoints, 36);
  const pos = geo.attributes.position;
  // Subtle avian S-curve: puff breast forward (+Z) and sweep neck slightly forward-up
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const chestBulge = Math.exp(-Math.pow((y - 0.12) / 0.24, 2)) * 0.055;
    const neckCurve = y > 0.28 ? (y - 0.28) * 0.12 : 0;
    pos.setXYZ(i, x * 0.94, y, z * 1.06 + chestBulge + neckCurve);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function createLightningBoltGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0.05, 0.24);
  shape.lineTo(-0.14, 0.01);
  shape.lineTo(-0.02, 0.01);
  shape.lineTo(-0.07, -0.24);
  shape.lineTo(0.14, -0.01);
  shape.lineTo(0.02, -0.01);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.045,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.01,
    bevelSegments: 2
  });
  geo.center();
  return geo;
}

function createCrownSpireGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.065, 0);
  shape.lineTo(0, 0.24);
  shape.lineTo(0.065, 0);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.026,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.006,
    bevelSegments: 2
  });
  geo.center();
  geo.translate(0, 0.1, 0);
  return geo;
}

export const Phoenix3DViewer: React.FC<Phoenix3DViewerProps> = ({
  level,
  stageName,
  auraId,
  auraRank,
  talismanId,
  talismanRank,
  crestId,
  crestRank,
  featherPaletteId,
  wingPatternId,
  isPreviewing,
  previewItemName,
  onResetPreview
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [cameraPreset, setCameraPreset] = useState<PhoenixCameraPreset>('overview');
  const [webglError, setWebglError] = useState(false);

  const visualStateRef = useRef({
    level,
    auraId,
    auraRank,
    talismanId,
    talismanRank,
    crestId,
    crestRank,
    featherPaletteId,
    wingPatternId
  });
  visualStateRef.current = {
    level,
    auraId,
    auraRank,
    talismanId,
    talismanRank,
    crestId,
    crestRank,
    featherPaletteId,
    wingPatternId
  };

  const presetTransitionRef = useRef<{
    active: boolean;
    preset: PhoenixCameraPreset;
  }>({ active: false, preset: 'overview' });

  const handleSelectPreset = (preset: PhoenixCameraPreset) => {
    setCameraPreset(preset);
    presetTransitionRef.current = { active: true, preset };
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false
      });
    } catch {
      setWebglError(true);
      return;
    }

    const width = Math.max(240, container.clientWidth);
    const height = Math.max(220, container.clientHeight);
    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x091022);
    scene.fog = new THREE.FogExp2(0x091022, 0.036);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 45);
    camera.position.set(...CAMERA_PRESETS.overview.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...CAMERA_PRESETS.overview.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 2.0;
    controls.maxDistance = 7.2;
    controls.minPolarAngle = Math.PI * 0.14;
    controls.maxPolarAngle = Math.PI * 0.58;
    controls.update();

    const onControlStart = () => {
      presetTransitionRef.current.active = false;
    };
    controls.addEventListener('start', onControlStart);

    // 3-Point Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x9ff6ff, 0x121d3b, 1.25);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff6e5, 2.25);
    keyLight.position.set(3.4, 5.5, 4.8);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 16;
    keyLight.shadow.camera.left = -3;
    keyLight.shadow.camera.right = 3;
    keyLight.shadow.camera.top = 3;
    keyLight.shadow.camera.bottom = -3;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x00f5d4, 1.75);
    rimLight.position.set(-3.6, 3.2, -3.2);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0xffbe0b, 0.72);
    fillLight.position.set(-2.5, 1.6, 3.4);
    scene.add(fillLight);

    // Resource tracking
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const staticTextures: THREE.Texture[] = [];

    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      geometries.push(g);
      return g;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      materials.push(m);
      return m;
    };
    const trackStaticTex = <T extends THREE.Texture>(t: T): T => {
      staticTextures.push(t);
      return t;
    };

    const ebruPedestalTex = trackStaticTex(createEbruPedestalTexture(maxAniso));
    const shadowTex = trackStaticTex(createContactShadowTexture());

    let dynamicPlumageTex: THREE.CanvasTexture | null = null;
    let dynamicPrimaryWingTex: THREE.CanvasTexture | null = null;
    let dynamicSecondaryWingTex: THREE.CanvasTexture | null = null;
    let dynamicCrestTex: THREE.CanvasTexture | null = null;
    let dynamicTailTex: THREE.CanvasTexture | null = null;
    let appliedPaletteKey = '';

    // Materials (bright logo Ebru vibrancy via subtle emissiveMap matching diffuse)
    const pedestalStoneMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x15224a,
        roughness: 0.42,
        metalness: 0.35
      })
    );
    const pedestalTopMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: ebruPedestalTex,
        roughness: 0.28,
        metalness: 0.25
      })
    );
    const goldMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xffbe0b,
        metalness: 0.88,
        roughness: 0.18,
        clearcoat: 0.65
      })
    );
    const darkBeakMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x1c2842,
        roughness: 0.2,
        metalness: 0.35,
        clearcoat: 0.9
      })
    );
    const cheekMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfff5e4,
        roughness: 0.38,
        metalness: 0.02
      })
    );
    const browPlumeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x00f5d4,
        emissive: 0x004a42,
        emissiveIntensity: 0.35,
        roughness: 0.3
      })
    );
    const eyeIrisMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x00f5d4,
        emissive: 0x00a896,
        emissiveIntensity: 0.55,
        roughness: 0.1,
        clearcoat: 1.0
      })
    );
    const darkPupilMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x070b14,
        roughness: 0.06,
        clearcoat: 1.0
      })
    );
    const whiteHighlightMat = trackMat(
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    const bodyPlumageMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.28,
        roughness: 0.3,
        metalness: 0.1,
        clearcoat: 0.58,
        clearcoatRoughness: 0.22,
        iridescence: 0.42,
        iridescenceIOR: 1.32
      })
    );
    const wingPrimaryMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.24,
        roughness: 0.26,
        metalness: 0.14,
        clearcoat: 0.65,
        iridescence: 0.5,
        side: THREE.DoubleSide
      })
    );
    const wingSecondaryMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.24,
        roughness: 0.28,
        metalness: 0.14,
        clearcoat: 0.6,
        side: THREE.DoubleSide
      })
    );
    const crestPlumeMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.3,
        roughness: 0.26,
        metalness: 0.12,
        clearcoat: 0.65,
        side: THREE.DoubleSide
      })
    );
    const tailFeatherMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.26,
        roughness: 0.25,
        metalness: 0.14,
        clearcoat: 0.65,
        side: THREE.DoubleSide
      })
    );
    const auraRingMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x00f5d4,
        emissive: 0x00f5d4,
        emissiveIntensity: 1.05,
        roughness: 0.2,
        metalness: 0.7
      })
    );
    const rubyGemMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xff006e,
        emissive: 0x990042,
        emissiveIntensity: 0.65,
        roughness: 0.08,
        clearcoat: 1.0
      })
    );
    const cyanGemMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x00f5d4,
        emissive: 0x00a896,
        emissiveIntensity: 0.7,
        roughness: 0.08,
        clearcoat: 1.0
      })
    );
    const speedTrailMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x06d6a0,
        emissive: 0x06d6a0,
        emissiveIntensity: 1.05,
        roughness: 0.2,
        metalness: 0.3,
        transparent: true,
        opacity: 0.88
      })
    );

    // 1. Grounded Circular Ebru Pedestal + Central Ornate Selçuklu T-Perch (from hero & logo art)
    const pedestalGroup = new THREE.Group();
    scene.add(pedestalGroup);

    const shadowPlane = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(3.6, 3.6)),
      trackMat(
        new THREE.MeshBasicMaterial({
          map: shadowTex,
          transparent: true,
          depthWrite: false,
          opacity: 0.65
        })
      )
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.005;
    pedestalGroup.add(shadowPlane);

    const baseTier = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(1.18, 1.38, 0.16, 48)),
      pedestalStoneMat
    );
    baseTier.position.y = 0.08;
    baseTier.receiveShadow = true;
    pedestalGroup.add(baseTier);

    const upperTier = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(1.02, 1.1, 0.09, 48)),
      pedestalTopMat
    );
    upperTier.position.y = 0.205;
    upperTier.receiveShadow = true;
    pedestalGroup.add(upperTier);

    const pedGoldTrim = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(1.06, 0.025, 14, 64)),
      goldMat
    );
    pedGoldTrim.rotation.x = Math.PI / 2;
    pedGoldTrim.position.y = 0.245;
    pedestalGroup.add(pedGoldTrim);

    // Central T-Finial Perch Column (matches zumruduanka_hero_1794737139184.jpg!)
    const perchBarY = 0.86;
    const perchBarZ = 0.1;

    const pillarShaft = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.068, 0.11, 0.62, 20)),
      pedestalStoneMat
    );
    pillarShaft.position.set(0, 0.54, perchBarZ);
    pillarShaft.castShadow = true;
    pedestalGroup.add(pillarShaft);

    const pillarCollar = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.095, 0.018, 12, 28)),
      goldMat
    );
    pillarCollar.rotation.x = Math.PI / 2;
    pillarCollar.position.set(0, 0.28, perchBarZ);
    pedestalGroup.add(pillarCollar);

    const pillarGem = new THREE.Mesh(
      trackGeo(new THREE.OctahedronGeometry(0.045, 0)),
      goldMat
    );
    pillarGem.scale.set(0.8, 1.35, 0.45);
    pillarGem.position.set(0, 0.64, perchBarZ + 0.08);
    pedestalGroup.add(pillarGem);

    const perchBar = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.052, 0.052, 0.62, 20)),
      pedestalStoneMat
    );
    perchBar.rotation.z = Math.PI / 2;
    perchBar.position.set(0, perchBarY, perchBarZ);
    perchBar.castShadow = true;
    pedestalGroup.add(perchBar);

    const perchTrimGeo = trackGeo(new THREE.TorusGeometry(0.054, 0.014, 10, 24));
    const perchCapGeo = trackGeo(new THREE.SphereGeometry(0.056, 16, 12));
    [-0.31, 0.31].forEach((px) => {
      const cap = new THREE.Mesh(perchCapGeo, goldMat);
      cap.position.set(px, perchBarY, perchBarZ);
      pedestalGroup.add(cap);

      const ring = new THREE.Mesh(perchTrimGeo, goldMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(px * 0.85, perchBarY, perchBarZ);
      pedestalGroup.add(ring);
    });

    // 2. Dilbaz Zümrüdüanka Bird Root (perched upright with proud chest on central T-perch)
    const birdGroup = new THREE.Group();
    birdGroup.position.set(0, 1.21, 0.02);
    scene.add(birdGroup);

    const torsoMesh = new THREE.Mesh(trackGeo(createSculptedTorsoGeometry()), bodyPlumageMat);
    torsoMesh.rotation.x = -0.14;
    torsoMesh.castShadow = true;
    birdGroup.add(torsoMesh);

    // Golden V-Neck Collar Cord (iconic necklace from logo)
    const cordCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.17, 0.35, 0.09),
      new THREE.Vector3(-0.11, 0.24, 0.29),
      new THREE.Vector3(0, 0.13, 0.375),
      new THREE.Vector3(0.11, 0.24, 0.29),
      new THREE.Vector3(0.17, 0.35, 0.09)
    ]);
    const neckCordMesh = new THREE.Mesh(
      trackGeo(new THREE.TubeGeometry(cordCurve, 28, 0.015, 10, false)),
      goldMat
    );
    birdGroup.add(neckCordMesh);

    // Base Logo Nazar Pendant (shown when no other talisman overrides it)
    const baseLogoNazarGroup = new THREE.Group();
    baseLogoNazarGroup.position.set(0, 0.125, 0.382);
    birdGroup.add(baseLogoNazarGroup);

    const baseNazarBezel = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.072, 0.013, 12, 28)),
      goldMat
    );
    baseLogoNazarGroup.add(baseNazarBezel);

    const baseNazarBlue = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.068, 0.068, 0.022, 24)),
      trackMat(new THREE.MeshPhysicalMaterial({ color: 0x1d4ed8, roughness: 0.12, clearcoat: 1.0 }))
    );
    baseNazarBlue.rotation.x = Math.PI / 2;
    baseLogoNazarGroup.add(baseNazarBlue);

    const baseNazarWhite = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.044, 0.044, 0.026, 22)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 }))
    );
    baseNazarWhite.rotation.x = Math.PI / 2;
    baseLogoNazarGroup.add(baseNazarWhite);

    const baseNazarPupil = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.032, 18)),
      cyanGemMat
    );
    baseNazarPupil.rotation.x = Math.PI / 2;
    baseLogoNazarGroup.add(baseNazarPupil);

    const baseNazarDot = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.01, 0.01, 0.035, 14)),
      darkPupilMat
    );
    baseNazarDot.rotation.x = Math.PI / 2;
    baseLogoNazarGroup.add(baseNazarDot);

    // Grounded Talons Gripping Central T-Perch
    const buildTalon = (side: -1 | 1) => {
      const talon = new THREE.Group();
      talon.position.set(side * 0.125, -0.27, 0.08);

      const shin = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.044, 0.032, 0.13, 12)),
        darkBeakMat
      );
      shin.position.set(0, -0.02, 0.01);
      shin.rotation.x = 0.18;
      talon.add(shin);

      [-0.032, 0, 0.032].forEach((tx, idx) => {
        const toeCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(tx * 0.65, -0.065, 0.0),
          new THREE.Vector3(tx, -0.072, 0.052),
          new THREE.Vector3(tx, -0.118, 0.062)
        ]);
        const toe = new THREE.Mesh(
          trackGeo(
            new THREE.TubeGeometry(
              toeCurve,
              10,
              idx === 1 ? 0.017 : 0.013,
              8,
              false
            )
          ),
          darkBeakMat
        );
        talon.add(toe);
      });

      const rearToeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.065, 0.0),
        new THREE.Vector3(0, -0.075, -0.048),
        new THREE.Vector3(0, -0.115, -0.044)
      ]);
      const rearToe = new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(rearToeCurve, 8, 0.014, 8, false)),
        darkBeakMat
      );
      talon.add(rearToe);

      return talon;
    };
    birdGroup.add(buildTalon(-1), buildTalon(1));

    // 3. Sculpted Head Group (Turned 3/4 right just like the Dilbaz Logo Phoenix!)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.59, 0.12);
    headGroup.rotation.y = 0.44;
    birdGroup.add(headGroup);

    const headMesh = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.22, 32, 24)),
      bodyPlumageMat
    );
    headMesh.scale.set(0.92, 0.98, 1.12);
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    // Cream-Ivory Feathered Cheek Mask (distinct macaw-phoenix facial patch from logo)
    const cheekGeo = trackGeo(new THREE.SphereGeometry(0.13, 20, 16));
    [-1, 1].forEach((side) => {
      const cheek = new THREE.Mesh(cheekGeo, cheekMat);
      cheek.position.set(side * 0.115, -0.025, 0.105);
      cheek.scale.set(0.58, 0.72, 0.95);
      cheek.rotation.y = side * 0.42;
      cheek.rotation.z = side * -0.15;
      headGroup.add(cheek);
    });

    // Expressive Layered Eyes + Turquoise/Gold Brow Arch
    const irisGeo = trackGeo(new THREE.SphereGeometry(0.048, 16, 16));
    const pupilGeo = trackGeo(new THREE.SphereGeometry(0.03, 14, 14));
    const catchlightGeo = trackGeo(new THREE.SphereGeometry(0.012, 10, 10));
    const browCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.042, 0.045),
      new THREE.Vector3(0.015, 0.06, 0),
      new THREE.Vector3(0, 0.036, -0.055)
    ]);
    const browGeo = trackGeo(new THREE.TubeGeometry(browCurve, 12, 0.014, 8, false));

    [-1, 1].forEach((side) => {
      const eyeSocket = new THREE.Group();
      eyeSocket.position.set(side * 0.148, 0.03, 0.115);
      eyeSocket.rotation.y = side * 0.36;

      const iris = new THREE.Mesh(irisGeo, eyeIrisMat);
      iris.scale.set(0.62, 1, 1);
      eyeSocket.add(iris);

      const pupil = new THREE.Mesh(pupilGeo, darkPupilMat);
      pupil.position.set(side * 0.016, 0, 0.016);
      pupil.scale.set(0.62, 1, 1);
      eyeSocket.add(pupil);

      const highlight = new THREE.Mesh(catchlightGeo, whiteHighlightMat);
      highlight.position.set(side * 0.022, 0.015, 0.034);
      eyeSocket.add(highlight);

      const brow = new THREE.Mesh(browGeo, browPlumeMat);
      brow.position.set(side * 0.012, 0.008, 0);
      eyeSocket.add(brow);

      headGroup.add(eyeSocket);
    });

    // Sculpted Tapered Hooked Macaw Beak (clean seam against cheek mask, NO nose-ring torus)
    const beakGroup = new THREE.Group();
    beakGroup.position.set(0, -0.018, 0.185);
    headGroup.add(beakGroup);

    const upperBeak = new THREE.Mesh(trackGeo(createSculptedHookedBeakGeometry()), darkBeakMat);
    upperBeak.castShadow = true;
    beakGroup.add(upperBeak);

    const lowerBeak = new THREE.Mesh(
      trackGeo(createSculptedLowerMandibleGeometry()),
      darkBeakMat
    );
    lowerBeak.castShadow = true;
    beakGroup.add(lowerBeak);

    // 4. Sweeping 6-Plume Flame-Fan Crest (broad sickle silhouettes arched gracefully up & back!)
    const crestPivot = new THREE.Group();
    crestPivot.position.set(-0.02, 0.17, 0.01);
    headGroup.add(crestPivot);

    const crestPlumeGeo = trackGeo(
      createCurvedFeatherGeometry({
        length: 0.44,
        width: 0.105,
        curveY: 0.13,
        camberZ: 0.035
      })
    );
    [
      { x: -0.02, y: 0.02, z: 0.06, rz: 1.52, ry: 0.16, rx: 0.1, s: 0.92 },
      { x: -0.04, y: 0.03, z: 0.02, rz: 1.72, ry: 0.22, rx: 0.04, s: 1.08 },
      { x: -0.05, y: 0.025, z: -0.02, rz: 1.94, ry: 0.28, rx: -0.04, s: 1.16 },
      { x: -0.04, y: 0.01, z: -0.055, rz: 2.18, ry: 0.34, rx: -0.1, s: 1.02 },
      { x: -0.03, y: -0.02, z: -0.085, rz: 2.42, ry: 0.4, rx: -0.14, s: 0.86 },
      { x: -0.02, y: -0.05, z: -0.11, rz: 2.66, ry: 0.44, rx: -0.18, s: 0.7 }
    ].forEach((cfg) => {
      const plume = new THREE.Mesh(crestPlumeGeo, crestPlumeMat);
      plume.position.set(cfg.x, cfg.y, cfg.z);
      plume.rotation.set(cfg.rx, cfg.ry, cfg.rz);
      plume.scale.setScalar(cfg.s);
      plume.castShadow = true;
      crestPivot.add(plume);
    });

    // 5. Dramatic Upward-Sweeping V-Arc Spread Wings (Signature Logo Silhouette!)
    const outerFlightGeo = trackGeo(
      createCurvedFeatherGeometry({
        length: 1.15,
        width: 0.2,
        curveY: 0.22,
        camberZ: 0.055
      })
    );
    const midFlightGeo = trackGeo(
      createCurvedFeatherGeometry({
        length: 0.86,
        width: 0.185,
        curveY: 0.14,
        camberZ: 0.045
      })
    );
    const covertGeo = trackGeo(
      createCurvedFeatherGeometry({
        length: 0.54,
        width: 0.16,
        curveY: 0.08,
        camberZ: 0.03
      })
    );

    const buildLogoWing = (side: -1 | 1): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.24, 0.24, -0.04);

      const inner = new THREE.Group();
      if (side === -1) inner.scale.x = -1;
      pivot.add(inner);

      // Feathered turquoise-gold shoulder cuff tracing the sweeping V-arc
      const shoulderCuffCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.02, 0.02),
        new THREE.Vector3(0.36, 0.24, 0.01),
        new THREE.Vector3(0.76, 0.62, -0.03)
      ]);
      const shoulderCuff = new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(shoulderCuffCurve, 22, 0.032, 12, false)),
        wingPrimaryMat
      );
      inner.add(shoulderCuff);

      // 8 Long crescent primary flight feathers distributed along the upward V-arc
      for (let i = 0; i < 8; i += 1) {
        const t = i / 7;
        const angle = 0.86 - t * 0.98; // Sweeps boldly from steeply upward (+49°) down to horizontal-fan (-7°)
        const scale = 1.08 - t * 0.26;
        const mat = i % 2 === 0 ? wingPrimaryMat : wingSecondaryMat;
        const f = new THREE.Mesh(outerFlightGeo, mat);
        f.position.set(0.16 + Math.sin(t * 1.4) * 0.22, 0.14 - t * 0.22, -0.012 * i);
        f.rotation.z = angle;
        f.rotation.y = -0.14 - t * 0.1;
        f.scale.set(scale, 0.98, 1);
        f.castShadow = true;
        inner.add(f);
      }

      // 6 Scalloped secondary feathers layered cleanly in front
      for (let i = 0; i < 6; i += 1) {
        const t = i / 5;
        const angle = 0.52 - t * 0.95;
        const mat = i % 2 === 0 ? wingSecondaryMat : wingPrimaryMat;
        const f = new THREE.Mesh(midFlightGeo, mat);
        f.position.set(0.06 + t * 0.14, 0.01 - t * 0.18, 0.03 - i * 0.01);
        f.rotation.z = angle;
        f.rotation.y = -0.1 - t * 0.08;
        f.scale.setScalar(0.98 - t * 0.18);
        f.castShadow = true;
        inner.add(f);
      }

      // 5 Upper shoulder coverts connecting organically to the chest
      for (let i = 0; i < 5; i += 1) {
        const t = i / 4;
        const angle = 0.44 - t * 0.88;
        const mat = i % 2 === 0 ? wingPrimaryMat : wingSecondaryMat;
        const f = new THREE.Mesh(covertGeo, mat);
        f.position.set(0.01 + t * 0.08, 0.02 - t * 0.14, 0.06 - i * 0.008);
        f.rotation.z = angle;
        f.rotation.y = -0.06;
        f.scale.setScalar(0.96 - t * 0.16);
        inner.add(f);
      }

      return pivot;
    };

    const leftWingPivot = buildLogoWing(-1);
    const rightWingPivot = buildLogoWing(1);
    birdGroup.add(leftWingPivot, rightWingPivot);

    // 6. Cascading S-Curved Peacock-Phoenix Tail Fan (Broadside to camera, curling gracefully above pedestal)
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, -0.3, -0.1);
    birdGroup.add(tailPivot);

    const tailPlumeGeo = trackGeo(
      createCurvedFeatherGeometry({
        length: 0.84,
        width: 0.2,
        curveY: 0.22,
        waveY: -0.1,
        camberZ: 0.055,
        flareTip: true
      })
    );

    [
      { x: -0.14, y: -0.02, z: -0.05, rz: -2.48, ry: 0.24, s: 0.86 },
      { x: -0.08, y: -0.01, z: -0.03, rz: -2.2, ry: 0.16, s: 0.96 },
      { x: -0.02, y: 0.0, z: -0.01, rz: -1.88, ry: 0.08, s: 1.04 },
      { x: 0.04, y: 0.0, z: 0.01, rz: -1.24, ry: -0.08, s: 1.08 },
      { x: 0.1, y: -0.01, z: -0.01, rz: -0.94, ry: -0.16, s: 1.0 },
      { x: 0.15, y: -0.02, z: -0.03, rz: -0.68, ry: -0.24, s: 0.88 },
      { x: 0.19, y: -0.03, z: -0.06, rz: -0.44, ry: -0.3, s: 0.78 }
    ].forEach((cfg) => {
      const f = new THREE.Mesh(tailPlumeGeo, tailFeatherMat);
      f.position.set(cfg.x, cfg.y, cfg.z);
      f.rotation.set(0.14, cfg.ry, cfg.rz);
      f.scale.setScalar(cfg.s);
      f.castShadow = true;
      tailPivot.add(f);
    });

    // === 3D RELIC / BADGE / WING ACCESSORY ATTACHMENTS ===

    // A. Aura Rings + Floating Stardust / Ember InstancedMesh
    const auraOrbitGroup = new THREE.Group();
    auraOrbitGroup.position.set(0, 1.24, 0);
    scene.add(auraOrbitGroup);

    const auraRingMesh = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(1.42, 0.022, 14, 72)),
      auraRingMat
    );
    auraRingMesh.rotation.x = Math.PI * 0.45;
    auraRingMesh.rotation.y = 0.2;
    auraOrbitGroup.add(auraRingMesh);

    const auraRingMesh2 = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(1.24, 0.016, 12, 64)),
      auraRingMat
    );
    auraRingMesh2.rotation.x = Math.PI * 0.56;
    auraRingMesh2.rotation.y = -0.26;
    auraOrbitGroup.add(auraRingMesh2);

    const MOTE_COUNT = 26;
    const moteGeo = trackGeo(new THREE.OctahedronGeometry(0.046, 0));
    const moteMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x00f5d4,
        emissiveIntensity: 1.2,
        roughness: 0.15,
        metalness: 0.4
      })
    );
    const auraMotes = new THREE.InstancedMesh(moteGeo, moteMat, MOTE_COUNT);
    auraMotes.frustumCulled = false;
    scene.add(auraMotes);

    const moteSeeds = Array.from({ length: MOTE_COUNT }, (_, i) => ({
      angle: (i / MOTE_COUNT) * Math.PI * 2,
      radius: 1.02 + (i % 5) * 0.15,
      speed: 0.42 + (i % 4) * 0.14,
      yBase: 0.48 + (i % 7) * 0.24,
      phase: i * 0.7
    }));

    // B1. Talisman: Nazar Boncuğu 3D Medallion on Gold Necklace + Ward Ring
    const nazarGroup = new THREE.Group();
    nazarGroup.position.set(0, 0.125, 0.386);
    birdGroup.add(nazarGroup);

    const nazarBezel = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.112, 0.02, 14, 36)),
      goldMat
    );
    nazarGroup.add(nazarBezel);

    const nazarBlue = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.106, 0.106, 0.032, 32)),
      trackMat(new THREE.MeshPhysicalMaterial({ color: 0x1d4ed8, roughness: 0.1, clearcoat: 1.0 }))
    );
    nazarBlue.rotation.x = Math.PI / 2;
    nazarGroup.add(nazarBlue);

    const nazarWhite = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.07, 0.07, 0.038, 28)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 }))
    );
    nazarWhite.rotation.x = Math.PI / 2;
    nazarGroup.add(nazarWhite);

    const nazarIris = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.042, 0.042, 0.044, 24)),
      cyanGemMat
    );
    nazarIris.rotation.x = Math.PI / 2;
    nazarGroup.add(nazarIris);

    const nazarPupil = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 18)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x090e1a, roughness: 0.1 }))
    );
    nazarPupil.rotation.x = Math.PI / 2;
    nazarGroup.add(nazarPupil);

    const nazarWardRing = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.88, 0.015, 12, 48)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x3a86ff,
          emissive: 0x3a86ff,
          emissiveIntensity: 1.0,
          roughness: 0.2
        })
      )
    );
    nazarWardRing.rotation.x = Math.PI * 0.35;
    birdGroup.add(nazarWardRing);

    // B2. Talisman: Hız Yıldızı İzi (Chest Bolt + Wingtip Speed Arcs)
    const speedGroup = new THREE.Group();
    birdGroup.add(speedGroup);

    const chestBolt = new THREE.Mesh(trackGeo(createLightningBoltGeometry()), goldMat);
    chestBolt.position.set(0, 0.125, 0.386);
    chestBolt.scale.setScalar(0.62);
    speedGroup.add(chestBolt);

    const leftTrailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.05, 0.85, -0.06),
      new THREE.Vector3(-1.44, 0.52, -0.36),
      new THREE.Vector3(-1.18, 0.1, -0.74)
    ]);
    const rightTrailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.05, 0.85, -0.06),
      new THREE.Vector3(1.44, 0.52, -0.36),
      new THREE.Vector3(1.18, 0.1, -0.74)
    ]);
    const leftTrailMesh = new THREE.Mesh(
      trackGeo(new THREE.TubeGeometry(leftTrailCurve, 24, 0.024, 8, false)),
      speedTrailMat
    );
    const rightTrailMesh = new THREE.Mesh(
      trackGeo(new THREE.TubeGeometry(rightTrailCurve, 24, 0.024, 8, false)),
      speedTrailMat
    );
    speedGroup.add(leftTrailMesh, rightTrailMesh);

    // C1. Crest: Altın İbik Tacı (Gold Crown nestled cleanly around the feather mohawk)
    const crownGroup = new THREE.Group();
    crownGroup.position.set(0, 0.19, 0.04);
    headGroup.add(crownGroup);

    const crownBand = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.145, 0.022, 12, 32)),
      goldMat
    );
    crownBand.rotation.x = Math.PI / 2;
    crownGroup.add(crownBand);

    const spireGeo = trackGeo(createCrownSpireGeometry());
    [
      { x: 0, z: 0.135, ry: 0, s: 1.0 },
      { x: -0.11, z: 0.065, ry: -0.55, s: 0.85 },
      { x: 0.11, z: 0.065, ry: 0.55, s: 0.85 }
    ].forEach((sp, i) => {
      const spire = new THREE.Mesh(spireGeo, goldMat);
      spire.position.set(sp.x, 0.01, sp.z);
      spire.rotation.y = sp.ry;
      spire.scale.setScalar(sp.s);
      crownGroup.add(spire);

      const gem = new THREE.Mesh(
        trackGeo(new THREE.OctahedronGeometry(0.03, 0)),
        i === 0 ? rubyGemMat : cyanGemMat
      );
      gem.position.set(sp.x, 0.075, sp.z + 0.02);
      crownGroup.add(gem);
    });

    // C2. Crest: Gök Sultanı Halesi (Floating Celestial Halo above Flame Crest)
    const haloGroup = new THREE.Group();
    haloGroup.position.set(0, 0.58, -0.03);
    headGroup.add(haloGroup);

    const haloTorus = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.32, 0.024, 14, 48)),
      goldMat
    );
    haloTorus.rotation.x = Math.PI * 0.42;
    haloGroup.add(haloTorus);

    const haloInnerTorus = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.25, 0.012, 10, 42)),
      cyanGemMat
    );
    haloInnerTorus.rotation.x = Math.PI * 0.42;
    haloGroup.add(haloInnerTorus);

    const haloOrbGeo = trackGeo(new THREE.OctahedronGeometry(0.035, 0));
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      const orb = new THREE.Mesh(haloOrbGeo, i % 2 === 0 ? cyanGemMat : rubyGemMat);
      orb.position.set(Math.cos(a) * 0.32, Math.sin(a) * 0.08, Math.sin(a) * 0.32);
      haloGroup.add(orb);
    }

    // Apply palette, pattern, and relic attachments cleanly without rebuilding geometry/controls
    const applyVisualState = () => {
      const st = visualStateRef.current;
      const palette = getFeatherPalette(st.featherPaletteId);
      const paletteKey = `${palette.id}::${st.wingPatternId}`;

      if (paletteKey !== appliedPaletteKey) {
        appliedPaletteKey = paletteKey;

        const nextPlumageTex = createBirdPlumageTexture(palette, maxAniso);
        const nextPrimaryTex = createFeatherPatternTexture(
          palette,
          st.wingPatternId,
          'primary',
          maxAniso
        );
        const nextSecondaryTex = createFeatherPatternTexture(
          palette,
          st.wingPatternId,
          'secondary',
          maxAniso
        );
        const nextCrestTex = createCrestPlumeTexture(palette, maxAniso);
        const nextTailTex = createTailPlumeTexture(palette, maxAniso);

        bodyPlumageMat.map = nextPlumageTex;
        bodyPlumageMat.emissiveMap = nextPlumageTex;
        bodyPlumageMat.needsUpdate = true;

        wingPrimaryMat.map = nextPrimaryTex;
        wingPrimaryMat.emissiveMap = nextPrimaryTex;
        wingPrimaryMat.needsUpdate = true;

        wingSecondaryMat.map = nextSecondaryTex;
        wingSecondaryMat.emissiveMap = nextSecondaryTex;
        wingSecondaryMat.needsUpdate = true;

        crestPlumeMat.map = nextCrestTex;
        crestPlumeMat.emissiveMap = nextCrestTex;
        crestPlumeMat.needsUpdate = true;

        tailFeatherMat.map = nextTailTex;
        tailFeatherMat.emissiveMap = nextTailTex;
        tailFeatherMat.needsUpdate = true;

        browPlumeMat.color.set(palette.primaryColor);
        browPlumeMat.emissive.set(palette.bodyBaseColor);

        dynamicPlumageTex?.dispose();
        dynamicPrimaryWingTex?.dispose();
        dynamicSecondaryWingTex?.dispose();
        dynamicCrestTex?.dispose();
        dynamicTailTex?.dispose();

        dynamicPlumageTex = nextPlumageTex;
        dynamicPrimaryWingTex = nextPrimaryTex;
        dynamicSecondaryWingTex = nextSecondaryTex;
        dynamicCrestTex = nextCrestTex;
        dynamicTailTex = nextTailTex;
      }

      const isFlame = st.auraId === 'aura_pomegranate_flame';
      const auraColor =
        palette.id !== 'ebru_classic'
          ? palette.primaryColor
          : isFlame
          ? '#FF006E'
          : '#00F5D4';

      auraRingMat.color.set(auraColor);
      auraRingMat.emissive.set(isFlame && palette.id === 'ebru_classic' ? '#FF5400' : auraColor);
      auraRingMat.emissiveIntensity = 0.8 + st.auraRank * 0.35;
      auraRingMesh2.visible = st.auraRank >= 2;

      moteMat.emissive.set(isFlame && palette.id === 'ebru_classic' ? '#FF5400' : auraColor);
      rimLight.color.set(auraColor);

      const hasTalisman =
        st.talismanId === 'talisman_nazar' || st.talismanId === 'talisman_speed_bolt';
      baseLogoNazarGroup.visible = !hasTalisman;

      nazarGroup.visible = st.talismanId === 'talisman_nazar';
      nazarWardRing.visible = st.talismanId === 'talisman_nazar';
      nazarGroup.scale.setScalar(0.95 + st.talismanRank * 0.08);

      speedGroup.visible = st.talismanId === 'talisman_speed_bolt';
      speedTrailMat.emissiveIntensity = 0.85 + st.talismanRank * 0.3;

      crownGroup.visible = st.crestId === 'crest_golden_crown';
      crownGroup.scale.setScalar(0.96 + st.crestRank * 0.07);

      haloGroup.visible = st.crestId === 'crest_celestial_halo';
      haloGroup.scale.setScalar(0.95 + st.crestRank * 0.08);
    };

    applyVisualState();

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(240, Math.round(entry.contentRect.width));
        const h = Math.max(220, Math.round(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const delta = Math.min(0.05, clock.getDelta());
      const elapsed = clock.getElapsedTime();

      applyVisualState();

      const st = visualStateRef.current;
      const flapInfo = getPhoenixFlapSpeed({ level: st.level, difficulty: 'kolay' });
      const speedBonus = st.talismanId === 'talisman_speed_bolt' ? 0.2 : 0;
      const omega = (Math.PI * 2) / Math.max(1.4, flapInfo.durationSeconds - speedBonus);

      // Gentle perched breathing & expressive 3/4 gaze matching logo posture
      birdGroup.position.y = 1.21 + Math.sin(elapsed * omega) * 0.015;
      birdGroup.rotation.y = Math.sin(elapsed * 0.45) * 0.08;
      headGroup.rotation.y = 0.44 + Math.sin(elapsed * 0.65) * 0.1;
      headGroup.rotation.z = Math.sin(elapsed * 0.58) * 0.035;
      crestPivot.rotation.z = Math.sin(elapsed * omega - 0.3) * 0.05;

      // Graceful upward-sweeping wing breeze flap
      const wingSweep = Math.sin(elapsed * omega) * 0.14;
      const wingTwist = Math.cos(elapsed * omega) * 0.05;
      leftWingPivot.rotation.z = -wingSweep;
      leftWingPivot.rotation.x = wingTwist;
      rightWingPivot.rotation.z = wingSweep;
      rightWingPivot.rotation.x = wingTwist;

      // Tail gentle sway
      tailPivot.rotation.x = Math.sin(elapsed * omega - 0.6) * 0.05;

      // Aura rings & motes
      auraOrbitGroup.rotation.y = elapsed * (0.28 + st.auraRank * 0.08);
      auraRingMesh2.rotation.z = -elapsed * 0.35;

      const visibleMotes = Math.min(MOTE_COUNT, 10 + st.auraRank * 5);
      for (let i = 0; i < MOTE_COUNT; i += 1) {
        if (i >= visibleMotes) {
          _moteDummy.scale.setScalar(0.0001);
          _moteDummy.position.set(0, -10, 0);
        } else {
          const seed = moteSeeds[i];
          const a = seed.angle + elapsed * seed.speed;
          const bob = Math.sin(elapsed * 1.4 + seed.phase) * 0.16;
          _moteDummy.position.set(
            Math.cos(a) * seed.radius,
            seed.yBase + bob,
            Math.sin(a) * seed.radius
          );
          _moteDummy.rotation.set(elapsed + i, elapsed * 0.7, 0);
          _moteDummy.scale.setScalar(0.75 + st.auraRank * 0.16);
        }
        _moteDummy.updateMatrix();
        auraMotes.setMatrixAt(i, _moteDummy.matrix);
      }
      auraMotes.instanceMatrix.needsUpdate = true;

      if (nazarWardRing.visible) {
        nazarWardRing.rotation.z = elapsed * 0.65;
        nazarGroup.rotation.y = Math.sin(elapsed * 1.5) * 0.12;
      }
      if (haloGroup.visible) {
        haloGroup.rotation.y = elapsed * 0.5;
        haloGroup.position.y = 0.58 + Math.sin(elapsed * 1.8) * 0.02;
      }

      if (presetTransitionRef.current.active) {
        const targetPreset = CAMERA_PRESETS[presetTransitionRef.current.preset];
        _camGoalPos.set(...targetPreset.pos);
        _camGoalTarget.set(...targetPreset.target);

        camera.position.x = THREE.MathUtils.damp(camera.position.x, _camGoalPos.x, 5.5, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _camGoalPos.y, 5.5, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _camGoalPos.z, 5.5, delta);

        controls.target.x = THREE.MathUtils.damp(controls.target.x, _camGoalTarget.x, 5.5, delta);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _camGoalTarget.y, 5.5, delta);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _camGoalTarget.z, 5.5, delta);

        if (
          camera.position.distanceTo(_camGoalPos) < 0.025 &&
          controls.target.distanceTo(_camGoalTarget) < 0.02
        ) {
          camera.position.copy(_camGoalPos);
          controls.target.copy(_camGoalTarget);
          presetTransitionRef.current.active = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (isSoftwareGl) {
      renderer.render(scene, camera);
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlStart);
      controls.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      staticTextures.forEach((t) => t.dispose());
      dynamicPlumageTex?.dispose();
      dynamicPrimaryWingTex?.dispose();
      dynamicSecondaryWingTex?.dispose();
      dynamicCrestTex?.dispose();
      dynamicTailTex?.dispose();
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  if (webglError) {
    return (
      <div className="w-full h-56 rounded-[24px] bg-[#091022] border border-white/10 flex flex-col items-center justify-center p-4 text-center text-xs text-[#94A3B8]">
        <span>3D görünüm bu cihazda başlatılamadı; klasik önizleme aktif.</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-64 sm:h-72 rounded-[24px] overflow-hidden border border-white/15 bg-[#091022] shadow-2xl">
      {/* Isolated WebGL Mount Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top-Left Minimal Spec Header (solid/rgba only over WebGL) */}
      <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-0.5 px-3 py-1.5 rounded-xl bg-[#091022]/85 border border-white/12">
        <div className="text-[11px] font-display font-bold text-[#FFBE0B] flex items-center gap-1.5">
          {isPreviewing ? (
            <>
              <Eye className="w-3.5 h-3.5 text-[#00F5D4]" />
              <span>Önizleme: {previewItemName}</span>
            </>
          ) : (
            <span>3D Zümrüdüanka · Sv.{level} {stageName}</span>
          )}
        </div>
        <span className="text-[10px] text-[#93C5FD]">Sürükleyerek 360° döndür</span>
      </div>

      {/* Unified Bottom Control Dock */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-1.5 rounded-2xl bg-[#091022]/90 border border-white/15 shadow-xl max-w-[95%] overflow-x-auto">
        {(
          [
            { id: 'overview', label: 'Genel' },
            { id: 'wings', label: 'Kanatlar' },
            { id: 'crest', label: 'Taç & Tılsım' }
          ] as { id: PhoenixCameraPreset; label: string }[]
        ).map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => handleSelectPreset(preset.id)}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
              cameraPreset === preset.id
                ? 'bg-[#3A86FF] text-white'
                : 'text-[#CBD5E1] hover:text-white hover:bg-white/10'
            }`}
          >
            {preset.label}
          </button>
        ))}

        {isPreviewing && onResetPreview && (
          <button
            type="button"
            onClick={onResetPreview}
            className="px-2.5 py-1 rounded-xl bg-[#FF006E]/85 hover:bg-[#FF006E] text-white text-[11px] font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Aktif Görünüme Dön</span>
          </button>
        )}
      </div>
    </div>
  );
};
