import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { supabase } from '../services/supabaseService.js';
import { categorizeTransactions } from '../services/claudeService.js';
import type { Transaction } from '../types.js';

const workspaceRoot = 'c:/Users/Lucas de Carvalho/Documents/Sites/CRM FINANCIAS';
const santanderCsvPath = path.join(workspaceRoot, 'santander.csv'); // Actually Wise data
const wiseXlsxPath = path.join(workspaceRoot, 'wise.xlsx'); // Actually Santander data

// In-memory currency cache: date -> { currency: rate_in_brl }
const currencyCache: Record<string, Record<string, number>> = {};

// Helper to fetch historical exchange rates (BRL per unit of foreign currency)
async function getBrlExchangeRates(dateStr: string): Promise<Record<string, number>> {
  // Format: YYYY-MM-DD
  if (currencyCache[dateStr]) {
    return currencyCache[dateStr];
  }

  const rates: Record<string, number> = { brl: 1.0 };
  const fallbackRates: Record<string, number> = {
    eur: 6.0,
    usd: 5.5,
    clp: 0.0057,
    brl: 1.0,
  };

  try {
    const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateStr}/v1/currencies/brl.json`;
    const res = await fetch(url);
    if (res.ok) {
      const data = (await res.json()) as { brl: Record<string, number> };
      if (data && data.brl) {
        // The API returns rates as units per 1 BRL (e.g. eur = 0.166 => 1 BRL = 0.166 EUR)
        // We want rates as BRL per unit of currency (e.g. 1 EUR = 6.02 BRL => 1 / 0.166 = 6.02)
        for (const [curr, val] of Object.entries(data.brl)) {
          rates[curr.toLowerCase()] = 1 / val;
        }
        currencyCache[dateStr] = rates;
        return rates;
      }
    }
  } catch (err) {
    console.warn(`[Exchange Rates] Failed to fetch rates for ${dateStr}, using fallback. error:`, err);
  }

  // If fetch failed, use fallback
  currencyCache[dateStr] = fallbackRates;
  return fallbackRates;
}

// Convert date DD/MM/YYYY to YYYY-MM-DD
function parseDmyDate(dmy: string): string {
  const parts = dmy.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return dmy;
}

// Parse string amount into clean number
function parseCleanAmount(amountStr: string): number {
  if (!amountStr) return 0;
  // Replace Unicode minus U+2212 with ASCII hyphen-minus
  let clean = amountStr.replace(/[\u2212]/g, '-').trim();
  // Remove thousand dots and replace comma with dot
  // e.g. "-1.915,54" -> "-1915.54"
  clean = clean.replace(/\./g, '').replace(/,/g, '.');
  const val = parseFloat(clean);
  return isNaN(val) ? 0 : val;
}

async function main() {
  console.log('=== STARTING TRANSACTION STATEMENT IMPORT ===');

  // 1. Get or Create accounts
  console.log('\n--- 1. Setting up Connected Accounts ---');
  
  // 1.1 Santander Account
  let santanderId: string | null = null;
  const { data: santanderAccs } = await supabase
    .from('connected_accounts')
    .select('id, pluggy_account_id')
    .eq('institution_name', 'Banco Santander')
    .limit(1);

  if (santanderAccs && santanderAccs.length > 0) {
    santanderId = santanderAccs[0].id;
    console.log(`Found Santander account: ${santanderId}`);
    // Activate it
    await supabase
      .from('connected_accounts')
      .update({ is_active: true })
      .eq('id', santanderId);
  } else {
    // Create new
    const { data: newSant, error } = await supabase
      .from('connected_accounts')
      .insert({
        pluggy_item_id: 'manual_santander_item',
        pluggy_account_id: 'manual_santander_account',
        institution_name: 'Banco Santander',
        account_type: 'CHECKING',
        account_name: 'Santander EUR',
        currency: 'EUR',
        is_active: true,
        balance: 0,
      })
      .select()
      .single();
    if (error) throw error;
    santanderId = newSant.id;
    console.log(`Created Santander account: ${santanderId}`);
  }

  // 1.2 Wise Account
  let wiseId: string | null = null;
  const { data: wiseAccs } = await supabase
    .from('connected_accounts')
    .select('id')
    .eq('institution_name', 'Wise')
    .limit(1);

  if (wiseAccs && wiseAccs.length > 0) {
    wiseId = wiseAccs[0].id;
    console.log(`Found Wise account: ${wiseId}`);
    // Activate it
    await supabase
      .from('connected_accounts')
      .update({ is_active: true })
      .eq('id', wiseId);
  } else {
    // Create new
    const { data: newWise, error } = await supabase
      .from('connected_accounts')
      .insert({
        pluggy_item_id: 'manual_wise_item',
        pluggy_account_id: 'manual_wise_account',
        institution_name: 'Wise',
        account_type: 'CHECKING',
        account_name: 'Wise EUR/Multi',
        currency: 'EUR',
        is_active: true,
        balance: 0,
      })
      .select()
      .single();
    if (error) throw error;
    wiseId = newWise.id;
    console.log(`Created Wise account: ${wiseId}`);
  }

  const transactionsToInsert: any[] = [];

  // 2. Parse Santander data (from wise.xlsx)
  console.log('\n--- 2. Parsing wise.xlsx (Santander data) ---');
  if (fs.existsSync(wiseXlsxPath)) {
    const workbook = XLSX.readFile(wiseXlsxPath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
    
    // Transactions start at row 7
    const dataRows = rows.slice(7);
    console.log(`Found ${dataRows.length} rows in Santander statement.`);
    
    let parsedCount = 0;
    for (const r of dataRows) {
      if (!r || r.length < 6 || !r[0]) continue;
      
      const rawDate = String(r[0]);
      const date = parseDmyDate(rawDate); // "DD/MM/YYYY" -> "YYYY-MM-DD"
      const description = String(r[2] || '').trim();
      const amountRaw = String(r[3] || '');
      const originalAmount = parseCleanAmount(amountRaw);
      const originalCurrency = String(r[5] || 'EUR').toUpperCase();
      
      if (originalAmount === 0) continue;

      // Get rates
      const rates = await getBrlExchangeRates(date);
      const rate = rates[originalCurrency.toLowerCase()] || 6.0;
      const amount = originalAmount * rate;

      // Deterministic pluggy_transaction_id to prevent duplicates
      const pluggyId = `santander_${date}_${originalAmount}_${description.replace(/\s+/g, '_')}`;

      transactionsToInsert.push({
        pluggy_transaction_id: pluggyId,
        account_id: santanderId,
        date,
        amount,
        description,
        raw_description: description,
        original_currency: originalCurrency,
        original_amount: originalAmount,
        exchange_rate: rate,
        transaction_type: originalAmount < 0 ? 'DEBIT' : 'CREDIT',
        is_recurring: false,
        is_anomaly: false,
        updated_at: new Date().toISOString(),
      });
      parsedCount++;
    }
    console.log(`Successfully parsed ${parsedCount} Santander transactions.`);
  } else {
    console.log('wise.xlsx not found!');
  }

  // 3. Parse Wise data (from santander.csv)
  console.log('\n--- 3. Parsing santander.csv (Wise data) ---');
  if (fs.existsSync(santanderCsvPath)) {
    const content = fs.readFileSync(santanderCsvPath, 'utf-8');
    
    // Simple CSV Line parser that respects quotes
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
    
    const idIdx = header.indexOf('Número da transferência');
    const situacaoIdx = header.indexOf('Situação');
    const direcaoIdx = header.indexOf('Direção');
    const criadaIdx = header.indexOf('Criada em');
    const concluidaIdx = header.indexOf('Concluída em');
    const valorOrigemIdx = header.indexOf('Valor de origem (tarifas inclusas)');
    const moedaOrigemIdx = header.indexOf('Moeda de origem');
    const beneficiarioIdx = header.indexOf('Nome do beneficiário');
    const refIdx = header.indexOf('Referência');
    const catIdx = header.indexOf('Categoria');

    console.log(`Found ${lines.length - 1} rows in Wise statement.`);
    let parsedCount = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < header.length) continue;
      
      const pluggyId = cols[idIdx];
      const status = cols[situacaoIdx];
      const direction = cols[direcaoIdx];
      
      // Skip cancelled ones
      if (status === 'CANCELLED') continue;

      const rawDateStr = cols[concluidaIdx] || cols[criadaIdx] || '';
      // Raw date is in format "YYYY-MM-DD HH:MM:SS". We only need YYYY-MM-DD
      const date = rawDateStr.split(' ')[0] || new Date().toISOString().split('T')[0];

      const originalCurrency = String(cols[moedaOrigemIdx] || 'EUR').toUpperCase();
      const origAmountVal = Math.abs(parseFloat(cols[valorOrigemIdx]) || 0);

      if (origAmountVal === 0) continue;

      let originalAmount = origAmountVal;
      
      // Calculate transaction sign
      if (status === 'REFUNDED') {
        // Refunded OUT is positive (money back), Refunded IN is negative (returned money)
        originalAmount = direction === 'OUT' ? origAmountVal : -origAmountVal;
      } else {
        // COMPLETED/Neutral
        // OUT and NEUTRAL are expenses (negative)
        originalAmount = direction === 'IN' ? origAmountVal : -origAmountVal;
      }

      const description = (cols[beneficiarioIdx] || cols[refIdx] || 'Wise Transfer').trim();
      const categoryFromWise = cols[catIdx] || null;

      // Get rates
      const rates = await getBrlExchangeRates(date);
      const rate = rates[originalCurrency.toLowerCase()] || 6.0;
      const amount = originalAmount * rate;

      transactionsToInsert.push({
        pluggy_transaction_id: `wise_${pluggyId}`,
        account_id: wiseId,
        date,
        amount,
        description,
        raw_description: description,
        original_currency: originalCurrency,
        original_amount: originalAmount,
        exchange_rate: rate,
        transaction_type: originalAmount < 0 ? 'DEBIT' : 'CREDIT',
        category: categoryFromWise, // Pre-fill with Wise's category if available
        is_recurring: false,
        is_anomaly: false,
        updated_at: new Date().toISOString(),
      });
      parsedCount++;
    }
    console.log(`Successfully parsed ${parsedCount} Wise transactions.`);
  } else {
    console.log('santander.csv not found!');
  }

  // 4. Batch upsert into database
  console.log(`\n--- 4. Saving ${transactionsToInsert.length} transactions to Database ---`);
  
  // We do it in chunks of 100 to avoid query size limits
  const chunkSize = 100;
  let insertedCount = 0;

  for (let i = 0; i < transactionsToInsert.length; i += chunkSize) {
    const chunk = transactionsToInsert.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('transactions')
      .upsert(chunk, { onConflict: 'pluggy_transaction_id', ignoreDuplicates: true })
      .select();

    if (error) {
      console.error(`Error saving chunk starting at index ${i}:`, error);
    } else {
      insertedCount += (data ?? []).length;
    }
  }

  console.log(`Database sync completed. Total transactions inserted/updated: ${insertedCount}`);

  // 5. Automatically categorize newly imported transactions
  console.log('\n--- 5. Running AI Categorization ---');
  
  // Find all transactions without categories or categorized as 'Outros' or 'Geral' or empty, specifically from our two accounts
  const { data: uncategorizedTxs, error: fetchErr } = await supabase
    .from('transactions')
    .select('*')
    .in('account_id', [santanderId, wiseId])
    .or('category.is.null,category.eq.Outros,category.eq.Geral');

  if (fetchErr) {
    console.error('Error fetching uncategorized transactions:', fetchErr);
    return;
  }

  console.log(`Found ${(uncategorizedTxs ?? []).length} transactions that need AI categorization.`);

  if (uncategorizedTxs && uncategorizedTxs.length > 0) {
    const batchSize = 5; // Categorize in very small batches of 5 to guarantee complete responses and prevent parsing failures
    let categorizedCount = 0;

    for (let i = 0; i < uncategorizedTxs.length; i += batchSize) {
      const batch = uncategorizedTxs.slice(i, i + batchSize) as Transaction[];
      console.log(`Categorizing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(uncategorizedTxs.length / batchSize)}...`);
      
      try {
        const results = await categorizeTransactions(batch);
        
        // Update each transaction in the database with the result
        for (const res of results) {
          const { error: updateErr } = await supabase
            .from('transactions')
            .update({
              category: res.category,
              subcategory: res.subcategory,
              is_essential: res.is_essential,
              is_recurring: res.is_recurring,
              merchant_name: res.merchant_name,
              ai_confidence: res.ai_confidence,
              ai_notes: res.ai_notes,
              updated_at: new Date().toISOString(),
            })
            .eq('pluggy_transaction_id', res.pluggy_transaction_id);

          if (updateErr) {
            console.error(`Failed to update categorization for ${res.pluggy_transaction_id}:`, updateErr);
          } else {
            categorizedCount++;
          }
        }
      } catch (err) {
        console.error('AI categorization error for batch:', err);
      }
      // Delay to avoid rate-limiting or heavy load on OpenRouter
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    console.log(`AI Categorization complete! Categorized ${categorizedCount} transactions.`);
  }

  console.log('\n=== IMPORT PROCESS FINISHED ===');
}

void main();
