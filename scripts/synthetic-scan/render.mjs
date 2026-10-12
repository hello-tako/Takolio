import sharp from 'sharp';
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export function renderScene(source, quality) {
  const width = 1080;
  const height = source.kind === 'receipt' ? 1260 : 1080;
  const regions = [];
  const line = (text, x, y, regionWidth, role, position = 0, size = 31) => {
    regions.push({ text, role, position, x, y: y - size, width: regionWidth, height: size + 12 });
    return `<text x="${x}" y="${y}" font-size="${size}">${escape(text)}</text>`;
  };
  const missing = quality === 'missing_field';
  let content = '';
  if (source.kind === 'receipt') {
    content += line('TAKOSAN QA MART', 270, 120, 600, 'merchant', 0, 42);
    content += line('NAME', 70, 260, 380, 'header');
    content += line('QTY', 535, 260, 240, 'header');
    content += line('PRICE', 805, 260, 250, 'header');
    source.rows.forEach(([name, qty, price], position) => {
      const y = 350 + position * 88;
      content += line(name, 70, y, 420, 'name', position);
      if (!missing || position !== 1) {
        content += line(qty, 535, y, 230, 'quantity', position);
        content += line(`${price.toLocaleString('en-US')} ${source.currency}`, 805, y, 265, 'price', position, 27);
      }
    });
    content += line('TOTAL', 70, 1080, 420, 'header');
    if (!missing) content += line(`${source.rows.reduce((sum, row) => sum + row[2], 0).toLocaleString('en-US')} ${source.currency}`, 725, 1080, 330, 'total', 0, 36);
  } else if (source.kind === 'label') {
    content += `<rect x="110" y="225" width="860" height="625" rx="35" fill="#e2efdf" stroke="#9bad98" stroke-width="7"/>`;
    content += line(source.name, 205, 400, 680, 'name', 0, 64);
    if (!missing) {
      content += line(`NET ${source.net}`, 205, 550, 680, 'net', 0, 47);
      content += line(`EXP ${source.expiry}`, 205, 680, 740, 'expiry', 0, 41);
    }
  } else {
    const dx = source.scene * 7;
    content += `<defs><linearGradient id="wall" x2="1" y2="1"><stop stop-color="#f2f7f6"/><stop offset="1" stop-color="#bdcfd1"/></linearGradient><radialGradient id="red"><stop stop-color="#fb7959"/><stop offset="1" stop-color="#ac3222"/></radialGradient></defs>
      <rect x="75" y="155" width="930" height="820" rx="35" fill="url(#wall)" stroke="#718387" stroke-width="16"/>
      <path d="M110 440 H970 M110 730 H970" stroke="#8cabad" stroke-width="17"/>
      <path d="M130 205 L240 205 L270 250 L270 395 L130 395 Z" fill="#f8fbef" stroke="#657783" stroke-width="5"/>
      <path d="M130 260 H270 V320 H130" fill="#6c9fbb"/>
      <ellipse cx="${440 + dx}" cy="345" rx="72" ry="55" fill="url(#red)"/><path d="M430 300 l15 22 25 -18 -20 30" stroke="#466a39" stroke-width="8" fill="none"/>
      <ellipse cx="${575 + dx}" cy="352" rx="58" ry="49" fill="url(#red)"/>
      <rect x="650" y="525" width="230" height="145" rx="28" fill="#d2cabb" stroke="#8a887e" stroke-width="5"/><rect x="635" y="518" width="260" height="28" rx="10" fill="#788383"/>
      <rect x="160" y="775" width="310" height="132" rx="18" fill="#d4dcc7" opacity=".75"/>`;
    if (!missing) content += `<path d="M190 880 Q150 735 240 770 Q220 740 285 805 Q325 710 335 835 Q405 730 435 805 L365 897Z" fill="#46814f"/><path d="M210 885 Q195 805 275 810 M300 890 L325 799" fill="none" stroke="#8daf66" stroke-width="7"/>`;
    else content += `<rect x="150" y="760" width="350" height="160" rx="20" fill="#929a9d"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#f4f1e8"/><g fill="#202722">${content}</g>
    <text x="65" y="65" font-family="sans-serif" font-size="25" fill="#7b3a27">SYNTHETIC TEST ONLY - ${escape(source.id)}</text>
    <text x="65" y="${height - 35}" font-family="sans-serif" font-size="22" fill="#7b3a27">${source.kind === 'fridge' ? 'ILLUSTRATION - UNKNOWN MASS / CONTENTS' : 'FICTIONAL SAMPLE - NO CUSTOMER / PAYMENT DATA'}</text>
  </svg>`;
  // The text elements are composited as pinned fontfile rasters by the generator.
  return { svg: svg.replace(/<text x="(?!65)[\s\S]*?<\/text>/g, ''), regions, width, height };
}
export async function renderPixels(scene, fontPath) {
  const layers = [];
  for (const region of scene.regions) {
    const input = await sharp({ text: { text: escape(region.text), fontfile: fontPath,
      font: `${fontPath.includes('noto-') ? 'Noto Sans JP' : 'Nunito'} ${region.height - 12}`, rgba: true, dpi: 72 } }).png().toBuffer();
    layers.push({ input, left: region.x, top: region.y });
  }
  return sharp(Buffer.from(scene.svg)).composite(layers).png().toBuffer();
}
