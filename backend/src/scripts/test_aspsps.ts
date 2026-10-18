import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Carrega o .env
dotenv.config();

const appID = process.env.ENABLE_BANKING_APPLICATION_ID;
const keyPath = process.env.ENABLE_BANKING_PRIVATE_KEY_PATH;

console.log('App ID:', appID);
console.log('Key Path:', keyPath);

function generateJWT() {
  const privateKeyPath = path.resolve(process.cwd(), keyPath || '');
  if (!fs.existsSync(privateKeyPath)) {
    throw new Error(`Chave não encontrada em: ${privateKeyPath}`);
  }
  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
  const payload = {
    iss: 'enablebanking.com',
    aud: 'api.enablebanking.com',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  };
  return jwt.sign(payload, privateKey, { 
    algorithm: 'RS256', 
    keyid: appID 
  });
}

async function test() {
  try {
    const token = generateJWT();
    console.log('JWT gerado com sucesso.');
    
    const url = 'https://api.enablebanking.com/aspsps?country=ES';
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Status da resposta:', res.status);
    const body = await res.json();
    console.log('Corpo da resposta:', JSON.stringify(body, null, 2));
  } catch (err: any) {
    console.error('Erro no teste:', err.message);
  }
}

test();
