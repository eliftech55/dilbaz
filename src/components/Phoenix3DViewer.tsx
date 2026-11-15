import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { getPhoenixFlapSpeed } from '../utils/phoenixProgression';
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
  isPreviewing: boolean;
  previewItemName?: string | null;
  onResetPreview?: () => void;
}

const CAMERA_PRESETS: Record<
  PhoenixCameraPreset,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  overview: { pos: [0, 1.85, 4.35], target: [0, 1.32, 0] },
  wings: { pos: [3.2, 2.05, 3.05], target: [0, 1.38, 0] },
  crest: { pos: [0.35, 2.25, 2.45], target: [0, 1.62, 0.1] }
};

// Pre-allocated math helpers outside animation loop (zero GC)
const _camGoalPos = new THREE.Vector3();
const _camGoalTarget = new THREE.Vector3();
const _moteDummy = new THREE.Object3D();
const _colorA = new THREE.Color();
const _colorB = new THREE.Color();

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

  // Concentric Ebru wave rings
  const ringColors = ['rgba(0,245,212,0.32)', 'rgba(58,134,255,0.28)', 'rgba(255,190,11,0.35)', 'rgba(255,0,110,0.24)'];
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

  // Gold compass ticks around edge
  ctx.strokeStyle = 'rgba(255, 190, 11, 0.72)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * Math.PI * 2;
    const inner = i % 3 === 0 ? 212 : 224;
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

function createFeatherGeometry(length: number, width: number, curve: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(
    length * 0.25,
    width * 0.65,
    length * 0.72,
    width * 0.55 + curve * 0.4,
    length,
    curve
  );
  shape.bezierCurveTo(
    length * 0.72,
    -width * 0.35 + curve * 0.35,
    length * 0.25,
    -width * 0.45,
    0,
    0
  );
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.028,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 16
  });
  geo.center();
  // Shift back so pivot sits cleanly at the feather base (x = 0)
  geo.translate(length * 0.46, 0, 0);
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
  shape.moveTo(-0.07, 0);
  shape.lineTo(0, 0.24);
  shape.lineTo(0.07, 0);
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
    crestRank
  });
  visualStateRef.current = {
    level,
    auraId,
    auraRank,
    talismanId,
    talismanRank,
    crestId,
    crestRank
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
    scene.fog = new THREE.FogExp2(0x091022, 0.045);

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
    controls.maxDistance = 6.5;
    controls.minPolarAngle = Math.PI * 0.14;
    controls.maxPolarAngle = Math.PI * 0.56;
    controls.update();

    const onControlStart = () => {
      presetTransitionRef.current.active = false;
    };
    controls.addEventListener('start', onControlStart);

    // 3-Point Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x7cc6ff, 0x101935, 1.15);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.25);
    keyLight.position.set(3.5, 5.5, 4.2);
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

    const rimLight = new THREE.DirectionalLight(0x00f5d4, 1.6);
    rimLight.position.set(-3.6, 3.0, -3.2);
    scene.add(rimLight);

    // Resource tracking for clean disposal
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];

    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      geometries.push(g);
      return g;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      materials.push(m);
      return m;
    };
    const trackTex = <T extends THREE.Texture>(t: T): T => {
      textures.push(t);
      return t;
    };

    // Textures
    const ebruTex = trackTex(createEbruPedestalTexture(renderer.capabilities.getMaxAnisotropy()));
    const shadowTex = trackTex(createContactShadowTexture());

    // Materials
    const pedestalStoneMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x101c38,
        roughness: 0.45,
        metalness: 0.35
      })
    );
    const pedestalTopMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: ebruTex,
        roughness: 0.32,
        metalness: 0.25
      })
    );
    const goldMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xffbe0b,
        metalness: 0.94,
        roughness: 0.16,
        clearcoat: 0.5
      })
    );
    const bodyPlumageMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x1e60d5,
        emissive: 0x05183d,
        emissiveIntensity: 0.45,
        roughness: 0.28,
        metalness: 0.35,
        clearcoat: 0.85,
        clearcoatRoughness: 0.18,
        iridescence: 0.7,
        iridescenceIOR: 1.35
      })
    );
    const wingFeatherMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x00f5d4,
        emissive: 0x007f70,
        emissiveIntensity: 0.42,
        roughness: 0.24,
        metalness: 0.45,
        clearcoat: 0.9,
        iridescence: 0.85
      })
    );
    const wingSecondaryMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x3a86ff,
        emissive: 0x103580,
        emissiveIntensity: 0.35,
        roughness: 0.3,
        metalness: 0.4
      })
    );
    const auraRingMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x00f5d4,
        emissive: 0x00f5d4,
        emissiveIntensity: 1.1,
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
        metalness: 0.1,
        clearcoat: 1.0
      })
    );
    const cyanGemMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x00f5d4,
        emissive: 0x00a896,
        emissiveIntensity: 0.7,
        roughness: 0.08,
        metalness: 0.1,
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

    // 1. Grounded Pedestal Group (sits flush at y = 0)
    const pedestalGroup = new THREE.Group();
    scene.add(pedestalGroup);

    const shadowPlane = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(3.4, 3.4)),
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
      trackGeo(new THREE.CylinderGeometry(1.32, 1.52, 0.18, 48)),
      pedestalStoneMat
    );
    baseTier.position.y = 0.09;
    baseTier.receiveShadow = true;
    pedestalGroup.add(baseTier);

    const upperTier = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(1.16, 1.24, 0.1, 48)),
      pedestalTopMat
    );
    upperTier.position.y = 0.23;
    upperTier.receiveShadow = true;
    pedestalGroup.add(upperTier);

    const pedGoldTrim = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(1.2, 0.028, 14, 64)),
      goldMat
    );
    pedGoldTrim.rotation.x = Math.PI / 2;
    pedGoldTrim.position.y = 0.27;
    pedestalGroup.add(pedGoldTrim);

    // 2. Zümrüdüanka 3D Bird Root (hovers gracefully above pedestal)
    const birdGroup = new THREE.Group();
    birdGroup.position.set(0, 1.18, 0);
    scene.add(birdGroup);

    // Sculpted Torso & Arched Neck (LatheGeometry)
    const torsoPoints = [
      new THREE.Vector2(0.01, -0.52),
      new THREE.Vector2(0.18, -0.44),
      new THREE.Vector2(0.32, -0.22),
      new THREE.Vector2(0.38, 0.02),
      new THREE.Vector2(0.33, 0.24),
      new THREE.Vector2(0.21, 0.42),
      new THREE.Vector2(0.16, 0.56),
      new THREE.Vector2(0.01, 0.6)
    ];
    const torsoMesh = new THREE.Mesh(
      trackGeo(new THREE.LatheGeometry(torsoPoints, 32)),
      bodyPlumageMat
    );
    torsoMesh.castShadow = true;
    torsoMesh.scale.set(0.95, 1.0, 1.1);
    birdGroup.add(torsoMesh);

    // Golden Breast Shield Plate
    const breastPlate = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.28, 24, 20, 0, Math.PI * 2, 0.35, 1.4)),
      goldMat
    );
    breastPlate.position.set(0, 0.05, 0.15);
    breastPlate.scale.set(0.82, 1.05, 0.65);
    breastPlate.castShadow = true;
    birdGroup.add(breastPlate);

    // Head Group
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.68, 0.12);
    birdGroup.add(headGroup);

    const headMesh = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.22, 24, 20)),
      bodyPlumageMat
    );
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    // Curved Gold Beak
    const beakMesh = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.075, 0.24, 16)),
      goldMat
    );
    beakMesh.position.set(0, -0.02, 0.26);
    beakMesh.rotation.x = Math.PI * 0.56;
    beakMesh.castShadow = true;
    headGroup.add(beakMesh);

    // Luminous Eyes (L & R)
    const eyeGeo = trackGeo(new THREE.SphereGeometry(0.036, 12, 12));
    const leftEye = new THREE.Mesh(eyeGeo, cyanGemMat);
    leftEye.position.set(-0.125, 0.04, 0.16);
    headGroup.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, cyanGemMat);
    rightEye.position.set(0.125, 0.04, 0.16);
    headGroup.add(rightEye);

    // Natural Swept Head Crest Plumes (3 feathers)
    const naturalPlumeGeo = trackGeo(createFeatherGeometry(0.38, 0.08, 0.08));
    [-0.18, 0, 0.18].forEach((ang, idx) => {
      const plume = new THREE.Mesh(naturalPlumeGeo, idx === 1 ? goldMat : wingFeatherMat);
      plume.position.set(ang * 0.25, 0.17, -0.05);
      plume.rotation.y = Math.PI / 2 + ang;
      plume.rotation.z = 0.68 + (idx === 1 ? 0.12 : 0);
      headGroup.add(plume);
    });

    // Articulated Wings (Left & Right Multi-Feather Groups)
    const primaryFeatherGeo = trackGeo(createFeatherGeometry(1.12, 0.22, 0.16));
    const secondaryFeatherGeo = trackGeo(createFeatherGeometry(0.86, 0.19, 0.08));
    const covertFeatherGeo = trackGeo(createFeatherGeometry(0.58, 0.16, 0.04));

    const buildWing = (side: -1 | 1): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.28, 0.22, -0.02);

      const wingInner = new THREE.Group();
      if (side === -1) {
        wingInner.scale.x = -1;
      }
      pivot.add(wingInner);

      const p1 = new THREE.Mesh(primaryFeatherGeo, wingFeatherMat);
      p1.rotation.z = 0.24;
      p1.rotation.y = -0.14;
      p1.castShadow = true;
      wingInner.add(p1);

      const p2 = new THREE.Mesh(secondaryFeatherGeo, wingFeatherMat);
      p2.position.set(0.02, -0.08, -0.04);
      p2.rotation.z = -0.06;
      p2.rotation.y = -0.22;
      p2.castShadow = true;
      wingInner.add(p2);

      const p3 = new THREE.Mesh(covertFeatherGeo, wingSecondaryMat);
      p3.position.set(0.02, -0.16, -0.06);
      p3.rotation.z = -0.34;
      p3.rotation.y = -0.26;
      wingInner.add(p3);

      // Golden Wing Spine Trim
      const spine = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.018, 0.008, 0.92, 10)),
        goldMat
      );
      spine.rotation.z = -Math.PI / 2 + 0.24;
      spine.position.set(0.42, 0.12, 0.02);
      wingInner.add(spine);

      return pivot;
    };

    const leftWingPivot = buildWing(-1);
    const rightWingPivot = buildWing(1);
    birdGroup.add(leftWingPivot, rightWingPivot);

    // Sweeping Tail Fan (5 layered feathers)
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, -0.36, -0.18);
    birdGroup.add(tailPivot);

    const tailFeatherGeo = trackGeo(createFeatherGeometry(0.92, 0.15, -0.12));
    [-0.44, -0.22, 0, 0.22, 0.44].forEach((spread, idx) => {
      const f = new THREE.Mesh(
        tailFeatherGeo,
        idx % 2 === 0 ? wingFeatherMat : wingSecondaryMat
      );
      f.rotation.y = -Math.PI / 2 + spread;
      f.rotation.z = -0.52;
      f.castShadow = true;
      tailPivot.add(f);
    });

    // === 3D RELIC / BADGE / WING ACCESSORY ATTACHMENTS ===

    // A. Aura Ring + Floating Stardust / Ember InstancedMesh
    const auraOrbitGroup = new THREE.Group();
    auraOrbitGroup.position.set(0, 1.12, 0);
    scene.add(auraOrbitGroup);

    const auraRingMesh = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(1.18, 0.026, 14, 72)),
      auraRingMat
    );
    auraRingMesh.rotation.x = Math.PI * 0.44;
    auraRingMesh.rotation.y = 0.22;
    auraOrbitGroup.add(auraRingMesh);

    const auraRingMesh2 = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(1.02, 0.018, 12, 64)),
      auraRingMat
    );
    auraRingMesh2.rotation.x = Math.PI * 0.56;
    auraRingMesh2.rotation.y = -0.28;
    auraOrbitGroup.add(auraRingMesh2);

    const MOTE_COUNT = 26;
    const moteGeo = trackGeo(new THREE.OctahedronGeometry(0.052, 0));
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
      radius: 0.85 + (i % 5) * 0.14,
      speed: 0.42 + (i % 4) * 0.14,
      yBase: 0.42 + (i % 7) * 0.22,
      phase: i * 0.7
    }));

    // B1. Talisman: Nazar Boncuğu 3D Medallion + Rotating Ward Ring
    const nazarGroup = new THREE.Group();
    nazarGroup.position.set(0, 0.06, 0.36);
    birdGroup.add(nazarGroup);

    const nazarBezel = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.14, 0.024, 14, 36)),
      goldMat
    );
    nazarGroup.add(nazarBezel);

    const nazarBlue = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.135, 0.135, 0.036, 32)),
      trackMat(new THREE.MeshPhysicalMaterial({ color: 0x1d4ed8, roughness: 0.1, clearcoat: 1.0 }))
    );
    nazarBlue.rotation.x = Math.PI / 2;
    nazarGroup.add(nazarBlue);

    const nazarWhite = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.09, 0.09, 0.042, 28)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 }))
    );
    nazarWhite.rotation.x = Math.PI / 2;
    nazarGroup.add(nazarWhite);

    const nazarIris = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.056, 0.056, 0.048, 24)),
      cyanGemMat
    );
    nazarIris.rotation.x = Math.PI / 2;
    nazarGroup.add(nazarIris);

    const nazarPupil = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.026, 0.026, 0.054, 18)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x090e1a, roughness: 0.1 }))
    );
    nazarPupil.rotation.x = Math.PI / 2;
    nazarGroup.add(nazarPupil);

    const nazarWardRing = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.76, 0.015, 12, 48)),
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

    // B2. Talisman: Hız Yıldızı İzi (Chest Bolt + Wing Speed Trail Arcs)
    const speedGroup = new THREE.Group();
    birdGroup.add(speedGroup);

    const chestBolt = new THREE.Mesh(trackGeo(createLightningBoltGeometry()), goldMat);
    chestBolt.position.set(0, 0.06, 0.37);
    chestBolt.scale.setScalar(0.68);
    speedGroup.add(chestBolt);

    const leftTrailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.95, 0.35, -0.06),
      new THREE.Vector3(-1.32, 0.22, -0.35),
      new THREE.Vector3(-1.12, -0.05, -0.78)
    ]);
    const rightTrailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.95, 0.35, -0.06),
      new THREE.Vector3(1.32, 0.22, -0.35),
      new THREE.Vector3(1.12, -0.05, -0.78)
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

    // C1. Crest: Altın İbik Tacı (3-Spire Gold Crown with Gems)
    const crownGroup = new THREE.Group();
    crownGroup.position.set(0, 0.19, 0.02);
    headGroup.add(crownGroup);

    const crownBand = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.145, 0.024, 12, 32)),
      goldMat
    );
    crownBand.rotation.x = Math.PI / 2;
    crownGroup.add(crownBand);

    const spireGeo = trackGeo(createCrownSpireGeometry());
    [
      { x: 0, z: 0.13, ry: 0, s: 1.05 },
      { x: -0.11, z: 0.06, ry: -0.55, s: 0.85 },
      { x: 0.11, z: 0.06, ry: 0.55, s: 0.85 }
    ].forEach((sp, i) => {
      const spire = new THREE.Mesh(spireGeo, goldMat);
      spire.position.set(sp.x, 0.01, sp.z);
      spire.rotation.y = sp.ry;
      spire.scale.setScalar(sp.s);
      crownGroup.add(spire);

      const gem = new THREE.Mesh(
        trackGeo(new THREE.OctahedronGeometry(0.032, 0)),
        i === 0 ? rubyGemMat : cyanGemMat
      );
      gem.position.set(sp.x, 0.075, sp.z + 0.02);
      crownGroup.add(gem);
    });

    // C2. Crest: Gök Sultanı Halesi (Floating Tilted Celestial Halo + Orbiting Star Gems)
    const haloGroup = new THREE.Group();
    haloGroup.position.set(0, 0.34, -0.02);
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

    // Apply relic state cleanly on every sync without recreating WebGL
    const applyRelicState = () => {
      const st = visualStateRef.current;
      const isFlame = st.auraId === 'aura_pomegranate_flame';
      const isCelestial = st.crestId === 'crest_celestial_halo';

      // Body & Wings coloring
      if (isCelestial) {
        _colorA.setHex(0xffbe0b);
        _colorB.setHex(0x3a2500);
        bodyPlumageMat.color.copy(_colorA);
        bodyPlumageMat.emissive.copy(_colorB);
      } else if (isFlame) {
        _colorA.setHex(0x311442);
        _colorB.setHex(0x28061a);
        bodyPlumageMat.color.copy(_colorA);
        bodyPlumageMat.emissive.copy(_colorB);
      } else {
        _colorA.setHex(0x1e60d5);
        _colorB.setHex(0x05183d);
        bodyPlumageMat.color.copy(_colorA);
        bodyPlumageMat.emissive.copy(_colorB);
      }

      if (isFlame) {
        wingFeatherMat.color.setHex(0xff006e);
        wingFeatherMat.emissive.setHex(0xff5400);
        wingFeatherMat.emissiveIntensity = 0.45 + st.auraRank * 0.22;
        wingSecondaryMat.color.setHex(0xffbe0b);
        wingSecondaryMat.emissive.setHex(0x993300);
        auraRingMat.color.setHex(0xff006e);
        auraRingMat.emissive.setHex(0xff5400);
        moteMat.emissive.setHex(0xff5400);
        rimLight.color.setHex(0xff006e);
      } else {
        wingFeatherMat.color.setHex(0x00f5d4);
        wingFeatherMat.emissive.setHex(0x007f70);
        wingFeatherMat.emissiveIntensity = 0.35 + st.auraRank * 0.18;
        wingSecondaryMat.color.setHex(0x3a86ff);
        wingSecondaryMat.emissive.setHex(0x103580);
        auraRingMat.color.setHex(0x00f5d4);
        auraRingMat.emissive.setHex(0x00f5d4);
        moteMat.emissive.setHex(0x00f5d4);
        rimLight.color.setHex(0x00f5d4);
      }

      auraRingMat.emissiveIntensity = 0.8 + st.auraRank * 0.35;
      auraRingMesh2.visible = st.auraRank >= 2;

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

    applyRelicState();

    // Pre-compile shaders on GPU
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // ResizeObserver for crisp responsive viewport
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

    // Animation Loop (paced with afterDraw on software WebGL)
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

      applyRelicState();

      const st = visualStateRef.current;
      const flapInfo = getPhoenixFlapSpeed({ level: st.level, difficulty: 'kolay' });
      const speedBonus = st.talismanId === 'talisman_speed_bolt' ? 0.2 : 0;
      const omega = (Math.PI * 2) / Math.max(1.4, flapInfo.durationSeconds - speedBonus);

      // Gentle breeze hover & slow turn
      birdGroup.position.y = 1.16 + Math.sin(elapsed * omega) * 0.055;
      birdGroup.position.x = Math.sin(elapsed * 0.85) * 0.03;
      birdGroup.rotation.y = Math.sin(elapsed * 0.55) * 0.14;
      birdGroup.rotation.z = Math.sin(elapsed * 0.85) * 0.035;

      // Gentle wing glide flap
      const wingSweep = Math.sin(elapsed * omega) * 0.24;
      const wingTwist = Math.cos(elapsed * omega) * 0.07;
      leftWingPivot.rotation.z = -wingSweep;
      leftWingPivot.rotation.x = wingTwist;
      rightWingPivot.rotation.z = wingSweep;
      rightWingPivot.rotation.x = wingTwist;

      // Tail gentle counter-sway
      tailPivot.rotation.x = Math.sin(elapsed * omega - 0.6) * 0.08;

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

      // Nazar ward & Halo spin
      if (nazarWardRing.visible) {
        nazarWardRing.rotation.z = elapsed * 0.65;
        nazarGroup.rotation.y = Math.sin(elapsed * 1.5) * 0.12;
      }
      if (haloGroup.visible) {
        haloGroup.rotation.y = elapsed * 0.5;
        haloGroup.position.y = 0.34 + Math.sin(elapsed * 1.8) * 0.02;
      }

      // Smooth damped camera preset transitions
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
      textures.forEach((t) => t.dispose());
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

      {/* Top-Left Minimal Spec Header (no backdrop-blur over WebGL, no pulsating dots) */}
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

      {/* Unified Bottom Control Dock (Zero side-panel clutter, solid/rgba only) */}
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
