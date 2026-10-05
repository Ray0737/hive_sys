// Air4Thai PM2.5 -> GeoJSON. Shared by bake-data.mjs (snapshot) and server.mjs (live proxy: the API sends no CORS headers).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const URL_AQI = 'https://air4thai.pcd.go.th/services/getNewAQI_JSON.php';

// stations -> FeatureCollection of PM2.5 readings inside bbox [w, s, e, n]. Pure, so tests can feed it a sample.
export function toAqiGeoJSON(stations, [w, s, e, n]) {
  const features = stations.flatMap((st, i) => {
    const p = st.AQILast?.PM25, lon = +st.long, lat = +st.lat;
    if (!p || +p.value < 0 || !(lon >= w && lon <= e && lat >= s && lat <= n)) return [];
    return [{ type: 'Feature', id: i + 1, properties: { name: st.nameEN || st.nameTH, area: st.areaEN, pm25: +p.value, aqi: +p.aqi, 'measured at': `${st.AQILast.date} ${st.AQILast.time}`, '@type': 'air4thai', '@id': st.stationID }, geometry: { type: 'Point', coordinates: [lon, lat] } }];
  });
  return { type: 'FeatureCollection', features };
}

// The server sends an incomplete certificate chain, which Node rejects. curl completes it from the OS store; verification stays on.
export async function fetchStations() {
  const { stdout } = await promisify(execFile)('curl', ['-sSL', '-m', '60', URL_AQI], { maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(stdout).stations;
}
