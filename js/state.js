// Shareable view in the URL hash: #c=lat,lng,zoom&t=theme&l=id,id  (not storage; paste the link to share)
export function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const c = (p.get('c') || '').split(',').map(Number);
  return {
    view: c.length === 3 && c.every(Number.isFinite) ? { center: [c[1], c[0]], zoom: c[2] } : null,
    theme: p.get('t'),
    layers: p.has('l') ? p.get('l').split(',').filter(Boolean) : null,
  };
}

export function writeHash({ center, zoom, theme, layers }) {
  const p = new URLSearchParams({ c: `${center.lat.toFixed(5)},${center.lng.toFixed(5)},${zoom.toFixed(2)}`, t: theme, l: layers.join(',') });
  history.replaceState(null, '', '#' + p);
}
