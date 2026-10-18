import fs from 'fs';
import path from 'path';

const rastroDataPath = 'c:/Users/Lucas de Carvalho/Documents/Sites/RASTRO/src/lib/data.ts';
const content = fs.readFileSync(rastroDataPath, 'utf8');

const items = [];
const blocks = content.split(/{\s*ticker:/);

for (let i = 1; i < blocks.length; i++) {
  const block = blocks[i];
  const tickerMatch = block.match(/^\s*["']([^"']+)["']/);
  const typeMatch = block.match(/type:\s*["']([^"']+)["']/);
  const nameMatch = block.match(/name:\s*["']([^"']+)["']/);
  const sectorMatch = block.match(/sector:\s*["']([^"']+)["']/);
  const exchangeMatch = block.match(/exchange:\s*["']([^"']+)["']/);

  if (tickerMatch && nameMatch) {
    const rawTicker = tickerMatch[1];
    const cleanTicker = rawTicker.replace('.SA', '').replace('-USD', '').trim();
    items.push({
      ticker: cleanTicker,
      name: nameMatch[1],
      type: typeMatch ? typeMatch[1] : 'Ações',
      sector: sectorMatch ? sectorMatch[1] : '',
      exchange: exchangeMatch ? exchangeMatch[1] : 'B3',
    });
  }
}

console.log('Total items extracted from RASTRO:', items.length);
console.log('Sample items:', items.slice(0, 10));

// Salvar dataset formatado para o frontend do CRM FINANCIAS
const targetPath = path.resolve('frontend', 'src', 'data', 'assetsDatabase.json');
fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, JSON.stringify(items, null, 2));
console.log('Saved assets database to:', targetPath);
