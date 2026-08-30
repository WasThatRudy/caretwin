import * as THREE from "three";

// deterministic value noise
function hsh(i: number) { const x = Math.sin(i * 127.13) * 43758.545; return x - Math.floor(x); }
function nz(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const n = (a: number, b: number, c: number) => hsh(a * 57 + b * 113 + c * 191);
  const sm = (t: number) => t * t * (3 - 2 * t);
  const lp = (a: number, b: number, t: number) => a + (b - a) * sm(t);
  const c000 = n(xi, yi, zi), c100 = n(xi + 1, yi, zi), c010 = n(xi, yi + 1, zi), c110 = n(xi + 1, yi + 1, zi);
  const c001 = n(xi, yi, zi + 1), c101 = n(xi + 1, yi, zi + 1), c011 = n(xi, yi + 1, zi + 1), c111 = n(xi + 1, yi + 1, zi + 1);
  const x00 = lp(c000, c100, xf), x10 = lp(c010, c110, xf), x01 = lp(c001, c101, xf), x11 = lp(c011, c111, xf);
  return lp(lp(x00, x10, yf), lp(x01, x11, yf), zf);
}

// Sculpt the ventricular mass: broad base, apex at the bottom, interventricular
// groove on the front, fuller left ventricle, organic noise, vertex colours.
export function makeVentricles(): THREE.BufferGeometry {
  const R = 13;
  const geo = new THREE.IcosahedronGeometry(R, 6);
  const p = geo.attributes.position;
  const v = new THREE.Vector3(), dir = new THREE.Vector3(), tmp = new THREE.Color();
  const cols: number[] = [];
  const base = new THREE.Color(0x8a2b28), dark = new THREE.Color(0x4d1414), fat = new THREE.Color(0xcaa06b);

  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); dir.copy(v).normalize();
    const ny = dir.y;
    let prof: number;
    if (ny >= 0) prof = 1.0 + 0.10 * Math.sin(ny * Math.PI);
    else prof = 1.0 - Math.pow(-ny, 1.9) * 0.98;
    prof *= 1.0 + 0.16 * Math.exp(-Math.pow((ny - 0.02) / 0.5, 2));
    prof = Math.max(0.05, prof);

    const rx = R * prof * 1.05, rz = R * prof * 0.92, yy = ny * R * 1.18;
    const pos = new THREE.Vector3(dir.x * rx, yy, dir.z * rz);

    const gx = dir.x * 0.7 + (ny + 0.05);
    const groove = Math.exp(-Math.pow(gx / 0.32, 2)) * Math.max(0, dir.z);
    pos.multiplyScalar(1 - 0.07 * groove);
    if (dir.x < 0) pos.x *= 1.07;
    if (ny < -0.4) pos.z += (-ny - 0.4) * 4.0;

    const n1 = nz(dir.x * 2.4 + 9, dir.y * 2.4 + 9, dir.z * 2.4 + 9);
    const n2 = nz(dir.x * 5.5 + 3, dir.y * 5.5 + 3, dir.z * 5.5 + 3);
    pos.multiplyScalar(1 + (n1 - 0.5) * 0.11 + (n2 - 0.5) * 0.05);
    p.setXYZ(i, pos.x, pos.y, pos.z);

    tmp.copy(base).lerp(dark, THREE.MathUtils.clamp(groove * 0.9 + (0.5 - n1) * 0.6, 0, 1));
    const fatband = Math.exp(-Math.pow((ny - 0.55) / 0.16, 2)) * 0.55;
    tmp.lerp(fat, fatband * Math.max(0, 0.6 - groove));
    cols.push(tmp.r, tmp.g, tmp.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  return geo;
}

export function tubeGeo(pts: number[][], r: number): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(pts.map((a) => new THREE.Vector3(a[0], a[1], a[2])));
  return new THREE.TubeGeometry(curve, 40, r, 18, false);
}

// great vessels + coronary arteries: [points, radius, colour, roughness]
export const VESSELS: [number[][], number, number, number][] = [
  [[[-2, 10, -1], [-2, 17, -3], [1, 23, -5], [6, 25, -3], [9, 22, 1]], 3.0, 0xc98f86, 0.45], // aorta
  [[[4, 10, 3], [6, 17, 2], [7, 23, -1], [4, 26, -4]], 2.9, 0xb56b78, 0.45],                  // pulmonary
  [[[-6, 9, 2], [-8, 15, 1], [-8, 20, 0]], 2.2, 0x9a5560, 0.5],                                // vena cava
  [[[8, 7, -3], [12, 9, -5]], 1.4, 0xb56b78, 0.5],                                             // pulmonary vein
  [[[-1, 9, 9], [-4, 3, 11], [-6, -4, 9], [-6, -11, 5]], 0.55, 0x6d1f1f, 0.6],                 // LCA
  [[[3, 9, 9], [6, 3, 10], [7, -4, 8], [5, -11, 4]], 0.5, 0x6d1f1f, 0.6],                      // RCA
];
