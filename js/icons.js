// Lucide icons (ISC), vendored in assets/icons. Toolbar/UI use them as CSS masks; map markers are drawn to canvas.
const iconUrl = name => new URL(`assets/icons/${name}.svg`, document.baseURI).href; // absolute: var(--i) would resolve against the css file

export function icon(name) {
  const s = document.createElement('span');
  s.className = 'i';
  s.style.setProperty('--i', `url(${iconUrl(name)})`);
  return s;
}

export function iconify(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => el.style.setProperty('--i', `url(${iconUrl(el.dataset.icon)})`));
}

// Marker = square filled with the layer colour, black icon, 1px black border. Reads on all three basemaps.
const SIZE = 48; // 24px at pixelRatio 2
async function marker(name, color) {
  const svg = (await (await fetch(iconUrl(name))).text()).replace(/currentColor/g, '#000').replace(/stroke-width="[\d.]+"/, 'stroke-width="2"');
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const cv = document.createElement('canvas');
  cv.width = cv.height = SIZE;
  const c = cv.getContext('2d');
  c.fillStyle = color; c.fillRect(0, 0, SIZE, SIZE);
  c.strokeStyle = '#000'; c.lineWidth = 2; c.strokeRect(1, 1, SIZE - 2, SIZE - 2);
  c.drawImage(img, 10, 10, SIZE - 20, SIZE - 20);
  return c.getImageData(0, 0, SIZE, SIZE);
}

// id -> ImageData for every point layer
export async function loadMarkers(layers) {
  const pts = layers.filter(L => L.kind === 'point' && !L.off);
  const imgs = await Promise.all(pts.map(L => marker(L.icon, L.color)));
  return Object.fromEntries(pts.map((L, i) => [L.id, imgs[i]]));
}
