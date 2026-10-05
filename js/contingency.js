// Contingency protocol page: renders protocol/contingency.json. Edit the JSON, reload the page.
import { parseDms, decimal } from './coords.js';
import { dist } from './geo.js';
import { validate } from './protocol.js';

const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const km = d => (d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(d < 10000 ? 1 : 0) + ' km');
const KIND = { secondary: 'Secondary site: Bangkok not safe', bkk: 'Bangkok alternate: cannot travel far' };
const mapLink = ([lng, lat]) => `index.html#c=${lat.toFixed(5)},${lng.toFixed(5)},14&t=dark&l=sites,hospital`;

// text with inline [fill] / [confirm] markers shown as amber tags
function rich(node, text) {
  text.split(/(\[fill\]|\[confirm\])/).forEach(part => {
    if (part === '[fill]') node.append(el('span', 'fill', 'to fill'));
    else if (part === '[confirm]') node.append(el('span', 'fill', 'confirm'));
    else if (part) node.append(document.createTextNode(part));
  });
  return node;
}
const cell = (v, fill) => { const td = el('td'); v ? rich(td, v) : fill && td.append(el('span', 'fill', 'to fill')); return td; };
function table(headers, rows) {
  const wrap = el('div', 'scroll'), t = el('table', 'tbl'), head = el('tr');
  headers.forEach(h => head.append(el('th', null, h)));
  t.append(head); rows.forEach(r => t.append(r)); wrap.append(t);
  return wrap;
}

const RENDER = {
  p: b => rich(el('p'), b.text),
  h3: b => el('h3', null, b.text),
  note: b => rich(el('p', 'note ' + (b.tone || 'info')), b.text),
  list: b => { const l = el(b.ordered ? 'ol' : 'ul', 'proc'); b.items.forEach(t => l.append(rich(el('li'), t))); return l; },
  checklist: b => { const l = el('ul', 'check c' + (b.columns || 1)); b.items.forEach(t => { const li = el('li'); li.append(el('span', 'box'), rich(el('span'), t)); l.append(li); }); return l; },
  kv: b => { const t = el('table', 'tbl kv'); b.rows.forEach(([k, v]) => { const tr = el('tr'); tr.append(el('td', 'k', k), rich(el('td'), v)); t.append(tr); }); return t; },
  table: b => table(b.headers, b.rows.map(r => { const tr = el('tr'); r.forEach(v => { const td = cell(v, b.fill); if (b.blank) td.classList.add('blank'); tr.append(td); }); return tr; })),
  steps: b => {
    const wrap = el('div', 'steps');
    b.items.forEach((st, i) => {
      const d = el('div', 'step' + (i === 0 ? ' first' : '')), body = el('div', 'body');
      body.append(el('div', 'tag', st.label), el('div', 'title', st.title), el('p', null, st.body));
      if (st.details?.length) { const ul = el('ul', 'proc'); st.details.forEach(t => ul.append(rich(el('li'), t))); body.append(ul); }
      d.append(el('div', 'id', st.id), body); wrap.append(d);
    });
    return wrap;
  },
};

function sitesBlock(sites) {
  const box = el('div'), rows = new Map();
  const trs = sites.map(s => {
    const tr = el('tr'), name = el('td'), link = el('a', 'btn', 'Open on map'), act = el('td');
    name.append(el('div', null, s.name), el('div', 'kind', KIND[s.kind] || s.kind));
    link.href = mapLink(s.pt); act.append(link);
    tr.append(name, el('td', null, s.dms), el('td', 'num', decimal(s.pt)), act);
    rows.set(s.id, tr);
    return tr;
  });
  box.append(table(['Site', 'Coordinates (DMS)', 'Decimal (lat, lng)', ''], trs));
  const near = el('div', 'toolbar'), btn = el('button', null, 'Nearest to my location'), msg = el('span', 'foot');
  btn.onclick = () => navigator.geolocation?.getCurrentPosition(pos => {
    const me = [pos.coords.longitude, pos.coords.latitude];
    const ranked = sites.map(s => ({ s, d: dist(me, s.pt) })).sort((a, b) => a.d - b.d);
    rows.forEach(tr => tr.classList.remove('near'));
    rows.get(ranked[0].s.id).classList.add('near');
    msg.textContent = `Nearest: ${ranked[0].s.name}, ${km(ranked[0].d)} in a straight line. Check the route and conditions first.`;
  }, () => { msg.textContent = 'Location denied or unavailable.'; }, { enableHighAccuracy: true, timeout: 10000 });
  near.append(btn, msg); box.append(near);
  const secondary = sites.filter(s => s.kind === 'secondary'), bkk = sites.filter(s => s.kind === 'bkk');
  if (secondary.length && bkk.length) {
    box.append(el('h3', null, 'Straight-line distance from each Bangkok location'));
    box.append(table(['From', ...secondary.map(s => s.name)], bkk.map(b => {
      const tr = el('tr'); tr.append(el('td', null, b.name));
      secondary.forEach(s => tr.append(el('td', 'num', km(dist(b.pt, s.pt)))));
      return tr;
    })));
    box.append(el('p', 'foot', 'Straight-line only. Road distance and time are longer: use Measure on the map (Walk / Drive) for a route estimate.'));
  }
  return box;
}

function siteCards(sites, fields) {
  const grid = el('div', 'cards');
  sites.forEach(s => {
    const c = el('div', 'card'), head = el('div', 'ch');
    head.append(el('span', null, s.name), el('span', 'kind', KIND[s.kind] || s.kind));
    const t = el('table', 'tbl kv');
    [['Coordinates', s.dms], ...fields.map(([label, key]) => [label, s[key] || ''])].forEach(([k, v], i) => { const tr = el('tr'); tr.append(el('td', 'k', k), i === 0 ? el('td', null, v) : cell(v, true)); t.append(tr); });
    const link = el('a', 'btn', 'Open on map'); link.href = mapLink(s.pt);
    c.append(head, t, link); grid.append(c);
  });
  return grid;
}

async function main() {
  const doc = $('doc');
  let p;
  try {
    let r = await fetch('protocol/contingency.json', { cache: 'no-cache' });
    if (!r.ok) r = await fetch('protocol/contingency.example.json', { cache: 'no-cache' }); // fresh clone: private file absent
    p = await r.json();
  }
  catch { doc.replaceChildren(el('p', 'note warn', 'Could not load protocol/contingency.json. Open this page through npm start, not as a file.')); return; }
  const errs = validate(p);
  const sites = p.sites.map(s => ({ ...s, pt: parseDms(s.dms) }));
  document.title = p.title;
  doc.replaceChildren();

  doc.append(el('h1', null, p.title));
  const meta = el('div', 'meta label');
  meta.append(el('span', null, 'Status: ' + p.status), el('span', null, 'Updated: ' + p.updated));
  doc.append(meta, rich(el('p', 'note info'), p.note));
  if (errs.length) doc.append(el('p', 'note warn', 'Problems in protocol/contingency.json: ' + errs.join('; ')));

  const bar = el('div', 'toolbar'), print = el('button', null, 'Print');
  print.onclick = () => window.print();
  bar.append(print); doc.append(bar);

  const toc = el('nav', 'toc'); toc.append(el('div', 'label', 'Contents'));
  const ol = el('ol'); p.sections.forEach(s => { const li = el('li'), a = el('a', null, s.title); a.href = '#' + s.id; li.append(a); ol.append(li); });
  toc.append(ol); doc.append(toc);

  p.sections.forEach((sec, i) => {
    const s = el('section'); s.id = sec.id;
    const h = el('h2'); h.append(el('span', 'n', String(i + 1)), document.createTextNode(sec.title)); s.append(h);
    sec.blocks.forEach(b => {
      if (b.type === 'sites') s.append(sitesBlock(sites));
      else if (b.type === 'sitecards') s.append(siteCards(sites, b.fields));
      else if (RENDER[b.type]) s.append(RENDER[b.type](b));
    });
    doc.append(s);
  });
  doc.append(el('p', 'foot', 'End of protocol.'));
}
main();
