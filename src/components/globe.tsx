/**
 * The gilt globe on the cover: meridians and parallels every fifteen degrees, seen from a
 * little above the equator with the axis leaning, as a globe stands on a desk. It is drawn
 * once (orthographic projection, only the near side), so the server and the browser write
 * the same picture. The orb in Orbis; the only ornament on the site.
 */

const RAD = Math.PI / 180;
const LAT0 = 24 * RAD; // seen from this latitude
const LON0 = -18 * RAD; // facing this meridian
const ROLL = -20 * RAD; // the axis leans this far

function project(lon: number, lat: number): [number, number, boolean] {
  const l = lon * RAD - LON0;
  const p = lat * RAD;
  const near = Math.sin(LAT0) * Math.sin(p) + Math.cos(LAT0) * Math.cos(p) * Math.cos(l) >= 0;
  const x = Math.cos(p) * Math.sin(l);
  const y = -(Math.cos(LAT0) * Math.sin(p) - Math.sin(LAT0) * Math.cos(p) * Math.cos(l));
  return [x * Math.cos(ROLL) - y * Math.sin(ROLL), x * Math.sin(ROLL) + y * Math.cos(ROLL), near];
}

function trace(points: [number, number, boolean][]): string {
  let d = "";
  let pen = false;
  for (const [x, y, near] of points) {
    if (!near) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${(x * 100).toFixed(2)} ${(y * 100).toFixed(2)}`;
    pen = true;
  }
  return d;
}

function graticule(): { meridians: string; parallels: string; equator: string } {
  let meridians = "";
  for (let lon = -180; lon < 180; lon += 15) {
    const points: [number, number, boolean][] = [];
    for (let lat = -90; lat <= 90; lat += 2) points.push(project(lon, lat));
    meridians += trace(points);
  }
  let parallels = "";
  let equator = "";
  for (let lat = -75; lat <= 75; lat += 15) {
    const points: [number, number, boolean][] = [];
    for (let lon = -180; lon <= 180; lon += 2) points.push(project(lon, lat));
    if (lat === 0) equator = trace(points);
    else parallels += trace(points);
  }
  return { meridians, parallels, equator };
}

const LINES = graticule();

export function Globe({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="-102 -102 204 204"
      className={className}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
    >
      <circle r="100" strokeWidth="0.6" />
      <circle r="101.6" strokeWidth="0.25" />
      <path d={LINES.meridians} strokeWidth="0.32" />
      <path d={LINES.parallels} strokeWidth="0.32" />
      <path d={LINES.equator} strokeWidth="0.55" />
    </svg>
  );
}
