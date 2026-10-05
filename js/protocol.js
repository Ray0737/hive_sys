// Shape check for protocol/contingency.json. Pure, so a test can run it and a typo in the JSON gets caught early.
export const BLOCK_TYPES = new Set(['p', 'h3', 'note', 'list', 'checklist', 'kv', 'table', 'steps', 'sites', 'sitecards']);

export function validate(p) {
  const errs = [];
  if (!Array.isArray(p.sites) || !p.sites.length) errs.push('sites: need at least one');
  const ids = new Set();
  (p.sections || []).forEach(s => {
    if (!s.id || !s.title) errs.push('section needs id and title');
    if (ids.has(s.id)) errs.push('duplicate section id ' + s.id);
    ids.add(s.id);
    (s.blocks || []).forEach((b, i) => {
      const at = `${s.id}[${i}]`;
      if (!BLOCK_TYPES.has(b.type)) return errs.push(`${at}: unknown block type "${b.type}"`);
      if (b.type === 'table') b.rows.forEach((r, j) => { if (r.length !== b.headers.length) errs.push(`${at} row ${j}: ${r.length} cells for ${b.headers.length} headers`); });
      if (b.type === 'kv') b.rows.forEach((r, j) => { if (r.length !== 2) errs.push(`${at} row ${j}: kv rows are [label, value]`); });
      if (b.type === 'steps') b.items.forEach(it => { if (!it.id || !it.title) errs.push(`${at}: step needs id and title`); });
    });
  });
  return errs;
}
