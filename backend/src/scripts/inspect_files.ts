import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

// Paths
const workspaceRoot = 'c:/Users/Lucas de Carvalho/Documents/Sites/CRM FINANCIAS';
const santanderCsvPath = path.join(workspaceRoot, 'santander.csv');
const wiseXlsxPath = path.join(workspaceRoot, 'wise.xlsx');

console.log('--- Inspecting santander.csv ---');
if (fs.existsSync(santanderCsvPath)) {
  const content = fs.readFileSync(santanderCsvPath, 'utf-8');
  const lines = content.split('\n');
  console.log(`Total lines: ${lines.length}`);
  console.log('Header:');
  console.log(lines[0]);
  console.log('Row 1:');
  console.log(lines[1]);
  console.log('Row 2:');
  console.log(lines[2]);
} else {
  console.log('santander.csv not found!');
}

console.log('\n--- Inspecting wise.xlsx ---');
if (fs.existsSync(wiseXlsxPath)) {
  const workbook = XLSX.readFile(wiseXlsxPath);
  console.log('Sheet Names:', workbook.SheetNames);
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  // Parse without converting to json to see raw cells or parse with header: 1 (array of arrays)
  const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
  console.log(`Total raw rows in first sheet: ${rows.length}`);
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    console.log(`Row ${i}:`, JSON.stringify(rows[i]));
  }
} else {
  console.log('wise.xlsx not found!');
}
