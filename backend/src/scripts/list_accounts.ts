import { getAllAccounts } from '../services/supabaseService.js';

async function main() {
  try {
    const accounts = await getAllAccounts();
    console.log('--- Connected Accounts ---');
    console.log(JSON.stringify(accounts, null, 2));
  } catch (error) {
    console.error('Error fetching accounts:', error);
  }
}

void main();
