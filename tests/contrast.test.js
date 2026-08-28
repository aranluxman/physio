const hex = h => h.replace('#','').match(/../g).map(x=>parseInt(x,16));
const lin = c => { c/=255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4); };
const L = h => { const [r,g,b]=hex(h); return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b); };
const ratio = (a,b) => { const l1=L(a), l2=L(b); const [hi,lo]=l1>l2?[l1,l2]:[l2,l1]; return (hi+0.05)/(lo+0.05); };

const light = {
  bg:'#f5f7f7', surface:'#ffffff', surface2:'#eef2f2', border:'#dde5e4',
  text:'#0d1b1a', muted:'#5b6b6a', faint:'#7c8a89',
  accent:'#146b64', accentFg:'#ffffff', accentSoft:'#e0f0ee', accentSoftFg:'#0f5751',
  ok:'#0f7a52', okSoft:'#dcf3e8', okSoftFg:'#0b5c3e',
  warn:'#8a5a00', warnSoft:'#fcefd6', warnSoftFg:'#7a4f00',
  danger:'#a52222', dangerSoft:'#fbe4e4', dangerSoftFg:'#8c1d1d',
  info:'#0d5f8a', infoSoft:'#dcedf7', infoSoftFg:'#0b4d6f',
};
const dark = {
  bg:'#0a1211', surface:'#111b1a', surface2:'#182322', border:'#26312f',
  text:'#e7efee', muted:'#9aacaa', faint:'#7f9290',
  accent:'#4ec9bd', accentFg:'#06201d', accentSoft:'#12332f', accentSoftFg:'#7fdcd2',
  ok:'#4ec98d', okSoft:'#123028', okSoftFg:'#7edcae',
  warn:'#e0a94a', warnSoft:'#33280f', warnSoftFg:'#f0c987',
  danger:'#ef8a8a', dangerSoft:'#331a1a', dangerSoftFg:'#f4a8a8',
  info:'#63b8e0', infoSoft:'#122b38', infoSoftFg:'#93cfee',
};

const AA_TEXT = 4.5, AA_LARGE = 3.0, AA_UI = 3.0;
let fails = 0;
function check(theme, name, fg, bg, min, label) {
  const r = ratio(theme[fg], theme[bg]);
  const ok = r >= min;
  if (!ok) fails++;
  console.log(`  ${ok?'PASS':'FAIL'}  ${r.toFixed(2)}  (min ${min})  ${label}`);
}
for (const [tname, t] of [['LIGHT', light], ['DARK', dark]]) {
  console.log(`\n=== ${tname} ===`);
  check(t,'','text','bg', AA_TEXT, 'body text on page bg');
  check(t,'','text','surface', AA_TEXT, 'body text on card');
  check(t,'','text','surface2', AA_TEXT, 'body text on subtle panel');
  check(t,'','muted','surface', AA_TEXT, 'muted text on card');
  check(t,'','muted','bg', AA_TEXT, 'muted text on page bg');
  check(t,'','faint','surface', AA_LARGE, 'faint label on card (large/secondary)');
  check(t,'','accent','surface', AA_TEXT, 'accent link text on card');
  check(t,'','accent','bg', AA_TEXT, 'accent link text on page bg');
  check(t,'','accentFg','accent', AA_TEXT, 'button label on accent fill');
  check(t,'','accentSoftFg','accentSoft', AA_TEXT, 'chip: accent soft');
  check(t,'','okSoftFg','okSoft', AA_TEXT, 'chip: done');
  check(t,'','warnSoftFg','warnSoft', AA_TEXT, 'chip: due');
  check(t,'','dangerSoftFg','dangerSoft', AA_TEXT, 'chip: dont skip');
  check(t,'','infoSoftFg','infoSoft', AA_TEXT, 'chip: optional');
  check(t,'','border','surface', 1.0, 'border on card (decorative)');
  check(t,'','accent','surface', AA_UI, 'focus ring / control edge');
  check(t,'','ok','surface', AA_UI, 'completed control fill vs card');
}
// --- Avatar: the hue is per-user, so every hue must clear AA in both themes ---
function hsl2rgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
const Lrgb = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratioRgb = (a, b) => {
  const l1 = Lrgb(a), l2 = Lrgb(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
};

console.log('\n=== AVATAR (all 360 hues) ===');
for (const [name, fg, bg] of [
  ['light', [60, 25], [45, 90]],
  ['dark', [62, 76], [26, 24]],
]) {
  let worst = Infinity, worstHue = 0;
  for (let h = 0; h < 360; h++) {
    const r = ratioRgb(hsl2rgb(h, fg[0], fg[1]), hsl2rgb(h, bg[0], bg[1]));
    if (r < worst) { worst = r; worstHue = h; }
  }
  const ok = worst >= AA_TEXT;
  if (!ok) fails++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${worst.toFixed(2)}  (min ${AA_TEXT})  ${name} avatar, worst hue ${worstHue}`);
}

console.log(`\n${fails} failing pair(s)`);
process.exit(fails ? 1 : 0);
