import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const workspaceRoot = 'c:/Users/Lucas de Carvalho/Documents/Sites/CRM FINANCIAS';
const santanderCsvPath = path.join(workspaceRoot, 'santander.csv');
const wiseXlsxPath = path.join(workspaceRoot, 'wise.xlsx');

console.log('=== ANALYZING WISE DATA (in santander.csv) ===');
if (fs.existsSync(santanderCsvPath)) {
  const content = fs.readFileSync(santanderCsvPath, 'utf-8');
  // Simple CSV parser that handles quotes
  const parseCsvLine = (line: string) => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const lines = content.split('\n').filter(l => l.trim().length > 0);
  const header = parseCsvLine(lines[0]);
  
  // Find index of important columns
  const situacaoIdx = header.indexOf('Situação');
  const direcaoIdx = header.indexOf('Direção');
  const dataIdx = header.indexOf('Concluída em') !== -1 ? header.indexOf('Concluída em') : header.indexOf('Criada em');
  const valorOrigemIdx = header.indexOf('Valor de origem (tarifas inclusas)');
  const moedaOrigemIdx = header.indexOf('Moeda de origem');
  const valorDestinoIdx = header.indexOf('Valor de destino (tarifas inclusas)');
  const moedaDestinoIdx = header.indexOf('Moeda de destino');
  const txCambioIdx = header.indexOf('Taxa de câmbio');
  const descricaoIdx = header.indexOf('Nome do beneficiário');
  const refIdx = header.indexOf('Referência');

  console.log('Column indices:', {
    situacaoIdx, direcaoIdx, dataIdx, valorOrigemIdx, moedaOrigemIdx,
    valorDestinoIdx, moedaDestinoIdx, txCambioIdx, descricaoIdx, refIdx
  });

  const statuses = new Set<string>();
  const directions = new Set<string>();
  const origCurrencies = new Set<string>();
  const destCurrencies = new Set<string>();
  let totalRows = 0;
  let completedRows = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < header.length) continue;
    totalRows++;
    
    const situacao = cols[situacaoIdx] || '';
    const direcao = cols[direcaoIdx] || '';
    const moedaOrigem = cols[moedaOrigemIdx] || '';
    const moedaDestino = cols[moedaDestinoIdx] || '';

    statuses.add(situacao);
    directions.add(direcao);
    if (moedaOrigem) origCurrencies.add(moedaOrigem);
    if (moedaDestino) destCurrencies.add(moedaDestino);

    if (situacao === 'COMPLETED') {
      completedRows++;
    }
  }

  console.log(`Total rows: ${totalRows}`);
  console.log(`Completed rows: ${completedRows}`);
  console.log('Statuses found:', Array.from(statuses));
  console.log('Directions found:', Array.from(directions));
  console.log('Source Currencies (Moeda de origem):', Array.from(origCurrencies));
  console.log('Destination Currencies (Moeda de destino):', Array.from(destCurrencies));

  // Let's print some sample rows where currency is BRL or something else
  console.log('\nSample rows with different currencies (or interesting cases):');
  let printed = 0;
  for (let i = 1; i < lines.length && printed < 10; i++) {
    const cols = parseCsvLine(lines[i]);
    const moedaOrigem = cols[moedaOrigemIdx] || '';
    const moedaDestino = cols[moedaDestinoIdx] || '';
    const situacao = cols[situacaoIdx] || '';
    if (situacao === 'COMPLETED' && (moedaOrigem !== 'EUR' || moedaDestino !== 'EUR')) {
      console.log(`Row ${i}: Date: ${cols[dataIdx]}, Orig: ${cols[valorOrigemIdx]} ${moedaOrigem}, Dest: ${cols[valorDestinoIdx]} ${moedaDestino}, ExchRate: ${cols[txCambioIdx]}, Desc: ${cols[descricaoIdx] || cols[refIdx]}`);
      printed++;
    }
  }
} else {
  console.log('santander.csv not found!');
}

console.log('\n=== ANALYZING SANTANDER DATA (in wise.xlsx) ===');
if (fs.existsSync(wiseXlsxPath)) {
  const workbook = XLSX.readFile(wiseXlsxPath);
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
  
  // Header row is row 6 (0-indexed)
  const header = rows[6];
  console.log('Header Row:', header);
  
  const dataRows = rows.slice(7);
  console.log(`Total data rows: ${dataRows.length}`);
  
  const currencies = new Set<string>();
  let eurCount = 0;
  let otherCount = 0;
  
  for (const r of dataRows) {
    if (!r || r.length < 6) continue;
    const currency = r[5];
    if (currency) {
      currencies.add(currency);
      if (currency === 'EUR') eurCount++;
      else otherCount++;
    }
  }
  
  console.log('Currencies found in Santander data:', Array.from(currencies));
  console.log(`EUR rows: ${eurCount}, Other rows: ${otherCount}`);
  
  console.log('\nFirst 5 transactions:');
  for (let i = 0; i < Math.min(dataRows.length, 5); i++) {
    console.log(JSON.stringify(dataRows[i]));
  }
} else {
  console.log('wise.xlsx not found!');
}
