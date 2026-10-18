import fs from 'fs';
import path from 'path';

const uncategorizedPath = 'c:/Users/Lucas de Carvalho/Documents/Sites/CRM FINANCIAS/backend/uncategorized.json';
const data = JSON.parse(fs.readFileSync(uncategorizedPath, 'utf-8')) as any[];

const descriptions: Record<string, number> = {};
for (const tx of data) {
  const desc = tx.description || '';
  descriptions[desc] = (descriptions[desc] || 0) + 1;
}

const sorted = Object.entries(descriptions).sort((a, b) => b[1] - a[1]);
console.log(`Total unique descriptions: ${sorted.length}`);
console.log('Top 40 descriptions:');
for (let i = 0; i < Math.min(sorted.length, 40); i++) {
  console.log(`${sorted[i][1]}x: "${sorted[i][0]}"`);
}
