// Sort public OSM military features into branches. Pure (no DOM), used by scripts/bake.mjs and tests.
// Public OSM tags and names only: nothing is inferred beyond what the mapper wrote. Purpose: relief logistics and
// restricted / hazardous areas to avoid (context_hive.md section 7). Not a targeting tool.
const AMMO = /ammunition|\bammo\b|munition|arsenal|ordnance (depot|storage|centre|center|factory)|explosive|incendiary|คลังแสง|คลังกระสุน|คลังอาวุธ|คลังวัตถุระเบิด|โรงงาน.*(กระสุน|วัตถุระเบิด)|ศูนย์สรรพาวุธ/i; // sites with explosion hazard: depots, ammunition and explosives plants. Schools and departments with 'ordnance' in the name are not matched
const NAVY = /\bnavy\b|naval|marine corps|กองทัพเรือ|ทหารเรือ|ฐานทัพเรือ|นาวิก|กองเรือ/i;
const AIR = /air ?force|\brtaf\b|\bair ?base\b|กองทัพอากาศ|กองบิน|ฐานทัพอากาศ/i;
const ARMY = /\barmy\b|\bbarracks\b|กองทัพบก|ทหารบก|ค่ายทหาร|มณฑลทหารบก|ทหารม้า|ทหารราบ|ทหารปืนใหญ่|ทหารช่าง|กองพล/i;

const MINOR = new Set(['checkpoint', 'bunker', 'trench', 'range', 'training_area', 'danger_area', 'obstacle_course', 'office']); // posts and ranges stay 'other' even if the name says army
const text = t => [t.name, t['name:en'], t['name:th'], t.operator, t['operator:en'], t.owner, t.description].filter(Boolean).join(' ');

// 'ammo' | 'navy' | 'airforce' | 'army' | 'other'. Ammunition wins, so a depot is never hidden inside a branch layer.
export function branchOf(tags) {
  const m = tags.military, s = text(tags);
  if (m === 'ammunition' || AMMO.test(s)) return 'ammo';
  if (m === 'naval_base' || NAVY.test(s)) return 'navy';
  if (m === 'airfield' || AIR.test(s)) return 'airforce';
  if (MINOR.has(m)) return 'other';
  if (m === 'barracks' || ARMY.test(s)) return 'army';
  return 'other';
}

// say why a feature sits in the ammunition layer, so a name match is never passed off as a mapped fact
export const ammoBasis = tags => (tags.military === 'ammunition' ? 'OSM tag military=ammunition' : 'name or operator mentions ammunition / ordnance');
