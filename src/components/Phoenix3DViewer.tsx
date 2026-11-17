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
  overview: { pos: [0.15, 1.88, 4.55], target: [0, 1.38, 0] },
  wings: { pos: [2.9, 2.1, 3.25], target: [0, 1.48, 0] },
  crest: { pos: [0.42, 2.28, 2.35], target: [0, 1.72, 0.14] }
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
    'rgba(0,245,212,0.36)',
    'rgba(58,134,255,0.3)',
    'rgba(255,190,11,0.38)',
    'rgba(255,0,110,0.28)'
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

  ctx.strokeStyle = 'rgba(255, 190, 11, 0.78)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * Math.PI * 2;
    const inner = i % 3 === 0 ? 210 : 224;
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
  baseGrad.addColorStop(0, palette.bodyBaseColor);
  baseGrad.addColorStop(0.5, palette.secondaryColor);
  baseGrad.addColorStop(1, palette.primaryColor);
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, 512, 512);

  // Flowing Ottoman Ebru marbling waves across chest/neck/head
  const [c0, c1, c2, c3] = palette.swirlColors;
  const swirlList = [c0, c1, c2, c3, c0, c1];
  for (let i = 0; i < 18; i += 1) {
    ctx.beginPath();
    const yStart = (i / 18) * 540 - 20;
    ctx.moveTo(-20, yStart);
    for (let x = 0; x <= 540; x += 24) {
      const wave =
        Math.sin(x * 0.018 + i * 0.65) * 34 +
        Math.cos(x * 0.032 - i * 0.4) * 18;
      ctx.lineTo(x, yStart + wave);
    }
    ctx.strokeStyle = swirlList[i % swirlList.length];
    ctx.globalAlpha = i % 3 === 0 ? 0.55 : 0.38;
    ctx.lineWidth = 14 + (i % 4) * 5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Combed gold hairline highlights
  ctx.globalAlpha = 0.62;
  ctx.strokeStyle = palette.accentColor;
  ctx.lineWidth = 2.4;
  for (let i = 0; i < 10; i += 1) {
    ctx.beginPath();
    const y0 = 28 + i * 48;
    ctx.moveTo(0, y0);
    for (let x = 0; x <= 512; x += 18) {
      ctx.lineTo(x, y0 + Math.sin(x * 0.025 + i) * 20);
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
  isPrimary: boolean,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Base gradient from feather root (left u=0) to feather tip (right u=1)
  const g = ctx.createLinearGradient(0, 128, 512, 128);
  if (isPrimary) {
    g.addColorStop(0, palette.bodyBaseColor);
    g.addColorStop(0.32, palette.secondaryColor);
    g.addColorStop(0.75, palette.primaryColor);
    g.addColorStop(1, palette.accentColor);
  } else {
    g.addColorStop(0, palette.bodyBaseColor);
    g.addColorStop(0.45, palette.primaryColor);
    g.addColorStop(0.88, palette.secondaryColor);
    g.addColorStop(1, palette.accentColor);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);

  // Pattern-specific artwork along the feather vane
  if (patternId === 'ebru_wave') {
    const bands = [palette.swirlColors[0], palette.swirlColors[1], palette.swirlColors[3]];
    for (let i = 0; i < 8; i += 1) {
      ctx.beginPath();
      const yBase = 24 + i * 30;
      ctx.moveTo(0, yBase);
      for (let x = 0; x <= 512; x += 18) {
        ctx.lineTo(x, yBase + Math.sin(x * 0.028 + i * 0.85) * 18);
      }
      ctx.strokeStyle = bands[i % bands.length];
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 10;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (patternId === 'peacock_eye') {
    const centers = [
      { x: 185, y: 128, rx: 46, ry: 32 },
      { x: 380, y: 128, rx: 68, ry: 46 }
    ];
    for (const c of centers) {
      ctx.save();
      ctx.translate(c.x, c.y);
      // Outer gold halo
      ctx.fillStyle = palette.accentColor;
      ctx.beginPath();
      ctx.ellipse(0, 0, c.rx, c.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      // Magenta/secondary ring
      ctx.fillStyle = palette.secondaryColor;
      ctx.beginPath();
      ctx.ellipse(-4, 0, c.rx * 0.78, c.ry * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();
      // Primary turquoise iris
      ctx.fillStyle = palette.primaryColor;
      ctx.beginPath();
      ctx.ellipse(-6, 0, c.rx * 0.52, c.ry * 0.52, 0, 0, Math.PI * 2);
      ctx.fill();
      // Deep sapphire eye center
      ctx.fillStyle = '#091022';
      ctx.beginPath();
      ctx.ellipse(-8, 0, c.rx * 0.28, c.ry * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (patternId === 'flame_streak') {
    for (let i = 0; i < 10; i += 1) {
      const y = 18 + i * 24;
      const fg = ctx.createLinearGradient(80, y, 512, y);
      fg.addColorStop(0, 'rgba(255, 190, 11, 0)');
      fg.addColorStop(0.55, palette.accentColor);
      fg.addColorStop(1, '#FFFBEB');
      ctx.strokeStyle = fg;
      ctx.lineWidth = i % 2 === 0 ? 6 : 3.5;
      ctx.beginPath();
      ctx.moveTo(40 + i * 16, y);
      ctx.quadraticCurveTo(280, y + (i % 2 === 0 ? -16 : 16), 512, y);
      ctx.stroke();
    }
  } else if (patternId === 'royal_filigree') {
    ctx.strokeStyle = '#FFBE0B';
    ctx.lineWidth = 4;
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
    ctx.lineWidth = 4.5;
    for (let x = 90; x <= 430; x += 85) {
      ctx.beginPath();
      ctx.moveTo(x - 26, 56);
      ctx.lineTo(x + 22, 128);
      ctx.lineTo(x - 26, 200);
      ctx.stroke();

      ctx.fillStyle = palette.accentColor;
      ctx.beginPath();
      ctx.arc(x + 26, 128, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Diagonal feather barb lines for crisp plumage texture
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1.6;
  for (let x = 16; x < 490; x += 22) {
    ctx.beginPath();
    ctx.moveTo(x, 128);
    ctx.lineTo(x + 36, 24);
    ctx.moveTo(x, 128);
    ctx.lineTo(x + 36, 232);
    ctx.stroke();
  }

  // Signature Logo Golden Edge Rim + Glowing Central Shaft (Rachis)
  ctx.fillStyle = palette.accentColor;
  ctx.fillRect(0, 0, 512, 14);
  ctx.fillRect(0, 242, 512, 14);
  ctx.fillRect(486, 0, 26, 256);

  const shaftGrad = ctx.createLinearGradient(0, 128, 512, 128);
  shaftGrad.addColorStop(0, '#FFF3B0');
  shaftGrad.addColorStop(1, palette.accentColor);
  ctx.fillStyle = shaftGrad;
  ctx.fillRect(0, 123, 490, 10);

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
  g.addColorStop(0.55, 'rgba(6, 12, 26, 0.32)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function normalizeFeatherUVs(geo: THREE.BufferGeometry) {
  geo.computeBoundingBox();
  const bbox = geo.boundingBox!;
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const minX = bbox.min.x;
  const spanX = Math.max(0.001, bbox.max.x - bbox.min.x);
  const minY = bbox.min.y;
  const spanY = Math.max(0.001, bbox.max.y - bbox.min.y);

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    uv.setXY(i, (x - minX) / spanX, (y - minY) / spanY);
  }
  uv.needsUpdate = true;
}

function createLogoFeatherGeometry(
  length: number,
  width: number,
  curve: number
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(
    length * 0.24,
    width * 0.68,
    length * 0.72,
    width * 0.52 + curve * 0.45,
    length,
    curve
  );
  shape.bezierCurveTo(
    length * 0.72,
    -width * 0.34 + curve * 0.38,
    length * 0.24,
    -width * 0.44,
    0,
    0
  );
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.009,
    bevelSize: 0.009,
    bevelSegments: 2,
    curveSegments: 16
  });
  geo.translate(0, 0, -0.011);
  normalizeFeatherUVs(geo);
  return geo;
}

function createHookedBeakGeometry(): THREE.ExtrudeGeometry {
  // Side profile in XY plane (X = forward +Z after rotation.y = -PI/2, Y = up)
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.075);
  shape.bezierCurveTo(0.11, 0.09, 0.21, 0.035, 0.23, -0.095);
  shape.bezierCurveTo(0.205, -0.13, 0.175, -0.085, 0.155, -0.045);
  shape.bezierCurveTo(0.11, -0.02, 0.05, -0.018, 0, -0.022);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.086,
    bevelEnabled: true,
    bevelThickness: 0.022,
    bevelSize: 0.018,
    bevelSegments: 3,
    curveSegments: 18
  });
  geo.translate(0, 0, -0.043);
  geo.rotateY(-Math.PI / 2);
  return geo;
}

function createLowerMandibleGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.018);
  shape.bezierCurveTo(0.06, -0.018, 0.12, -0.032, 0.135, -0.065);
  shape.bezierCurveTo(0.09, -0.085, 0.035, -0.082, 0, -0.065);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.064,
    bevelEnabled: true,
    bevelThickness: 0.016,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 12
  });
  geo.translate(0, 0, -0.032);
  geo.rotateY(-Math.PI / 2);
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
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x091022);
    scene.fog = new THREE.FogExp2(0x091022, 0.042);

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
    controls.maxDistance = 6.8;
    controls.minPolarAngle = Math.PI * 0.14;
    controls.maxPolarAngle = Math.PI * 0.56;
    controls.update();

    const onControlStart = () => {
      presetTransitionRef.current.active = false;
    };
    controls.addEventListener('start', onControlStart);

    // 3-Point Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x8be9ff, 0x101935, 1.18);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4dd, 2.35);
    keyLight.position.set(3.5, 5.6, 4.4);
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

    const rimLight = new THREE.DirectionalLight(0x00f5d4, 1.65);
    rimLight.position.set(-3.6, 3.2, -3.2);
    scene.add(rimLight);

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
    let appliedPaletteKey = '';

    // Materials
    const pedestalStoneMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0f1a36,
        roughness: 0.45,
        metalness: 0.35
      })
    );
    const pedestalTopMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: ebruPedestalTex,
        roughness: 0.3,
        metalness: 0.25
      })
    );
    const goldMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xffbe0b,
        metalness: 0.92,
        roughness: 0.16,
        clearcoat: 0.55
      })
    );
    const darkBeakMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x182238,
        roughness: 0.22,
        metalness: 0.38,
        clearcoat: 0.85
      })
    );
    const cheekMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfff4e0,
        roughness: 0.42,
        metalness: 0.05
      })
    );
    const eyeIrisMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x00f5d4,
        emissive: 0x007f70,
        emissiveIntensity: 0.45,
        roughness: 0.12,
        clearcoat: 1.0
      })
    );
    const darkPupilMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x080c17,
        roughness: 0.08,
        clearcoat: 1.0
      })
    );
    const whiteHighlightMat = trackMat(
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    const bodyPlumageMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.32,
        metalness: 0.18,
        clearcoat: 0.65,
        clearcoatRoughness: 0.2,
        iridescence: 0.45,
        iridescenceIOR: 1.32
      })
    );
    const wingPrimaryMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.26,
        metalness: 0.22,
        clearcoat: 0.72,
        iridescence: 0.55
      })
    );
    const wingSecondaryMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.3,
        metalness: 0.2,
        clearcoat: 0.6
      })
    );
    const crestPlumeMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xff006e,
        emissive: 0x600028,
        emissiveIntensity: 0.42,
        roughness: 0.28,
        metalness: 0.2,
        clearcoat: 0.65
      })
    );
    const crestAccentMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xffbe0b,
        emissive: 0x5c3600,
        emissiveIntensity: 0.35,
        roughness: 0.24,
        metalness: 0.4,
        clearcoat: 0.7
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

    // 1. Grounded Ebru Pedestal + Royal Perch Stand (flush at y = 0)
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
      trackGeo(new THREE.CylinderGeometry(1.36, 1.56, 0.18, 48)),
      pedestalStoneMat
    );
    baseTier.position.y = 0.09;
    baseTier.receiveShadow = true;
    pedestalGroup.add(baseTier);

    const upperTier = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(1.18, 1.26, 0.1, 48)),
      pedestalTopMat
    );
    upperTier.position.y = 0.23;
    upperTier.receiveShadow = true;
    pedestalGroup.add(upperTier);

    const pedGoldTrim = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(1.22, 0.028, 14, 64)),
      goldMat
    );
    pedGoldTrim.rotation.x = Math.PI / 2;
    pedGoldTrim.position.y = 0.27;
    pedestalGroup.add(pedGoldTrim);

    // Ornate Selçuklu Gold Perch Bar anchored to pedestal
    const perchBarY = 0.88;
    const perchBarZ = 0.12;
    const perchBar = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.036, 0.036, 1.38, 18)),
      darkBeakMat
    );
    perchBar.rotation.z = Math.PI / 2;
    perchBar.position.set(0, perchBarY, perchBarZ);
    perchBar.castShadow = true;
    pedestalGroup.add(perchBar);

    const perchFinialGeo = trackGeo(new THREE.SphereGeometry(0.058, 16, 14));
    const perchRingGeo = trackGeo(new THREE.TorusGeometry(0.052, 0.014, 10, 24));
    [-0.7, 0.7].forEach((px) => {
      const finial = new THREE.Mesh(perchFinialGeo, goldMat);
      finial.position.set(px, perchBarY, perchBarZ);
      pedestalGroup.add(finial);

      const collarRing = new THREE.Mesh(perchRingGeo, goldMat);
      collarRing.rotation.y = Math.PI / 2;
      collarRing.position.set(px * 0.84, perchBarY, perchBarZ);
      pedestalGroup.add(collarRing);

      // Curved support strut from pedestal top (y=0.27) up to perch bar
      const strutCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(px * 0.96, 0.27, -0.02),
        new THREE.Vector3(px * 0.88, 0.56, 0.08),
        new THREE.Vector3(px * 0.82, perchBarY, perchBarZ)
      ]);
      const strut = new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(strutCurve, 20, 0.026, 10, false)),
        goldMat
      );
      strut.castShadow = true;
      pedestalGroup.add(strut);
    });

    // 2. Logo Zümrüdüanka Bird Root (perched cleanly above perch bar)
    const birdGroup = new THREE.Group();
    birdGroup.position.set(0, 1.24, 0.02);
    scene.add(birdGroup);

    // Sculpted Pear-Shaped Macaw-Phoenix Chest & S-Arched Neck
    const torsoPoints = [
      new THREE.Vector2(0.01, -0.4),
      new THREE.Vector2(0.15, -0.35),
      new THREE.Vector2(0.28, -0.18),
      new THREE.Vector2(0.34, 0.02),
      new THREE.Vector2(0.31, 0.22),
      new THREE.Vector2(0.22, 0.37),
      new THREE.Vector2(0.17, 0.49),
      new THREE.Vector2(0.01, 0.54)
    ];
    const torsoMesh = new THREE.Mesh(
      trackGeo(new THREE.LatheGeometry(torsoPoints, 36)),
      bodyPlumageMat
    );
    torsoMesh.scale.set(0.94, 1.0, 1.08);
    torsoMesh.castShadow = true;
    birdGroup.add(torsoMesh);

    // Golden V-Neck Collar Cord (signature from Dilbaz logo)
    const cordCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.18, 0.34, 0.08),
      new THREE.Vector3(-0.11, 0.23, 0.27),
      new THREE.Vector3(0, 0.13, 0.345),
      new THREE.Vector3(0.11, 0.23, 0.27),
      new THREE.Vector3(0.18, 0.34, 0.08)
    ]);
    const neckCordMesh = new THREE.Mesh(
      trackGeo(new THREE.TubeGeometry(cordCurve, 28, 0.014, 10, false)),
      goldMat
    );
    birdGroup.add(neckCordMesh);

    // Subtle default golden collar bead (shown when no talisman equipped)
    const defaultCollarGem = new THREE.Mesh(
      trackGeo(new THREE.OctahedronGeometry(0.055, 0)),
      goldMat
    );
    defaultCollarGem.position.set(0, 0.12, 0.36);
    birdGroup.add(defaultCollarGem);

    // Grounded Talons Gripping Perch Bar
    const buildTalon = (side: -1 | 1) => {
      const talon = new THREE.Group();
      talon.position.set(side * 0.15, -0.28, 0.09);

      const shin = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.044, 0.032, 0.14, 12)),
        darkBeakMat
      );
      shin.position.set(0, -0.02, 0.01);
      shin.rotation.x = 0.24;
      talon.add(shin);

      // Three forward-curling toes + rear toe wrapping perch bar
      [-0.032, 0, 0.032].forEach((tx, idx) => {
        const toeCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(tx * 0.6, -0.07, 0.0),
          new THREE.Vector3(tx, -0.075, 0.048),
          new THREE.Vector3(tx, -0.115, 0.058)
        ]);
        const toe = new THREE.Mesh(
          trackGeo(
            new THREE.TubeGeometry(
              toeCurve,
              10,
              idx === 1 ? 0.016 : 0.013,
              8,
              false
            )
          ),
          darkBeakMat
        );
        talon.add(toe);
      });

      const rearToeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.07, 0.0),
        new THREE.Vector3(0, -0.08, -0.045),
        new THREE.Vector3(0, -0.115, -0.04)
      ]);
      const rearToe = new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(rearToeCurve, 8, 0.014, 8, false)),
        darkBeakMat
      );
      talon.add(rearToe);

      return talon;
    };
    birdGroup.add(buildTalon(-1), buildTalon(1));

    // Head Group (Macaw-Phoenix proportions: turned slightly heroically 3/4 toward viewer)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.6, 0.11);
    headGroup.rotation.y = 0.18;
    birdGroup.add(headGroup);

    const headMesh = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.225, 28, 22)),
      bodyPlumageMat
    );
    headMesh.scale.set(0.95, 1.0, 1.06);
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    // Distinct Cream-Ivory Cheek Patches (from Dilbaz logo)
    const cheekGeo = trackGeo(new THREE.SphereGeometry(0.115, 18, 16));
    [-1, 1].forEach((side) => {
      const cheek = new THREE.Mesh(cheekGeo, cheekMat);
      cheek.position.set(side * 0.125, -0.015, 0.115);
      cheek.scale.set(0.75, 0.85, 0.88);
      cheek.rotation.y = side * 0.45;
      headGroup.add(cheek);
    });

    // Expressive Layered Eyes (Turquoise Iris + Dark Glossy Pupil + White Catchlight + Gold Brow)
    const irisGeo = trackGeo(new THREE.SphereGeometry(0.044, 14, 14));
    const pupilGeo = trackGeo(new THREE.SphereGeometry(0.028, 12, 12));
    const catchlightGeo = trackGeo(new THREE.SphereGeometry(0.01, 8, 8));
    [-1, 1].forEach((side) => {
      const eyeSocket = new THREE.Group();
      eyeSocket.position.set(side * 0.145, 0.025, 0.145);
      eyeSocket.rotation.y = side * 0.42;

      const iris = new THREE.Mesh(irisGeo, eyeIrisMat);
      iris.scale.set(0.65, 1, 1);
      eyeSocket.add(iris);

      const pupil = new THREE.Mesh(pupilGeo, darkPupilMat);
      pupil.position.set(side * 0.014, 0, 0.018);
      pupil.scale.set(0.65, 1, 1);
      eyeSocket.add(pupil);

      const highlight = new THREE.Mesh(catchlightGeo, whiteHighlightMat);
      highlight.position.set(side * 0.02, 0.014, 0.036);
      eyeSocket.add(highlight);

      headGroup.add(eyeSocket);
    });

    // Curved Hooked Parrot Beak + Golden Cere + Lower Mandible
    const beakGroup = new THREE.Group();
    beakGroup.position.set(0, -0.025, 0.18);
    headGroup.add(beakGroup);

    const cereTrim = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.068, 0.015, 10, 22)),
      goldMat
    );
    cereTrim.position.set(0, 0.025, 0.01);
    cereTrim.scale.set(0.85, 1.1, 0.8);
    beakGroup.add(cereTrim);

    const upperBeak = new THREE.Mesh(trackGeo(createHookedBeakGeometry()), darkBeakMat);
    upperBeak.castShadow = true;
    beakGroup.add(upperBeak);

    const lowerBeak = new THREE.Mesh(trackGeo(createLowerMandibleGeometry()), darkBeakMat);
    lowerBeak.castShadow = true;
    beakGroup.add(lowerBeak);

    // Fiery 6-Plume Mohawk Crest (arching backward like the logo)
    const crestPivot = new THREE.Group();
    crestPivot.position.set(0, 0.19, 0.02);
    headGroup.add(crestPivot);

    const crestPlumeGeo = trackGeo(createLogoFeatherGeometry(0.46, 0.095, 0.12));
    [
      { z: 0.09, y: 0.01, rz: 1.18, s: 0.88, accent: true },
      { z: 0.04, y: 0.02, rz: 1.38, s: 1.06, accent: false },
      { z: -0.02, y: 0.015, rz: 1.58, s: 1.14, accent: true },
      { z: -0.08, y: 0.0, rz: 1.78, s: 1.02, accent: false },
      { z: -0.14, y: -0.03, rz: 2.02, s: 0.85, accent: false },
      { z: -0.18, y: -0.06, rz: 2.25, s: 0.68, accent: true }
    ].forEach((cfg, idx) => {
      const plume = new THREE.Mesh(
        crestPlumeGeo,
        cfg.accent ? crestAccentMat : crestPlumeMat
      );
      plume.position.set((idx % 2 === 0 ? -1 : 1) * 0.012, cfg.y, cfg.z);
      plume.rotation.y = Math.PI / 2;
      plume.rotation.z = cfg.rz;
      plume.scale.setScalar(cfg.s);
      plume.castShadow = true;
      crestPivot.add(plume);
    });

    // 3. Dramatic Upward-Sweeping V-Arc Spread Wings (Signature Logo Silhouette)
    const outerFlightGeo = trackGeo(createLogoFeatherGeometry(1.18, 0.22, 0.2));
    const midFlightGeo = trackGeo(createLogoFeatherGeometry(0.9, 0.19, 0.11));
    const covertGeo = trackGeo(createLogoFeatherGeometry(0.56, 0.16, 0.06));

    const buildLogoWing = (side: -1 | 1): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.25, 0.2, -0.05);

      const inner = new THREE.Group();
      if (side === -1) inner.scale.x = -1;
      pivot.add(inner);

      // Golden leading shoulder curve
      const sparCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.02, 0.03),
        new THREE.Vector3(0.45, 0.32, 0.0),
        new THREE.Vector3(0.94, 0.72, -0.06)
      ]);
      const wingSpar = new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(sparCurve, 22, 0.024, 10, false)),
        goldMat
      );
      inner.add(wingSpar);

      // 7 long primary upward-sweeping flight feathers
      for (let i = 0; i < 7; i += 1) {
        const angle = 0.72 - i * 0.155; // Sweeps boldly UPWARD (+41° down to -12°)
        const scale = 1.06 - i * 0.065;
        const f = new THREE.Mesh(outerFlightGeo, wingPrimaryMat);
        f.position.set(0.06 + i * 0.03, 0.04 - i * 0.035, -0.015 * i);
        f.rotation.z = angle;
        f.rotation.y = -0.14 - i * 0.03;
        f.scale.set(scale, 0.96, 1);
        f.castShadow = true;
        inner.add(f);
      }

      // 6 middle secondary feathers layered in front
      for (let i = 0; i < 6; i += 1) {
        const angle = 0.56 - i * 0.17;
        const f = new THREE.Mesh(midFlightGeo, wingSecondaryMat);
        f.position.set(0.02 + i * 0.025, -0.02 - i * 0.032, 0.025 - i * 0.012);
        f.rotation.z = angle;
        f.rotation.y = -0.1 - i * 0.02;
        f.scale.setScalar(0.98 - i * 0.05);
        f.castShadow = true;
        inner.add(f);
      }

      // 5 scalloped upper shoulder coverts
      for (let i = 0; i < 5; i += 1) {
        const angle = 0.42 - i * 0.18;
        const f = new THREE.Mesh(covertGeo, wingPrimaryMat);
        f.position.set(0.01, -0.03 - i * 0.028, 0.055 - i * 0.008);
        f.rotation.z = angle;
        f.rotation.y = -0.08;
        f.scale.setScalar(0.95 - i * 0.06);
        inner.add(f);
      }

      return pivot;
    };

    const leftWingPivot = buildLogoWing(-1);
    const rightWingPivot = buildLogoWing(1);
    birdGroup.add(leftWingPivot, rightWingPivot);

    // 4. Long S-Curved Peacock Tail Plumes (draping below perch bar)
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, -0.34, -0.15);
    birdGroup.add(tailPivot);

    const longTailGeo = trackGeo(createLogoFeatherGeometry(1.12, 0.16, -0.18));
    const tailEyeGeo = trackGeo(new THREE.SphereGeometry(0.048, 12, 10));
    [-0.48, -0.28, -0.1, 0.1, 0.28, 0.48].forEach((spread, idx) => {
      const f = new THREE.Mesh(
        longTailGeo,
        idx % 2 === 0 ? wingPrimaryMat : wingSecondaryMat
      );
      f.position.set(spread * 0.18, 0, -Math.abs(spread) * 0.06);
      f.rotation.y = -Math.PI / 2 + spread;
      f.rotation.z = -1.04 + Math.abs(spread) * 0.18;
      f.scale.setScalar(idx === 2 || idx === 3 ? 1.06 : 0.92);
      f.castShadow = true;
      tailPivot.add(f);

      // Luminous gold ocellus accent near each plume tip
      const ocellus = new THREE.Mesh(tailEyeGeo, goldMat);
      ocellus.scale.set(1.2, 0.65, 0.4);
      ocellus.position.set(0.92, -0.15, 0.015);
      f.add(ocellus);
    });

    // === 3D RELIC / BADGE / WING ACCESSORY ATTACHMENTS ===

    // A. Aura Rings + Floating Stardust / Ember InstancedMesh
    const auraOrbitGroup = new THREE.Group();
    auraOrbitGroup.position.set(0, 1.24, 0);
    scene.add(auraOrbitGroup);

    const auraRingMesh = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(1.36, 0.022, 14, 72)),
      auraRingMat
    );
    auraRingMesh.rotation.x = Math.PI * 0.45;
    auraRingMesh.rotation.y = 0.2;
    auraOrbitGroup.add(auraRingMesh);

    const auraRingMesh2 = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(1.18, 0.016, 12, 64)),
      auraRingMat
    );
    auraRingMesh2.rotation.x = Math.PI * 0.56;
    auraRingMesh2.rotation.y = -0.26;
    auraOrbitGroup.add(auraRingMesh2);

    const MOTE_COUNT = 26;
    const moteGeo = trackGeo(new THREE.OctahedronGeometry(0.048, 0));
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
      radius: 0.98 + (i % 5) * 0.15,
      speed: 0.42 + (i % 4) * 0.14,
      yBase: 0.48 + (i % 7) * 0.24,
      phase: i * 0.7
    }));

    // B1. Talisman: Nazar Boncuğu 3D Medallion on Gold Necklace + Ward Ring
    const nazarGroup = new THREE.Group();
    nazarGroup.position.set(0, 0.11, 0.365);
    birdGroup.add(nazarGroup);

    const nazarBezel = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.115, 0.02, 14, 36)),
      goldMat
    );
    nazarGroup.add(nazarBezel);

    const nazarBlue = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.032, 32)),
      trackMat(new THREE.MeshPhysicalMaterial({ color: 0x1d4ed8, roughness: 0.1, clearcoat: 1.0 }))
    );
    nazarBlue.rotation.x = Math.PI / 2;
    nazarGroup.add(nazarBlue);

    const nazarWhite = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.072, 0.072, 0.038, 28)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 }))
    );
    nazarWhite.rotation.x = Math.PI / 2;
    nazarGroup.add(nazarWhite);

    const nazarIris = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.044, 0.044, 0.044, 24)),
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
      trackGeo(new THREE.TorusGeometry(0.86, 0.015, 12, 48)),
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
    chestBolt.position.set(0, 0.11, 0.365);
    chestBolt.scale.setScalar(0.62);
    speedGroup.add(chestBolt);

    const leftTrailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.02, 0.72, -0.08),
      new THREE.Vector3(-1.42, 0.45, -0.38),
      new THREE.Vector3(-1.18, 0.08, -0.78)
    ]);
    const rightTrailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.02, 0.72, -0.08),
      new THREE.Vector3(1.42, 0.45, -0.38),
      new THREE.Vector3(1.18, 0.08, -0.78)
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

    // C1. Crest: Altın İbik Tacı (Gold Crown nestled cleanly on crown)
    const crownGroup = new THREE.Group();
    crownGroup.position.set(0, 0.2, 0.04);
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

    // C2. Crest: Gök Sultanı Halesi (Floating Celestial Halo above Crest)
    const haloGroup = new THREE.Group();
    haloGroup.position.set(0, 0.48, -0.02);
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
        const nextPrimaryTex = createFeatherPatternTexture(palette, st.wingPatternId, true, maxAniso);
        const nextSecondaryTex = createFeatherPatternTexture(palette, st.wingPatternId, false, maxAniso);

        bodyPlumageMat.map = nextPlumageTex;
        bodyPlumageMat.needsUpdate = true;

        wingPrimaryMat.map = nextPrimaryTex;
        wingPrimaryMat.needsUpdate = true;

        wingSecondaryMat.map = nextSecondaryTex;
        wingSecondaryMat.needsUpdate = true;

        dynamicPlumageTex?.dispose();
        dynamicPrimaryWingTex?.dispose();
        dynamicSecondaryWingTex?.dispose();

        dynamicPlumageTex = nextPlumageTex;
        dynamicPrimaryWingTex = nextPrimaryTex;
        dynamicSecondaryWingTex = nextSecondaryTex;

        crestPlumeMat.color.set(palette.secondaryColor);
        crestPlumeMat.emissive.set(palette.bodyBaseColor);
        crestAccentMat.color.set(palette.accentColor);
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
      defaultCollarGem.visible = !hasTalisman;

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

      // Gentle perched breathing & slight expressive gaze turn (talons stay anchored near perch bar)
      birdGroup.position.y = 1.24 + Math.sin(elapsed * omega) * 0.018;
      birdGroup.rotation.y = Math.sin(elapsed * 0.5) * 0.1;
      headGroup.rotation.y = 0.18 + Math.sin(elapsed * 0.72) * 0.12;
      headGroup.rotation.z = Math.sin(elapsed * 0.65) * 0.04;
      crestPivot.rotation.z = Math.sin(elapsed * omega - 0.3) * 0.06;

      // Graceful upward-sweeping wing breeze flap
      const wingSweep = Math.sin(elapsed * omega) * 0.18;
      const wingTwist = Math.cos(elapsed * omega) * 0.06;
      leftWingPivot.rotation.z = -wingSweep;
      leftWingPivot.rotation.x = wingTwist;
      rightWingPivot.rotation.z = wingSweep;
      rightWingPivot.rotation.x = wingTwist;

      // Tail gentle sway
      tailPivot.rotation.x = Math.sin(elapsed * omega - 0.6) * 0.06;

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
        haloGroup.position.y = 0.48 + Math.sin(elapsed * 1.8) * 0.02;
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
            <span>Kuşanılıya Dön</span>
          </button>
        )}
      </div>
    </div>
  );
};
