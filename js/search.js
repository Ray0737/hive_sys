// Place search (Nominatim, on submit only: its usage policy forbids autocomplete) + locate-me.
const $ = id => document.getElementById(id);

export function initSearch(map, say, onLocate) {
  const form = $('search'), input = form.querySelector('input'), out = $('results');
  const close = () => { out.hidden = true; out.replaceChildren(); };

  form.onsubmit = async e => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return close();
    const url = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({ q, format: 'jsonv2', limit: 6, countrycodes: 'th', 'accept-language': 'th,en' });
    out.replaceChildren(); out.hidden = false;
    try {
      const r = await (await fetch(url)).json();
      if (!r.length) { const n = document.createElement('div'); n.className = 'none'; n.textContent = 'No match'; out.append(n); return; }
      r.forEach(p => {
        const b = document.createElement('button');
        b.textContent = p.display_name;
        b.onclick = () => {
          const [s, n, w, e2] = p.boundingbox.map(Number);
          map.fitBounds([[w, s], [e2, n]], { maxZoom: 17, duration: 800 });
          close();
        };
        out.append(b);
      });
    } catch { const n = document.createElement('div'); n.className = 'none'; n.textContent = 'Search needs a network'; out.append(n); }
  };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
    if (e.key === '/' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); } // press / to search
  });
  document.addEventListener('pointerdown', e => { if (!out.contains(e.target) && !form.contains(e.target)) close(); });

  let dot;
  $('btn-locate').onclick = () => {
    if (!navigator.geolocation) return say('Location not available');
    navigator.geolocation.getCurrentPosition(p => {
      const ll = [p.coords.longitude, p.coords.latitude];
      if (!dot) { const d = document.createElement('div'); d.className = 'user-dot'; dot = new maplibregl.Marker({ element: d }); }
      dot.setLngLat(ll).addTo(map);
      map.flyTo({ center: ll, zoom: Math.max(map.getZoom(), 15) });
      onLocate({ lng: ll[0], lat: ll[1] });
    }, () => say('Location denied or unavailable'), { enableHighAccuracy: true, timeout: 10000 });
  };
}
