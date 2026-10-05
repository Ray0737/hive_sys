// Degrees-minutes-seconds text (13°45'36.0\"N 100°30'18.0\"E) <-> [lng, lat]. Pure, shared by the map and the contingency page.
const RE = /(\d+)\s*°\s*(\d+)\s*'\s*([\d.]+)\s*"?\s*([NS])[\s,]+(\d+)\s*°\s*(\d+)\s*'\s*([\d.]+)\s*"?\s*([EW])/i;

export function parseDms(text) {
  const m = RE.exec(text.replace(/[′’‘]/g, "'").replace(/[″”“]/g, '"'));
  if (!m) throw new Error('Not a DMS coordinate: ' + text);
  const v = (d, mi, s, h) => (+d + +mi / 60 + +s / 3600) * (/[SW]/i.test(h) ? -1 : 1);
  return [v(m[5], m[6], m[7], m[8]), v(m[1], m[2], m[3], m[4])]; // [lng, lat]
}

export const decimal = ([lng, lat]) => `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
