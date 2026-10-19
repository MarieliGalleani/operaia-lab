/**
 * Motor do Escritorio 3D (Interface 3.0) — three.js puro, sem Vue.
 *
 * A view monta o canvas, passa o andar e o status de cada pessoa, e
 * registra os elementos das etiquetas (nomes) para o motor posicionar a
 * cada quadro. Toda a cena e geometria simples (caixas e cilindros), sem
 * assets externos.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CAST, type CastMember, type Office3DFloor, type RoomDef } from "./floors-3d";

export type PersonState = "busy" | "idle";
export type SceneTheme = "dark" | "light";

export interface PersonStatus {
  readonly id: string;
  readonly state: PersonState;
}

interface Palette {
  readonly clear: number;
  readonly floor: string;
  readonly grid1: number;
  readonly grid2: number;
  readonly wallBack: string;
  readonly wallSide: string;
  readonly trim: string;
  readonly rug: string;
  readonly meetingFloor: string;
  readonly serverFloor: string;
  readonly hemiSky: number;
  readonly hemiGround: number;
  readonly hemi: number;
  readonly sun: number;
}

const PALETTES: Record<SceneTheme, Palette> = {
  dark: {
    clear: 0x0a0d14, floor: "#1d2740", grid1: 0x2a3654, grid2: 0x243049,
    wallBack: "#26324d", wallSide: "#212c45", trim: "#34415e", rug: "#2a2350",
    meetingFloor: "#223056", serverFloor: "#161f33",
    hemiSky: 0xd6e2ff, hemiGround: 0x2a3148, hemi: 1.15, sun: 1.0,
  },
  light: {
    clear: 0xeef1f6, floor: "#dfe5ee", grid1: 0xc8d0dc, grid2: 0xd3dae4,
    wallBack: "#c9d2df", wallSide: "#bcc7d6", trim: "#aab6c8", rug: "#d9d2f2",
    meetingFloor: "#d3dcf0", serverFloor: "#c4ccd8",
    hemiSky: 0xffffff, hemiGround: 0x9aa6b8, hemi: 1.0, sun: 0.85,
  },
};

const W = 24;
const D = 14;
const HOME = new THREE.Vector3(22, 20, 22);

interface Person {
  readonly id: string;
  readonly cast: CastMember;
  readonly group: THREE.Group;
  readonly sprite: THREE.Sprite;
  readonly height: number;
  /** Posicao "de trabalho": em pe ao lado da mesa. */
  readonly homePos: THREE.Vector3 | null;
  readonly screen: THREE.Mesh | null;
  state: PersonState;
  atHome: boolean;
  path: THREE.Vector2[] | null;
  seg: number;
  t: number;
  phase: number;
  nextStroll: number;
  tag: HTMLElement | null;
}

export interface OfficeSceneOptions {
  readonly theme: SceneTheme;
  readonly reducedMotion: boolean;
}

export class OfficeScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-10, 10, 10, -10, -100, 200);
  private readonly controls: OrbitControls;
  private readonly hemi: THREE.HemisphereLight;
  private readonly sun: THREE.DirectionalLight;
  private readonly clock = new THREE.Clock();
  private readonly raycaster = new THREE.Raycaster();
  private readonly materials = new Map<string, THREE.MeshLambertMaterial>();
  private floorGroup: THREE.Group | null = null;
  private people: Person[] = [];
  private blinkers: { mat: THREE.MeshLambertMaterial; speed: number; phase: number }[] = [];
  private floor: Office3DFloor | null = null;
  private statuses = new Map<string, PersonState>();
  private theme: SceneTheme;
  private readonly reducedMotion: boolean;
  private frame = 0;
  private uniqueSeq = 0;
  private fitZoom = 1;
  private sized = false;
  private disposed = false;
  private readonly tmp = new THREE.Vector3();
  private readonly loader = new THREE.TextureLoader();
  private readonly textures = new Map<string, THREE.Texture>();

  constructor(private readonly canvas: HTMLCanvasElement, options: OfficeSceneOptions) {
    this.theme = options.theme;
    this.reducedMotion = options.reducedMotion;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera.position.copy(HOME);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minZoom = 0.6;
    this.controls.maxZoom = 3;
    this.controls.minPolarAngle = Math.PI * 0.12;
    this.controls.maxPolarAngle = Math.PI * 0.42;
    this.controls.screenSpacePanning = true;
    this.controls.autoRotateSpeed = 0.6;

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 0.8);
    this.sun.position.set(10, 22, 8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18; sc.near = 1; sc.far = 60;
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun);
    const fill = new THREE.DirectionalLight(0x8fa8ff, 0.25);
    fill.position.set(-12, 10, -6);
    this.scene.add(fill);
    this.applyLights();

    this.loop = this.loop.bind(this);
    this.frame = requestAnimationFrame(this.loop);
  }

  // ---------------------------------------------------------------- API

  load(floor: Office3DFloor, statuses: readonly PersonStatus[]): void {
    this.floor = floor;
    this.statuses = new Map(statuses.map((s) => [s.id, s.state]));
    this.rebuild();
  }

  updateStatus(statuses: readonly PersonStatus[]): void {
    this.statuses = new Map(statuses.map((s) => [s.id, s.state]));
    for (const p of this.people) {
      const next = this.statuses.get(p.id) ?? "idle";
      if (next === p.state) continue;
      p.state = next;
      if (p.screen) this.setScreen(p.screen, next === "busy");
      if (next === "busy" && !p.atHome && p.homePos) this.goBackToSeat(p);
    }
  }

  setTheme(theme: SceneTheme): void {
    if (theme === this.theme) return;
    this.theme = theme;
    this.applyLights();
    this.rebuild();
  }

  /** A view registra o elemento da etiqueta de cada pessoa; o motor o posiciona. */
  bindTag(id: string, el: HTMLElement | null): void {
    const p = this.people.find((x) => x.id === id);
    if (p) p.tag = el;
  }

  pick(clientX: number, clientY: number): string | null {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.people.map((p) => p.group), true);
    for (const hit of hits) {
      let o: THREE.Object3D | null = hit.object;
      while (o) {
        const id = o.userData["personId"] as string | undefined;
        if (id) return id;
        o = o.parent;
      }
    }
    return null;
  }

  resetCamera(): void {
    this.camera.position.copy(HOME);
    this.camera.zoom = this.fitZoom;
    this.camera.updateProjectionMatrix();
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  setAutoRotate(on: boolean): void {
    this.controls.autoRotate = on;
  }

  resize(width: number, height: number): void {
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    const view = 12;
    this.camera.left = -view * aspect;
    this.camera.right = view * aspect;
    this.camera.top = view;
    this.camera.bottom = -view;
    this.fitZoom = Math.min(1.45, Math.max(0.7, aspect < 1 ? aspect * 1.25 : 1.3));
    if (!this.sized) {
      this.camera.zoom = this.fitZoom;
      this.sized = true;
    }
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.clearFloor();
    this.controls.dispose();
    for (const m of this.materials.values()) m.dispose();
    this.materials.clear();
    for (const tex of this.textures.values()) tex.dispose();
    this.textures.clear();
    this.renderer.dispose();
  }

  // ------------------------------------------------------------ montagem

  private applyLights(): void {
    const pal = PALETTES[this.theme];
    this.renderer.setClearColor(pal.clear, 1);
    this.hemi.color.setHex(pal.hemiSky);
    this.hemi.groundColor.setHex(pal.hemiGround);
    this.hemi.intensity = pal.hemi;
    this.sun.intensity = pal.sun;
  }

  private clearFloor(): void {
    if (this.floorGroup) {
      this.scene.remove(this.floorGroup);
      this.floorGroup.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
    }
    for (const p of this.people) {
      this.scene.remove(p.group);
      p.group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const m = mesh.material as THREE.Material | undefined;
        if (m && !(m instanceof THREE.MeshLambertMaterial)) m.dispose();
      });
    }
    this.floorGroup = null;
    this.people = [];
    this.blinkers = [];
    // Materiais unicos (telas, LEDs) pertencem ao andar que saiu de cena.
    for (const [key, m] of this.materials) {
      if (key.includes("#u")) {
        m.dispose();
        this.materials.delete(key);
      }
    }
  }

  private rebuild(): void {
    if (!this.floor) return;
    const tags = new Map(this.people.map((p) => [p.id, p.tag]));
    this.clearFloor();
    const floor = this.floor;
    const g = new THREE.Group();
    this.floorGroup = g;
    this.scene.add(g);
    this.shell(g, floor.accent);
    for (const room of floor.rooms) this.room(g, room);

    const seatedCast = floor.cast.filter((id) => !CAST[id]?.robot);
    floor.desks.forEach((d, i) => {
      const id = seatedCast[i];
      const state = id ? this.statuses.get(id) ?? "idle" : "idle";
      const screen = this.desk(g, d.x, d.z, Boolean(id) && state === "busy");
      if (id) {
        // em pe ao lado da mesa (lado esquerdo de quem olha), de frente para a camera
        this.addPerson(id, new THREE.Vector3(d.x - 1.25, 0, d.z + 0.15), screen);
      }
    });
    if (floor.ceo) {
      const ceoRoom = floor.rooms.find((r) => r.kind === "ceo");
      if (ceoRoom) this.addPerson(floor.ceo, new THREE.Vector3(ceoRoom.x - 1.75, 0, ceoRoom.z + 0.7), null);
    }
    for (const id of floor.cast.filter((x) => CAST[x]?.robot)) {
      const start = floor.hangouts[0] ?? [0, 2];
      const robot = this.addPerson(id, null, null);
      robot.group.position.set(start[0], 0, start[1]);
      robot.path = this.robotLoop();
      robot.seg = 0;
      robot.t = 0;
    }
    for (const p of this.people) p.tag = tags.get(p.id) ?? null;
  }

  private mat(color: string, opts?: { emissive?: string; emissiveIntensity?: number; transparent?: boolean; opacity?: number }, unique = false): THREE.MeshLambertMaterial {
    const key = color + JSON.stringify(opts ?? {});
    if (!unique) {
      const cached = this.materials.get(key);
      if (cached) return cached;
    }
    const m = new THREE.MeshLambertMaterial({ color: new THREE.Color(color) });
    if (opts?.emissive) {
      m.emissive = new THREE.Color(opts.emissive);
      m.emissiveIntensity = opts.emissiveIntensity ?? 0.5;
    }
    if (opts?.transparent) {
      m.transparent = true;
      m.opacity = opts.opacity ?? 0.25;
      m.depthWrite = false;
    }
    if (unique) this.materials.set(`${key}#u${++this.uniqueSeq}`, m);
    else this.materials.set(key, m);
    return m;
  }

  private box(parent: THREE.Object3D, w: number, h: number, d: number, color: string, x: number, y: number, z: number, opts?: Parameters<OfficeScene["mat"]>[1], unique = false): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mat(color, opts, unique));
    m.position.set(x, y + h / 2, z);
    m.castShadow = !opts?.transparent;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  private cyl(parent: THREE.Object3D, rt: number, rb: number, h: number, color: string, x: number, y: number, z: number, seg = 16): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), this.mat(color));
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  private shell(g: THREE.Group, accent: string): void {
    const pal = PALETTES[this.theme];
    this.box(g, W, 0.4, D, pal.floor, 0, -0.4, 0);
    const grid = new THREE.GridHelper(W, W, pal.grid1, pal.grid2);
    grid.scale.z = D / W;
    grid.position.y = 0.005;
    g.add(grid);
    this.box(g, W + 0.3, 3.2, 0.3, pal.wallBack, 0, 0, -D / 2 - 0.15);
    this.box(g, 0.3, 3.2, D, pal.wallSide, -W / 2 - 0.15, 0, 0);
    this.box(g, W + 0.3, 0.35, 0.15, pal.trim, 0, 0, D / 2 + 0.07);
    this.box(g, 0.15, 0.35, D, pal.trim, W / 2 + 0.07, 0, 0);
    this.box(g, W, 0.08, 0.06, accent, 0, 3.12, -D / 2 + 0.02, { emissive: accent, emissiveIntensity: 0.4 });
    for (const [x, z] of [[-11.3, -6.3], [11.2, -6.2], [-11.2, 6.2], [11.2, 6.2], [4.5, -6.3]] as const) this.plant(g, x, z);
  }

  private plant(g: THREE.Group, x: number, z: number): void {
    this.cyl(g, 0.28, 0.22, 0.5, "#5b4636", x, 0, z, 10);
    const a = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), this.mat("#2f8f5b"));
    a.position.set(x, 1.05, z);
    a.castShadow = true;
    g.add(a);
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), this.mat("#3fb172"));
    b.position.set(x + 0.15, 1.45, z - 0.1);
    b.castShadow = true;
    g.add(b);
  }

  private chair(g: THREE.Object3D, x: number, z: number, rot: number, color = "#3a4560"): void {
    const c = new THREE.Group();
    c.position.set(x, 0, z);
    c.rotation.y = rot;
    this.cyl(c, 0.05, 0.05, 0.4, "#3a4560", 0, 0, 0, 6);
    this.box(c, 0.5, 0.08, 0.5, color, 0, 0.4, 0);
    this.box(c, 0.5, 0.55, 0.08, color === "#3a4560" ? "#2e3852" : color, 0, 0.48, 0.22);
    g.add(c);
  }

  /** Mesa voltada para a frente: o monitor fica do lado de la, a pessoa olha para a camera. */
  private desk(g: THREE.Group, x: number, z: number, lit: boolean): THREE.Mesh {
    this.box(g, 1.7, 0.07, 0.85, "#b98a5a", x, 0.72, z);
    for (const [dx, dz] of [[-0.78, -0.36], [0.78, -0.36], [-0.78, 0.36], [0.78, 0.36]] as const) {
      this.box(g, 0.06, 0.72, 0.06, "#7a5a3c", x + dx, 0, z + dz);
    }
    this.box(g, 0.08, 0.3, 0.06, "#111a2e", x, 0.79, z + 0.25);
    this.box(g, 0.8, 0.48, 0.05, "#0b1220", x, 1.02, z + 0.28);
    const screen = this.box(g, 0.72, 0.4, 0.01, "#16233a", x, 1.06, z + 0.25, { emissive: "#38bdf8", emissiveIntensity: 0 }, true);
    this.setScreen(screen, lit);
    this.box(g, 0.5, 0.03, 0.18, "#1d2840", x, 0.79, z - 0.05);
    this.chair(g, x, z - 0.75, Math.PI);
    return screen;
  }

  private setScreen(screen: THREE.Mesh, lit: boolean): void {
    const m = screen.material as THREE.MeshLambertMaterial;
    m.color.set(lit ? "#38bdf8" : "#16233a");
    m.emissiveIntensity = lit ? 0.55 : 0;
  }

  private glassRoom(g: THREE.Group, x: number, z: number, w: number, d: number): void {
    const glass = { transparent: true, opacity: this.theme === "dark" ? 0.22 : 0.3 };
    this.box(g, 0.08, 2.3, d, "#9ec5ff", x - w / 2, 0, z, glass);
    this.box(g, w, 2.3, 0.08, "#9ec5ff", x, 0, z + d / 2, glass);
    this.box(g, 0.1, 0.12, d, "#5f86c4", x - w / 2, 2.3, z);
    this.box(g, w, 0.12, 0.1, "#5f86c4", x, 2.3, z + d / 2);
    this.box(g, w - 0.2, 0.02, d - 0.2, PALETTES[this.theme].meetingFloor, x, 0.01, z);
  }

  private blink(mesh: THREE.Mesh, speed: number): void {
    this.blinkers.push({ mat: mesh.material as THREE.MeshLambertMaterial, speed, phase: Math.random() * 6 });
  }

  private room(g: THREE.Group, r: RoomDef): void {
    const pal = PALETTES[this.theme];
    switch (r.kind) {
      case "meeting": {
        this.glassRoom(g, r.x, r.z, 6, 5.5);
        this.cyl(g, 1.3, 1.3, 0.08, "#c4935f", r.x, 0.72, r.z, 28);
        this.cyl(g, 0.15, 0.3, 0.72, "#7a5a3c", r.x, 0, r.z, 10);
        for (let a = 0; a < 6; a++) {
          const an = (a / 6) * Math.PI * 2;
          this.chair(g, r.x + Math.cos(an) * 1.85, r.z + Math.sin(an) * 1.85, -an + Math.PI / 2, "#5b4a86");
        }
        this.box(g, 2.6, 1.4, 0.06, "#e8ecf2", r.x, 0.9, -D / 2 + 0.05);
        break;
      }
      case "servers": {
        this.box(g, 4.6, 1.7, 0.18, pal.trim, r.x + 0.4, 0, r.z - 2.4);
        this.box(g, 0.18, 1.7, 3, pal.trim, r.x + 2.6, 0, r.z - 0.9);
        this.box(g, 4.4, 0.02, 4.6, pal.serverFloor, r.x + 0.3, 0.01, r.z);
        for (let i = 0; i < 3; i++) {
          const rz = r.z - 1.3 + i * 1.35;
          this.box(g, 0.9, 2.1, 0.9, "#2a3346", r.x - 0.6, 0, rz);
          for (let k = 0; k < 5; k++) {
            const c = k % 2 ? "#38bdf8" : "#3ddc97";
            const led = this.box(g, 0.02, 0.05, 0.5, c, r.x - 0.14, 0.35 + k * 0.32, rz, { emissive: c, emissiveIntensity: 1 }, true);
            this.blink(led, 1.5 + Math.random() * 4);
          }
        }
        break;
      }
      case "lounge": {
        this.box(g, 4.6, 0.02, 3.4, pal.rug, r.x, 0.01, r.z);
        this.box(g, 3.6, 0.45, 0.9, "#6d5bd0", r.x, 0, r.z + 1.1);
        this.box(g, 3.6, 0.6, 0.25, "#5a4bb5", r.x, 0.45, r.z + 1.45);
        this.box(g, 0.3, 0.7, 0.9, "#5a4bb5", r.x - 1.95, 0, r.z + 1.1);
        this.box(g, 0.3, 0.7, 0.9, "#5a4bb5", r.x + 1.95, 0, r.z + 1.1);
        this.box(g, 1.4, 0.35, 0.8, "#c4935f", r.x, 0, r.z - 0.2);
        this.box(g, 0.9, 0.5, 0.9, "#ff8fb1", r.x - 2.4, 0, r.z - 0.6);
        break;
      }
      case "copa": {
        this.box(g, 4, 0.95, 0.9, "#d9dde5", r.x, 0, r.z + 1.4);
        this.box(g, 4, 0.06, 0.95, "#9aa3b4", r.x, 0.95, r.z + 1.4);
        this.box(g, 0.9, 2, 0.8, "#c9d3e6", r.x + 2.6, 0, r.z + 1.4);
        this.box(g, 0.4, 0.45, 0.35, "#1d2840", r.x - 1, 1.01, r.z + 1.35);
        this.box(g, 0.12, 0.14, 0.12, "#ffffff", r.x - 0.4, 1.01, r.z + 1.3);
        this.box(g, 0.12, 0.14, 0.12, "#ffffff", r.x - 0.2, 1.01, r.z + 1.4);
        break;
      }
      case "kanban": {
        this.box(g, 4.2, 1.8, 0.06, "#e8ecf2", r.x, 0.8, r.z);
        const cols = ["#5b8cff", "#3ddc97", "#c4b2ff", "#ffb35c"];
        for (let c = 0; c < 4; c++) {
          for (let k = 0; k < 3 - (c % 2); k++) {
            this.box(g, 0.55, 0.4, 0.03, cols[c]!, r.x - 1.5 + c, 1.95 - k * 0.5, r.z + 0.05);
          }
        }
        break;
      }
      case "ceo": {
        this.glassRoom(g, r.x, r.z, 7, 5.4);
        this.box(g, 2.6, 0.07, 1.1, "#7a5a3c", r.x, 0.74, r.z + 0.6);
        this.box(g, 2.4, 0.74, 0.1, "#5b4636", r.x, 0, r.z + 1.1);
        this.box(g, 0.9, 0.52, 0.05, "#0b1220", r.x - 0.5, 1.0, r.z + 0.95);
        this.box(g, 0.8, 0.44, 0.01, "#38bdf8", r.x - 0.5, 1.04, r.z + 0.92, { emissive: "#38bdf8", emissiveIntensity: 0.5 });
        this.box(g, 0.9, 0.52, 0.05, "#0b1220", r.x + 0.5, 1.0, r.z + 0.95);
        this.box(g, 0.8, 0.44, 0.01, "#c4b2ff", r.x + 0.5, 1.04, r.z + 0.92, { emissive: "#c4b2ff", emissiveIntensity: 0.5 });
        this.chair(g, r.x, r.z - 0.5, Math.PI, "#5b4a86");
        this.box(g, 1.6, 1.8, 0.5, "#2b3852", r.x + 2.4, 0, r.z - 2.3);
        break;
      }
      case "reception": {
        this.box(g, 4.2, 1.05, 0.9, "#e8ecf2", r.x, 0, r.z);
        this.box(g, 4.4, 0.08, 1.1, "#c4b2ff", r.x, 1.05, r.z);
        this.box(g, 3, 0.02, 2.2, pal.rug, r.x, 0.01, r.z + 2);
        this.box(g, 1.2, 0.1, 0.06, "#c4b2ff", r.x, 1.4, r.z - 0.3, { emissive: "#c4b2ff", emissiveIntensity: 0.7 });
        break;
      }
      case "control": {
        const colors = ["#3ddc97", "#5cd0ff", "#5b8cff"];
        colors.forEach((c, i) => {
          this.box(g, 2.1, 1.2, 0.08, "#0b1220", r.x - 2.2 + i * 2.2, 1.2, -D / 2 + 0.1);
          this.box(g, 1.95, 1.05, 0.01, c, r.x - 2.2 + i * 2.2, 1.27, -D / 2 + 0.15, { emissive: c, emissiveIntensity: 0.35 });
        });
        this.box(g, 5.5, 0.8, 1, "#2a3346", r.x, 0, r.z + 0.6);
        this.box(g, 5.5, 0.06, 1.1, "#3a4560", r.x, 0.8, r.z + 0.6);
        break;
      }
      case "studio": {
        this.box(g, 4.6, 2.6, 0.1, "#e8ecf2", r.x, 0, -D / 2 + 0.2);
        this.box(g, 4.6, 0.02, 2.6, "#e8ecf2", r.x, 0.01, r.z + 0.2);
        this.cyl(g, 0.03, 0.03, 1.4, "#3a4560", r.x + 1.2, 0, r.z + 2.2, 6);
        this.box(g, 0.35, 0.28, 0.5, "#141414", r.x + 1.2, 1.4, r.z + 2.2);
        for (const dx of [-1.9, 1.9]) {
          this.cyl(g, 0.03, 0.03, 1.9, "#3a4560", r.x + dx, 0, r.z + 1.2, 6);
          const light = this.box(g, 0.6, 0.6, 0.15, "#ffffff", r.x + dx, 1.9, r.z + 1.2, { emissive: "#ffffff", emissiveIntensity: 0.5 });
          light.rotation.y = dx < 0 ? 0.5 : -0.5;
        }
        break;
      }
      case "shop": {
        const tones = ["#ff9d7a", "#5cd0ff", "#ffd25c", "#c4b2ff"];
        for (let i = 0; i < 3; i++) {
          const sx = r.x - 2 + i * 2;
          // estante aberta: fundo fino + laterais, produtos a mostra
          this.box(g, 1.5, 2.2, 0.08, "#5b4636", sx, 0, -D / 2 + 0.2);
          this.box(g, 0.06, 2.2, 0.55, "#4a382b", sx - 0.75, 0, -D / 2 + 0.48);
          this.box(g, 0.06, 2.2, 0.55, "#4a382b", sx + 0.75, 0, -D / 2 + 0.48);
          for (let s = 0; s < 3; s++) {
            this.box(g, 1.4, 0.04, 0.45, "#946c47", sx, 0.5 + s * 0.6, -D / 2 + 0.5);
            for (let k = 0; k < 3; k++) {
              this.box(g, 0.3, 0.3, 0.3, tones[(i + s + k) % 4]!, sx - 0.45 + k * 0.45, 0.54 + s * 0.6, -D / 2 + 0.5);
            }
          }
        }
        this.box(g, 2.8, 0.95, 0.8, "#2a3346", r.x, 0, r.z + 2);
        this.box(g, 2.9, 0.06, 0.9, "#ff9d7a", r.x, 0.95, r.z + 2);
        break;
      }
      case "approval": {
        this.glassRoom(g, r.x, r.z, 6.5, 5.5);
        this.box(g, 2.4, 0.07, 1, "#b98a5a", r.x, 0.74, r.z);
        this.box(g, 2.2, 1.3, 0.06, "#0b1220", r.x, 1.0, -D / 2 + 0.1);
        this.box(g, 2, 1.1, 0.01, "#ff9d7a", r.x, 1.1, -D / 2 + 0.15, { emissive: "#ff9d7a", emissiveIntensity: 0.3 });
        for (let k = 0; k < 4; k++) this.box(g, 0.4, 0.02, 0.55, "#ffffff", r.x - 0.6 + k * 0.05, 0.81 + k * 0.025, r.z + 0.1);
        this.chair(g, r.x, r.z - 0.75, Math.PI, "#5b4a86");
        break;
      }
    }
  }

  // --------------------------------------------------------------- gente
  //
  // Os bonecos sao os mesmos sprites pixel-art do Campus, desenhados como
  // "cartoes" que sempre olham para a camera (billboard). Ficam em pe ao
  // lado da mesa — sprite nao senta — e a mesa acende quando trabalham.

  private texture(url: string): THREE.Texture {
    let tex = this.textures.get(url);
    if (!tex) {
      tex = this.loader.load(url, (t) => {
        // Corrige a proporcao assim que a imagem chega.
        for (const p of this.people) {
          if (p.cast.sprite === url && t.image) {
            const img = t.image as { width: number; height: number };
            p.sprite.scale.set((p.height * img.width) / img.height, p.height, 1);
          }
        }
      });
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.LinearMipMapLinearFilter;
      this.textures.set(url, tex);
    }
    return tex;
  }

  private addPerson(id: string, home: THREE.Vector3 | null, screen: THREE.Mesh | null): Person {
    const cast: CastMember = CAST[id] ?? {
      id, name: id, role: "", color: "#8590a3", skin: "#e8b98f", hair: "#2b1d14",
      sprite: "/assets/office/avatars/av2.png", live: false,
    };
    const g = new THREE.Group();
    const tex = this.texture(cast.sprite);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.35, depthWrite: true });
    const sprite = new THREE.Sprite(mat);
    const height = 2.3;
    const img = tex.image as { width: number; height: number } | undefined;
    const aspect = img && img.height ? img.width / img.height : 0.5;
    sprite.scale.set(height * aspect, height, 1);
    sprite.center.set(0.5, 0.02);
    g.add(sprite);
    // sombra no chao
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    shadow.scale.set(1, 0.6, 1);
    g.add(shadow);

    g.userData["personId"] = id;
    sprite.userData["personId"] = id;
    const person: Person = {
      id, cast, group: g, sprite, height,
      homePos: home ? home.clone() : null,
      screen,
      state: this.statuses.get(id) ?? "idle",
      atHome: false,
      path: null,
      seg: 0,
      t: 0,
      phase: Math.random() * 6,
      nextStroll: 8 + Math.random() * 20,
      tag: null,
    };
    if (home) this.goHome(person);
    this.scene.add(g);
    this.people.push(person);
    return person;
  }

  private goHome(p: Person): void {
    if (!p.homePos) return;
    p.group.position.set(p.homePos.x, 0, p.homePos.z);
    p.atHome = true;
    p.path = null;
  }

  /** Quem esta livre sai de vez em quando ate a copa/lounge e volta. */
  private stroll(p: Person): void {
    if (!p.homePos || !this.floor) return;
    const spots = this.floor.hangouts;
    const spot = spots[Math.floor(Math.random() * spots.length)] ?? [0, 2];
    const home = new THREE.Vector2(p.homePos.x, p.homePos.z);
    const aisle = new THREE.Vector2(p.homePos.x, p.homePos.z + 1.1);
    p.atHome = false;
    p.path = [home, aisle, new THREE.Vector2(spot[0], spot[1]), aisle, home];
    p.seg = 0;
    p.t = 0;
  }

  private goBackToSeat(p: Person): void {
    if (!p.homePos) return;
    const here = new THREE.Vector2(p.group.position.x, p.group.position.z);
    p.path = [here, new THREE.Vector2(p.homePos.x, p.homePos.z)];
    p.seg = 0;
    p.t = 0;
  }

  private robotLoop(): THREE.Vector2[] {
    const pts = (this.floor?.hangouts ?? [[0, 2]]).map(([x, z]) => new THREE.Vector2(x, z));
    pts.push(new THREE.Vector2(0, 2.4));
    return [...pts, pts[0]!.clone()];
  }

  // ------------------------------------------------------------ animacao

  private loop(): void {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    if (!this.reducedMotion) this.animate(dt, t);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.placeTags();
    this.frame = requestAnimationFrame(this.loop);
  }

  private animate(dt: number, t: number): void {
    const walking = this.people.some((p) => !p.cast.robot && p.path);
    for (const p of this.people) {
      if (p.path) {
        this.walk(p, dt, t);
        continue;
      }
      if (!p.atHome) continue;
      if (p.state === "busy") {
        // trabalhando: balanço curto e rapido, tela pulsando
        p.sprite.position.y = Math.abs(Math.sin(t * 6 + p.phase)) * 0.03;
        p.sprite.material.rotation = 0;
        if (p.screen) {
          (p.screen.material as THREE.MeshLambertMaterial).emissiveIntensity = 0.45 + Math.sin(t * 3 + p.phase) * 0.12;
        }
      } else {
        // livre: respiracao lenta
        const k = 1 + Math.sin(t * 1.6 + p.phase) * 0.012;
        p.sprite.scale.y = p.height * k;
        p.sprite.position.y = 0;
        p.nextStroll -= dt;
        if (p.nextStroll <= 0) {
          p.nextStroll = 25 + Math.random() * 35;
          if (!walking) this.stroll(p);
        }
      }
    }
    for (const b of this.blinkers) {
      b.mat.emissiveIntensity = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * b.speed + b.phase));
    }
  }

  private walk(p: Person, dt: number, t: number): void {
    const path = p.path!;
    const a = path[p.seg]!;
    const b = path[p.seg + 1];
    if (!b) {
      if (p.cast.robot || !p.homePos) {
        p.seg = 0;
        p.t = 0;
      } else {
        this.goHome(p);
        p.sprite.position.y = 0;
        p.sprite.material.rotation = 0;
      }
      return;
    }
    const len = Math.max(0.01, a.distanceTo(b));
    p.t += (dt * 1.3) / len;
    if (p.t >= 1) {
      p.t = 0;
      p.seg += 1;
      return;
    }
    p.group.position.x = a.x + (b.x - a.x) * p.t;
    p.group.position.z = a.y + (b.y - a.y) * p.t;
    // passinho: pulo curto + leve balanço lateral
    p.sprite.position.y = Math.abs(Math.sin(t * 9 + p.phase)) * 0.09;
    p.sprite.material.rotation = Math.sin(t * 9 + p.phase) * 0.05;
  }

  private placeTags(): void {
    const rect = this.canvas.getBoundingClientRect();
    for (const p of this.people) {
      if (!p.tag) continue;
      this.tmp
        .set(p.group.position.x, p.group.position.y + p.height + 0.15, p.group.position.z)
        .project(this.camera);
      p.tag.style.left = `${((this.tmp.x + 1) / 2) * rect.width}px`;
      p.tag.style.top = `${((1 - this.tmp.y) / 2) * rect.height - 6}px`;
    }
  }
}
