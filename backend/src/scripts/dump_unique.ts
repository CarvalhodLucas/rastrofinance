import fs from 'fs';
import path from 'path';

const uncategorizedPath = 'c:/Users/Lucas de Carvalho/Documents/Sites/CRM FINANCIAS/backend/uncategorized.json';
const data = JSON.parse(fs.readFileSync(uncategorizedPath, 'utf-8')) as any[];

const descriptions = new Set<string>();
for (const tx of data) {
  descriptions.add(tx.description || '');
}

const uniqueList = Array.from(descriptions).sort();
const outPath = path.join('c:/Users/Lucas de Carvalho/Documents/Sites/CRM FINANCIAS/backend', 'unique_descriptions.json');
fs.writeFileSync(outPath, JSON.stringify(uniqueList, null, 2));
console.log(`Dumped ${uniqueList.length} unique descriptions to unique_descriptions.json`);
