import { categorizeTransactions } from '../services/claudeService.js';
import type { Transaction } from '../types.js';

async function main() {
  const dummyTx: Transaction = {
    id: 'test_1',
    pluggy_transaction_id: 'test_pluggy_1',
    account_id: 'dummy_acc',
    date: '2026-08-10',
    amount: -15.50,
    description: 'iFood delivery',
    raw_description: 'iFood delivery',
    transaction_type: 'DEBIT',
    category: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  try {
    console.log('Sending single transaction to categorization...');
    const result = await categorizeTransactions([dummyTx]);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Failed to categorize:', error);
  }
}

void main();
