"use client";
// The Reply Core: a shader-driven particle "mind" with reply orbs that orbit it,
// get pulled in for classification, and settle into category clusters.
// Hovering tilts it toward the cursor, sweeping across it spins it (with inertia),
// and particles bulge away from the pointer. One draw call per layer; per-frame CPU work is O(orbs).
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import * as THREE from "three";

export type OrbState = "hidden" | "orbit" | "core" | "cluster";
export interface Orb {
  id: string;
  color: string;
  state: OrbState;
  cluster: number;
  clusters: number;
  slot: number;
  slots: number;
}
export interface ClusterMark {
  color: string;
  index: number;
  count: number;
}

type Layout = "hero" | "wide";

export interface SceneProps {
  orbs: Orb[];
  clusterMarks?: ClusterMark[];
  highlight?: number | null;
  /** Orb id to emphasise (e.g. the reply shown in the hero card). */
  focusId?: string | null;
  pulseKey?: number;
  energy?: number;
  quality: "high" | "low";
  onHover?: (id: string | null, x: number, y: number) => void;
  onSelect?: (id: string) => void;
  onCoreClick?: () => void;
  layout?: Layout;
}

/* ------------------------------ pointer state ------------------------------ */

interface PointerState {
  x: number; // canvas-local NDC, -1..1
  y: number; // canvas-local NDC, -1..1 (up is +)
  over: boolean;
  travel: number; // cumulative horizontal movement; the spin reads the change per frame
  lock: boolean; // an orb is under the cursor: hold the scene still
}
const PointerCtx = createContext<RefObject<PointerState> | null>(null);
const usePointer = () => useContext(PointerCtx)!;

/** Tracks the pointer relative to the canvas (not the window), including touch. */
function PointerTracker() {
  const { gl } = useThree();
  const pointerRef = usePointer();
  useEffect(() => {
    const el = gl.domElement;
    const toNdc = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)] as const;
    };
    const enter = (e: PointerEvent) => {
      const [x, y] = toNdc(e);
      Object.assign(pointerRef.current, { x, y, over: true });
    };
    const move = (e: PointerEvent) => {
      const [x, y] = toNdc(e);
      const p = pointerRef.current;
      if (p.over) p.travel += x - p.x;
      Object.assign(p, { x, y, over: true });
    };
    const leave = () => {
      pointerRef.current.over = false;
      pointerRef.current.lock = false;
    };
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointermove", move, { passive: true });
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [gl, pointerRef]);
  return null;
}

/* --------------------------------- layout --------------------------------- */

interface Ellipse {
  rx: number;
  ry: number;
  cy: number;
}

export function clusterCenter(i: number, n: number, e: Ellipse, out = new THREE.Vector3()) {
  const th = ((i + 0.5) / Math.max(n, 1)) * Math.PI * 2 + Math.PI / 2;
  return out.set(Math.cos(th) * e.rx, Math.sin(th) * e.ry + e.cy, 0.25);
}

/** Cluster ring sized to the visible canvas, so clusters never clip at any aspect ratio. */
function useEllipse(layout: Layout): Ellipse {
  const vp = useThree((s) => s.viewport);
  return useMemo(
    () =>
      layout === "hero"
        ? { rx: 2.9, ry: 2.2, cy: 0 }
        : { rx: Math.max(1.6, Math.min(3.6, vp.width / 2 - 0.6)), ry: Math.max(1.3, Math.min(2.3, vp.height / 2 - 1.05)), cy: 0.3 },
    [layout, vp.width, vp.height],
  );
}

/* --------------------------------- shaders --------------------------------- */

const coreVert = /* glsl */ `
  uniform float uTime; uniform float uPulse; uniform float uEnergy; uniform float uPR;
  uniform vec2 uPointer; uniform float uHover; uniform float uAspect;
  attribute float aSeed;
  varying float vMix; varying float vAlpha; varying float vGlow;
  void main() {
    vec3 p = position;
    float n = sin(p.x * 3.1 + uTime * 0.7 + aSeed * 6.28) * sin(p.y * 2.7 - uTime * 0.5) * sin(p.z * 3.3 + uTime * 0.6);
    float r = 1.0 + n * (0.1 + 0.18 * uEnergy) + uPulse * 0.35 * sin(aSeed * 20.0 + uTime * 9.0);
    p *= r;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    // Cursor bulge: push particles outward from the pointer in screen space.
    vec2 ndc = gl_Position.xy / gl_Position.w;
    vec2 d = ndc - uPointer;
    d.x *= uAspect;
    float f = uHover * smoothstep(0.32, 0.0, length(d));
    gl_Position.xy += normalize(d + 1e-5) * f * (0.1 + aSeed * 0.06) * gl_Position.w / vec2(uAspect, 1.0);

    gl_PointSize = (1.4 + aSeed * 2.8) * uPR * (7.0 / -mv.z) * (1.0 + uPulse * 0.8 + f * 1.4);
    vMix = clamp(p.y * 0.42 + 0.5 + n * 0.3, 0.0, 1.0);
    vAlpha = 0.25 + 0.75 * smoothstep(-0.3, 0.9, n + 0.35);
    vGlow = f;
  }
`;
const coreFrag = /* glsl */ `
  uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
  varying float vMix; varying float vAlpha; varying float vGlow;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    vec3 col = vMix < 0.5 ? mix(uA, uB, vMix * 2.0) : mix(uB, uC, (vMix - 0.5) * 2.0);
    col = mix(col, vec3(0.92, 1.0, 0.75), vGlow * 0.55);
    gl_FragColor = vec4(col, a * a * min(1.0, vAlpha + vGlow));
  }
`;

// Glass orb: dark tinted body, bright fresnel rim, slow inner swirl, a drifting energy band and a specular glint.
const orbVert = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying vec3 vCol; varying vec3 vP;
  void main() {
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * (mat3(instanceMatrix) * normal));
    vV = normalize(-mv.xyz);
    #ifdef USE_INSTANCING_COLOR
      vCol = instanceColor;
    #else
      vCol = vec3(1.0);
    #endif
    vP = normal;
    gl_Position = projectionMatrix * mv;
  }
`;
const orbFrag = /* glsl */ `
  uniform float uTime;
  varying vec3 vN; varying vec3 vV; varying vec3 vCol; varying vec3 vP;
  void main() {
    vec3 n = normalize(vN);
    vec3 v = normalize(vV);
    float ndv = max(dot(n, v), 0.0);
    float fres = pow(1.0 - ndv, 2.4);
    float sw = sin(vP.x * 5.0 + uTime * 1.7) * sin(vP.y * 4.5 - uTime * 1.3) * sin(vP.z * 5.5 + uTime * 1.1);
    vec3 body = vCol * (0.16 + 0.24 * (0.5 + 0.5 * sw));
    float band = smoothstep(0.28, 0.0, abs(vP.y - 0.35 * sin(uTime * 0.9 + vP.x * 3.0))) * 0.35;
    vec3 L = normalize(vec3(-0.45, 0.65, 0.6));
    float spec = pow(max(dot(reflect(-L, n), v), 0.0), 26.0);
    vec3 col = body + vCol * (fres * 1.9 + band) + vCol * pow(ndv, 8.0) * 0.3 + vec3(1.0) * spec * 0.85;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

// Halo sprite: soft glow, a faint breathing ring, and an expanding ripple on hover/focus.
const glowVert = /* glsl */ `
  uniform float uPR;
  attribute float aSize; attribute vec3 aColor; attribute float aEmph; attribute float aRipple; attribute float aSeed;
  varying vec3 vColor; varying float vEmph; varying float vRipple; varying float vSeed;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPR * (360.0 / -mv.z) * (1.0 + aEmph * 0.35);
    vColor = aColor; vEmph = aEmph; vRipple = aRipple; vSeed = aSeed;
  }
`;
const glowFrag = /* glsl */ `
  uniform float uTime;
  varying vec3 vColor; varying float vEmph; varying float vRipple; varying float vSeed;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float halo = pow(smoothstep(0.5, 0.0, d), 3.0) * (0.45 + 0.4 * vEmph);
    float rr = 0.25 + 0.025 * sin(uTime * 1.8 + vSeed * 6.283);
    float ring = smoothstep(0.016, 0.0, abs(d - rr)) * (0.16 + 0.55 * vEmph);
    float rip = 0.0;
    if (vRipple < 1.0) {
      float r2 = 0.1 + vRipple * 0.38;
      rip = smoothstep(0.022, 0.0, abs(d - r2)) * (1.0 - vRipple);
    }
    gl_FragColor = vec4(mix(vColor, vec3(1.0), rip * 0.35), halo + ring + rip);
    #include <colorspace_fragment>
  }
`;

// Comet trail: fading dots along each orb's recent path.
const trailVert = /* glsl */ `
  uniform float uPR;
  attribute vec3 aColor; attribute float aAlpha; attribute float aSize;
  varying vec3 vColor; varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPR * (120.0 / -mv.z);
    vColor = aColor; vAlpha = aAlpha;
  }
`;
const trailFrag = /* glsl */ `
  varying vec3 vColor; varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    gl_FragColor = vec4(vColor, smoothstep(0.5, 0.05, d) * vAlpha);
    #include <colorspace_fragment>
  }
`;

const starVert = /* glsl */ `
  uniform float uTime; uniform float uPR; attribute float aSeed; varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (0.6 + aSeed * 1.6) * uPR;
    vA = 0.25 + 0.55 * (0.5 + 0.5 * sin(uTime * (0.5 + aSeed * 2.0) + aSeed * 40.0));
  }
`;
const starFrag = /* glsl */ `
  varying float vA;
  void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.78, 0.8, 1.0), smoothstep(0.5, 0.0, d) * vA); }
`;

/* ---------------------------------- helpers ---------------------------------- */

/** Deterministic PRNG (mulberry32) so geometry builds are pure. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randDir(r: () => number, out: THREE.Vector3) {
  const u = r() * 2 - 1;
  const th = r() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return out.set(Math.cos(th) * s, u, Math.sin(th) * s);
}
const damp = (dt: number, speed: number) => 1 - Math.exp(-dt * speed);

/* ---------------------------------- layers ---------------------------------- */

function Core({ count, pulseKey, energy, onCoreClick }: { count: number; pulseKey: number; energy: number; onCoreClick?: () => void }) {
  const ref = useRef<THREE.Points>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const hover = useRef(0);
  const lastPulse = useRef(pulseKey);
  const pointerRef = usePointer();
  const { gl } = useThree();
  const geo = useMemo(() => {
    const r = rng(42);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const golden = Math.PI * (3 - Math.sqrt(5));
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const shell = i < count * 0.72;
      const y = 1 - (i / (count - 1)) * 2;
      const rr = Math.sqrt(1 - y * y);
      const th = golden * i;
      if (shell) v.set(Math.cos(th) * rr, y, Math.sin(th) * rr).multiplyScalar(1.25);
      else randDir(r, v).multiplyScalar(0.25 + r() * 0.95);
      pos.set([v.x, v.y, v.z], i * 3);
      seed[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    return g;
  }, [count]);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPulse: { value: 0 },
      uEnergy: { value: 0 },
      uPR: { value: Math.min(gl.getPixelRatio(), 2) },
      uPointer: { value: new THREE.Vector2(9, 9) },
      uHover: { value: 0 },
      uAspect: { value: 1 },
      uA: { value: new THREE.Color("#6d5cff") },
      uB: { value: new THREE.Color("#9b8cff") },
      uC: { value: new THREE.Color("#4fe3d1") },
    }),
    [gl],
  );
  useFrame((state, dt) => {
    const u = mat.current?.uniforms;
    if (!u) return;
    const p = pointerRef.current;
    if (pulseKey !== lastPulse.current) {
      lastPulse.current = pulseKey;
      u.uPulse.value = 1;
    }
    u.uTime.value += dt;
    u.uPulse.value *= Math.exp(-dt * 2.4);
    u.uAspect.value = state.size.width / Math.max(state.size.height, 1);
    (u.uPointer.value as THREE.Vector2).set(p.x, p.y);
    u.uHover.value += ((p.over ? 1 : 0) - u.uHover.value) * damp(dt, 5);
    const target = Math.min(1, energy + hover.current);
    u.uEnergy.value += (target - u.uEnergy.value) * damp(dt, 3);
    if (ref.current) {
      ref.current.rotation.y += dt * (0.08 + u.uEnergy.value * 0.3);
      ref.current.rotation.x = Math.sin(u.uTime.value * 0.2) * 0.15;
    }
  });
  return (
    <group>
      <points ref={ref} geometry={geo} frustumCulled={false}>
        <shaderMaterial
          ref={mat}
          vertexShader={coreVert}
          fragmentShader={coreFrag}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {/* invisible hit sphere for hover + click */}
      <mesh
        onPointerOver={() => {
          hover.current = 0.7;
          document.body.style.cursor = onCoreClick ? "pointer" : "";
        }}
        onPointerOut={() => {
          hover.current = 0;
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (mat.current) mat.current.uniforms.uPulse.value = 1;
          onCoreClick?.();
        }}
      >
        <sphereGeometry args={[1.3, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

const RINGS = [
  { r: 1.75, tilt: [1.2, 0.2, 0] as [number, number, number], color: "#9b8cff", o: 0.22 },
  { r: 2.1, tilt: [1.45, -0.5, 0] as [number, number, number], color: "#4fe3d1", o: 0.14 },
  { r: 2.5, tilt: [1.0, 0.7, 0] as [number, number, number], color: "#d4ff4f", o: 0.08 },
];

function Rings({ energy }: { energy: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    g.current?.children.forEach((c, i) => {
      c.rotation.z += dt * (0.05 + i * 0.03) * (i % 2 ? -1 : 1) * (1 + energy * 2);
    });
  });
  return (
    <group ref={g}>
      {RINGS.map((r, i) => (
        <mesh key={i} rotation={r.tilt}>
          <torusGeometry args={[r.r, 0.004, 6, 220]} />
          <meshBasicMaterial color={r.color} transparent opacity={r.o} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
  );
}

function Stars({ count }: { count: number }) {
  const { gl } = useThree();
  const ref = useRef<THREE.Points>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const geo = useMemo(() => {
    const r = rng(7);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      randDir(r, v).multiplyScalar(14 + r() * 22);
      pos.set([v.x, v.y, v.z], i * 3);
      seed[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    return g;
  }, [count]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uPR: { value: Math.min(gl.getPixelRatio(), 2) } }), [gl]);
  useFrame((_, dt) => {
    if (mat.current) mat.current.uniforms.uTime.value += dt;
    if (ref.current) ref.current.rotation.y += dt * 0.01;
  });
  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={mat} vertexShader={starVert} fragmentShader={starFrag} uniforms={uniforms} transparent depthWrite={false} />
    </points>
  );
}

const tmpObj = new THREE.Object3D();
const tmpV = new THREE.Vector3();
const tmpC = new THREE.Color();
const X_AXIS = new THREE.Vector3(1, 0, 0);

/** Trail samples per orb, and seconds between samples. */
const TRAIL = 30;
const TRAIL_STEP = 0.016;

interface OrbSim {
  s1: number;
  s2: number;
  phase: number; // advances with (slowed) time, so hovering can freeze an orb
  pos: THREE.Vector3;
  scale: number;
  emph: number; // 0..1 hover/focus emphasis, damped
  ripple: number; // 0..1, restarts when the orb is hovered
}

function Orbs({
  orbs,
  highlight,
  focusId,
  layout,
  onHover,
  onSelect,
}: Pick<SceneProps, "orbs" | "highlight" | "focusId" | "onHover" | "onSelect"> & { layout: Layout }) {
  const max = Math.max(orbs.length, 1);
  const ellipse = useEllipse(layout);
  const hero = layout === "hero";
  const pointerRef = usePointer();
  const vis = useRef<THREE.InstancedMesh>(null);
  const hit = useRef<THREE.InstancedMesh>(null);
  const glow = useRef<THREE.Points>(null);
  const trails = useRef<THREE.Points>(null);
  const lines = useRef<THREE.LineSegments>(null);
  const orbMat = useRef<THREE.ShaderMaterial>(null);
  const glowMat = useRef<THREE.ShaderMaterial>(null);
  const hovered = useRef<number | null>(null);
  const { gl } = useThree();

  // Per-orb simulation state lives in refs: mutated every frame, persists across prop updates.
  const sim = useRef<OrbSim[]>([]);
  const history = useRef({ buf: new Float32Array(0), head: 0, acc: 0, slow: 1 });

  const glowGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(max), 1));
    g.setAttribute("aEmph", new THREE.BufferAttribute(new Float32Array(max), 1));
    g.setAttribute("aRipple", new THREE.BufferAttribute(new Float32Array(max), 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(Array.from({ length: max }, (_, i) => (i * 0.618) % 1)), 1));
    return g;
  }, [max]);
  const trailGeo = useMemo(() => {
    const n = max * TRAIL;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(n), 1));
    return g;
  }, [max]);
  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(max * 6), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(max * 6), 3));
    return g;
  }, [max]);
  const pr = Math.min(gl.getPixelRatio(), 2);
  const orbUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const glowUniforms = useMemo(() => ({ uPR: { value: pr }, uTime: { value: 0 } }), [pr]);
  const trailUniforms = useMemo(() => ({ uPR: { value: pr } }), [pr]);

  useFrame((_, dt) => {
    const gGeo = glow.current?.geometry;
    const tGeo = trails.current?.geometry;
    const lGeo = lines.current?.geometry;
    if (!gGeo || !tGeo || !lGeo) return;
    if (orbMat.current) orbMat.current.uniforms.uTime.value += dt;
    if (glowMat.current) glowMat.current.uniforms.uTime.value += dt;

    const hist = history.current;
    if (hist.buf.length !== max * TRAIL * 3) {
      hist.buf = new Float32Array(max * TRAIL * 3);
      sim.current.slice(0, max).forEach((st, i) => {
        for (let j = 0; j < TRAIL; j++) hist.buf.set([st.pos.x, st.pos.y, st.pos.z], (i * TRAIL + j) * 3);
      });
    }
    // Everything slows right down while an orb is under the cursor, so it's easy to catch.
    hist.slow += ((hovered.current != null ? 0.12 : 1) - hist.slow) * damp(dt, 6);
    const k = damp(dt, 3.2);

    const states = sim.current;
    while (states.length < orbs.length) {
      const i = states.length;
      const s1 = ((i * 0.618034) % 1) + 0.0001;
      const s2 = (i * 0.414213 + 0.3) % 1;
      const pos = new THREE.Vector3(Math.cos(s1 * 6.283), (s2 - 0.5) * 1.2, Math.sin(s1 * 6.283)).normalize().multiplyScalar(12);
      states.push({ s1, s2, phase: 0, pos, scale: 0, emph: 0, ripple: 1 });
      for (let j = 0; j < TRAIL; j++) hist.buf.set([pos.x, pos.y, pos.z], (i * TRAIL + j) * 3);
    }

    hist.acc += dt;
    const sample = hist.acc >= TRAIL_STEP;
    if (sample) {
      hist.acc = 0;
      hist.head = (hist.head + 1) % TRAIL;
    }

    const gp = gGeo.attributes.position as THREE.BufferAttribute;
    const gc = gGeo.attributes.aColor as THREE.BufferAttribute;
    const gs = gGeo.attributes.aSize as THREE.BufferAttribute;
    const ge = gGeo.attributes.aEmph as THREE.BufferAttribute;
    const gr = gGeo.attributes.aRipple as THREE.BufferAttribute;
    const tp = tGeo.attributes.position as THREE.BufferAttribute;
    const tc = tGeo.attributes.aColor as THREE.BufferAttribute;
    const ta = tGeo.attributes.aAlpha as THREE.BufferAttribute;
    const ts = tGeo.attributes.aSize as THREE.BufferAttribute;
    const lp = lGeo.attributes.position as THREE.BufferAttribute;
    const lc = lGeo.attributes.color as THREE.BufferAttribute;

    orbs.forEach((o, i) => {
      const st = states[i];
      const isHovered = hovered.current === i;
      st.phase += dt * (isHovered ? 0 : hist.slow);
      const t = st.phase;

      if (o.state === "hidden") {
        tmpV.set(Math.cos(st.s1 * 6.28) * 11, (st.s2 - 0.5) * 6, Math.sin(st.s1 * 6.28) * 11 - 4);
      } else if (o.state === "orbit") {
        const a = st.s1 * 6.283 + t * (hero ? 0.09 + st.s2 * 0.09 : 0.12 + st.s2 * 0.12);
        const r = hero ? 2.35 + st.s2 * 1.9 : 2.05 + st.s2 * 1.1;
        tmpV.set(Math.cos(a) * r, Math.sin(a * 1.3 + st.s1 * 9) * 0.55, Math.sin(a) * r * (hero ? 0.38 : 1));
        tmpV.applyAxisAngle(X_AXIS, (st.s2 - 0.5) * 0.9);
      } else if (o.state === "core") {
        const a = st.s1 * 6.283 + t * (1.4 + st.s2);
        tmpV.set(Math.cos(a) * 0.55, Math.sin(a * 1.7) * 0.45, Math.sin(a) * 0.55);
      } else {
        clusterCenter(o.cluster, o.clusters, ellipse, tmpV);
        const a = (o.slot / Math.max(o.slots, 1)) * 6.283 + t * 0.35;
        const r = o.slots > 1 ? 0.22 + o.slots * 0.02 : 0;
        tmpV.x += Math.cos(a) * r;
        tmpV.y += Math.sin(a) * r;
        tmpV.z += Math.sin(a * 2 + i) * 0.05;
      }
      st.pos.lerp(tmpV, k);

      const focused = focusId != null && o.id === focusId;
      const dim = highlight != null && o.state === "cluster" && o.cluster !== highlight;
      const lit = isHovered || focused || (highlight != null && o.cluster === highlight && o.state === "cluster");
      const base = hero ? 1.05 : 1;
      const targetScale = o.state === "hidden" ? 0 : base * (isHovered ? 1.75 : focused ? 1.5 : lit ? 1.4 : dim ? 0.7 : 1);
      st.scale += (targetScale - st.scale) * damp(dt, 7);
      st.emph += ((lit ? 1 : 0) - st.emph) * damp(dt, 6);
      st.ripple = isHovered || focused ? (st.ripple + dt * 0.9) % 1 : Math.min(1, st.ripple + dt);

      tmpObj.position.copy(st.pos);
      tmpObj.scale.setScalar(st.scale);
      tmpObj.updateMatrix();
      vis.current?.setMatrixAt(i, tmpObj.matrix);
      tmpObj.scale.setScalar(st.scale > 0.05 ? base : 0.0001);
      tmpObj.updateMatrix();
      hit.current?.setMatrixAt(i, tmpObj.matrix);

      tmpC.set(o.color).multiplyScalar(dim ? 0.35 : 1);
      vis.current?.setColorAt(i, tmpC);
      gp.setXYZ(i, st.pos.x, st.pos.y, st.pos.z);
      gc.setXYZ(i, tmpC.r, tmpC.g, tmpC.b);
      gs.setX(i, st.scale * (o.state === "core" ? 0.75 : 1));
      ge.setX(i, st.emph);
      gr.setX(i, isHovered || focused ? st.ripple : 1);

      // comet trail: newest sample is the live position
      if (sample) hist.buf.set([st.pos.x, st.pos.y, st.pos.z], (i * TRAIL + hist.head) * 3);
      const visible = o.state !== "hidden" && st.scale > 0.05;
      for (let j = 0; j < TRAIL; j++) {
        const slot = (hist.head - j + TRAIL) % TRAIL;
        const o3 = (i * TRAIL + slot) * 3;
        const n = i * TRAIL + j;
        if (j === 0) tp.setXYZ(n, st.pos.x, st.pos.y, st.pos.z);
        else tp.setXYZ(n, hist.buf[o3], hist.buf[o3 + 1], hist.buf[o3 + 2]);
        const f = 1 - j / TRAIL;
        tc.setXYZ(n, tmpC.r, tmpC.g, tmpC.b);
        ta.setX(n, visible ? f * f * (0.22 + st.emph * 0.3) * (dim ? 0.3 : 1) : 0);
        ts.setX(n, st.scale * (0.25 + 0.75 * f));
      }

      // tether to the core while being analysed, to the cluster centre once sorted
      const lineAlpha =
        focused || isHovered ? 0.8 : o.state === "core" ? 0.9 : o.state === "cluster" ? (dim ? 0.05 : 0.35) : o.state === "orbit" ? 0.05 : 0;
      if (o.state === "cluster") clusterCenter(o.cluster, o.clusters, ellipse, tmpV);
      else tmpV.set(0, 0, 0);
      lp.setXYZ(i * 2, tmpV.x, tmpV.y, tmpV.z);
      lp.setXYZ(i * 2 + 1, st.pos.x, st.pos.y, st.pos.z);
      lc.setXYZ(i * 2, tmpC.r * lineAlpha * 0.15, tmpC.g * lineAlpha * 0.15, tmpC.b * lineAlpha * 0.15);
      lc.setXYZ(i * 2 + 1, tmpC.r * lineAlpha, tmpC.g * lineAlpha, tmpC.b * lineAlpha);
    });

    if (vis.current) {
      vis.current.instanceMatrix.needsUpdate = true;
      if (vis.current.instanceColor) vis.current.instanceColor.needsUpdate = true;
    }
    if (hit.current) {
      hit.current.instanceMatrix.needsUpdate = true;
      hit.current.boundingSphere = null;
    }
    for (const a of [gp, gc, gs, ge, gr, tp, tc, ta, ts, lp, lc]) a.needsUpdate = true;
  });

  const move = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const id = e.instanceId;
    if (id == null || orbs[id]?.state === "hidden") return;
    hovered.current = id;
    pointerRef.current.lock = true;
    onHover?.(orbs[id].id, e.nativeEvent.clientX, e.nativeEvent.clientY);
    document.body.style.cursor = onSelect ? "pointer" : "crosshair";
  };
  const out = () => {
    hovered.current = null;
    pointerRef.current.lock = false;
    document.body.style.cursor = "";
    onHover?.(null, 0, 0);
  };

  return (
    <group>
      <lineSegments ref={lines} geometry={lineGeo} frustumCulled={false}>
        <lineBasicMaterial vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      <points ref={trails} geometry={trailGeo} frustumCulled={false}>
        <shaderMaterial
          vertexShader={trailVert}
          fragmentShader={trailFrag}
          uniforms={trailUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <points ref={glow} geometry={glowGeo} frustumCulled={false}>
        <shaderMaterial
          ref={glowMat}
          vertexShader={glowVert}
          fragmentShader={glowFrag}
          uniforms={glowUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <instancedMesh ref={vis} args={[undefined, undefined, max]} frustumCulled={false}>
        <sphereGeometry args={[0.078, 28, 28]} />
        <shaderMaterial ref={orbMat} vertexShader={orbVert} fragmentShader={orbFrag} uniforms={orbUniforms} />
      </instancedMesh>
      <instancedMesh
        ref={hit}
        args={[undefined, undefined, max]}
        frustumCulled={false}
        onPointerMove={move}
        onPointerOut={out}
        onClick={(e) => {
          e.stopPropagation();
          if (e.instanceId != null && orbs[e.instanceId]) onSelect?.(orbs[e.instanceId].id);
        }}
      >
        <sphereGeometry args={[0.34, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

function ClusterHalos({ marks, highlight, layout }: { marks: ClusterMark[]; highlight?: number | null; layout: Layout }) {
  const ellipse = useEllipse(layout);
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    g.current?.children.forEach((c, i) => {
      c.rotation.z += dt * 0.3 * (i % 2 ? 1 : -1);
      const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
      const target = highlight == null ? 0.35 : highlight === marks[i]?.index ? 0.9 : 0.1;
      m.opacity += (target - m.opacity) * damp(dt, 5);
    });
  });
  return (
    <group ref={g}>
      {marks.map((m) => {
        const c = clusterCenter(m.index, m.count, ellipse);
        return (
          <mesh key={m.index} position={c}>
            <torusGeometry args={[0.4, 0.006, 6, 90, Math.PI * 1.6]} />
            <meshBasicMaterial color={m.color} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Shrinks the core in the wide layout so it sits inside the cluster ring; enlarges it in the hero. */
function Hub({ layout, children }: { layout: Layout; children: ReactNode }) {
  const e = useEllipse(layout);
  const s = layout === "hero" ? 1.22 : Math.min(0.85, Math.max(0.45, Math.min(e.rx, e.ry) / 2.6));
  return <group scale={s}>{children}</group>;
}

const cameraZ = (layout: Layout, width: number) => (layout === "wide" ? 8.4 : width < 700 ? 9.6 : 6.4);

/** Pulls the camera back on narrow screens so everything stays in frame. */
function Rig({ layout }: { layout: Layout }) {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.position.set(0, 0, cameraZ(layout, size.width));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width, layout]);
  return null;
}

/**
 * Hover-driven motion: the scene tilts toward the cursor, and sweeping across it adds spin that
 * decays with inertia. While an orb is under the cursor everything holds still so it can't slip away.
 * The wide (run) layout tilts gently and springs back so clusters stay readable.
 */
function Spin({ layout, children }: { layout: Layout; children: ReactNode }) {
  const g = useRef<THREE.Group>(null);
  const pointerRef = usePointer();
  const s = useRef({ angle: 0, vel: 0, tx: 0, ty: 0, seen: 0 });
  useFrame((_, dt) => {
    const grp = g.current;
    if (!grp) return;
    const p = pointerRef.current;
    const st = s.current;
    const hero = layout === "hero";
    const moved = p.travel - st.seen;
    st.seen = p.travel;
    if (!p.lock) st.vel = THREE.MathUtils.clamp(st.vel + moved * (hero ? 5.5 : 2), -3.5, 3.5);
    st.vel *= Math.exp(-dt * (p.lock ? 9 : hero ? 2.2 : 3));
    st.angle += st.vel * dt + (hero && !p.lock ? dt * 0.04 : 0);
    if (!hero) st.angle *= Math.exp(-dt * 1.5);
    if (!p.lock) {
      const k = damp(dt, 3);
      st.ty += ((p.over ? p.x * (hero ? 0.5 : 0.3) : 0) - st.ty) * k;
      st.tx += ((p.over ? -p.y * (hero ? 0.3 : 0.18) : 0) - st.tx) * k;
    }
    grp.rotation.y = st.angle + st.ty;
    grp.rotation.x = st.tx;
  });
  return <group ref={g}>{children}</group>;
}

export default function ReplyCoreScene({
  orbs,
  clusterMarks = [],
  highlight = null,
  focusId = null,
  pulseKey = 0,
  energy = 0,
  quality,
  onHover,
  onSelect,
  onCoreClick,
  layout = "hero",
  frameloop,
}: SceneProps & { frameloop: "always" | "never" | "demand" }) {
  const pointer = useRef<PointerState>({ x: 9, y: 9, over: false, travel: 0, lock: false });
  const low = quality === "low";
  return (
    <Canvas
      frameloop={frameloop}
      dpr={low ? 1 : [1, 1.6]}
      gl={{ antialias: !low, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: 42, position: [0, 0, cameraZ(layout, 1200)], near: 0.1, far: 80 }}
      style={{ touchAction: "pan-y" }}
    >
      <PointerCtx.Provider value={pointer}>
        <PointerTracker />
        <Rig layout={layout} />
        <Stars count={low ? 250 : 700} />
        <Spin layout={layout}>
          <Hub layout={layout}>
            <Core count={low ? 1800 : 5200} pulseKey={pulseKey} energy={energy} onCoreClick={onCoreClick} />
            <Rings energy={energy} />
          </Hub>
          <ClusterHalos marks={clusterMarks} highlight={highlight} layout={layout} />
          <Orbs orbs={orbs} highlight={highlight} focusId={focusId} layout={layout} onHover={onHover} onSelect={onSelect} />
        </Spin>
      </PointerCtx.Provider>
    </Canvas>
  );
}
