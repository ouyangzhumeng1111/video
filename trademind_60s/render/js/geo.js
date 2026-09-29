// Land mask from Natural Earth (world-atlas) rasterised to an equirectangular
// canvas; used for dot-matrix globe and flat map.
import { feature } from 'topojson-client';
import { geoEquirectangular, geoPath } from 'd3-geo';

export async function loadLand() {
  const topo = await (await fetch('node_modules/world-atlas/land-50m.json')).json();
  const land = feature(topo, topo.objects.land);
  const w = 2048, h = 1024;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  const proj = geoEquirectangular().scale(w / (2 * Math.PI)).translate([w / 2, h / 2]);
  const path = geoPath(proj, ctx);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); path(land); ctx.fill();
  const data = ctx.getImageData(0, 0, w, h).data;
  const isLand = (lat, lon) => {
    const x = Math.floor(((lon + 180) / 360) * w) % w;
    const y = Math.min(h - 1, Math.max(0, Math.floor(((90 - lat) / 180) * h)));
    return data[(y * w + x) * 4] > 127;
  };
  return { canvas: cv, isLand, land };
}

// lat/lon (deg) -> unit sphere, lon 0 faces +z, north is +y
export function sph(lat, lon, r = 1) {
  const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180;
  return [r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo)];
}

export const CITIES = {
  shanghai: [31.23, 121.47], ningbo: [29.87, 121.55], shenzhen: [22.54, 114.06], qingdao: [36.07, 120.38], tianjin: [39.08, 117.2],
  hamburg: [53.55, 9.99], rotterdam: [51.92, 4.48], antwerp: [51.22, 4.4], munich: [48.14, 11.58], stuttgart: [48.78, 9.18],
  milan: [45.46, 9.19], warsaw: [52.23, 21.01], paris: [48.86, 2.35], london: [51.5, -0.12], madrid: [40.42, -3.7], istanbul: [41.0, 28.97],
  dubai: [25.2, 55.27], mumbai: [19.07, 72.87], singapore: [1.35, 103.82], jakarta: [-6.2, 106.85], bangkok: [13.75, 100.5], hochiminh: [10.82, 106.63],
  tokyo: [35.68, 139.69], seoul: [37.56, 126.98], sydney: [-33.87, 151.21], losangeles: [34.05, -118.24], chicago: [41.88, -87.63],
  newyork: [40.71, -74.0], houston: [29.76, -95.37], mexico: [19.43, -99.13], saopaulo: [-23.55, -46.63], santos: [-23.96, -46.33],
  buenosaires: [-34.6, -58.38], lagos: [6.52, 3.38], johannesburg: [-26.2, 28.04], cairo: [30.04, 31.24], riyadh: [24.71, 46.67],
  moscow: [55.75, 37.62], delhi: [28.61, 77.21], karachi: [24.86, 67.0], manila: [14.6, 120.98], osaka: [34.69, 135.5], toronto: [43.65, -79.38],
};
