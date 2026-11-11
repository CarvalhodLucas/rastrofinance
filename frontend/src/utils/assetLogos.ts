import rastroLogos from '@/data/rastroLogos.json';

// Mapeamentos diretos de alta fidelidade para criptomoedas e ativos especiais
const SPECIAL_LOGOS: Record<string, string> = {
  // Criptos principais
  BTC: 'https://assets.coincap.io/assets/icons/btc@2x.png',
  ETH: 'https://assets.coincap.io/assets/icons/eth@2x.png',
  SOL: 'https://assets.coincap.io/assets/icons/sol@2x.png',
  ONDO: 'https://icons.duckduckgo.com/ip3/ondo.finance.ico',
  ROSE: 'https://assets.coincap.io/assets/icons/rose@2x.png',
  VIRTUAL: 'https://icons.duckduckgo.com/ip3/virtuals.io.ico',
  LINK: 'https://assets.coincap.io/assets/icons/link@2x.png',
  RENDER: 'https://assets.coincap.io/assets/icons/render@2x.png',
  XRP: 'https://assets.coincap.io/assets/icons/xrp@2x.png',
  SXT: 'https://icons.duckduckgo.com/ip3/spaceandtime.io.ico',
  TAO: 'https://assets.coincap.io/assets/icons/tao@2x.png',
  XLM: 'https://assets.coincap.io/assets/icons/xlm@2x.png',
  USDT: 'https://assets.coincap.io/assets/icons/usdt@2x.png',
  USDC: 'https://assets.coincap.io/assets/icons/usdc@2x.png',
  BNB: 'https://bin.bnbstatic.com/static/images/common/favicon.ico',

  // Ações B3 complementares
  CEAB3: 'https://www.google.com/s2/favicons?domain=cea.com.br&sz=128',
  'CEAB3.SA': 'https://www.google.com/s2/favicons?domain=cea.com.br&sz=128',
  ITUB4: 'https://www.google.com/s2/favicons?domain=itau.com.br&sz=128',
  ITUB3: 'https://www.google.com/s2/favicons?domain=itau.com.br&sz=128',
  BPAN4: 'https://www.google.com/s2/favicons?domain=bancopan.com.br&sz=128',
  CMIG4: 'https://www.google.com/s2/favicons?domain=cemig.com.br&sz=128',
  CMIG3: 'https://www.google.com/s2/favicons?domain=cemig.com.br&sz=128',
  KLBN11: 'https://www.google.com/s2/favicons?domain=klabin.com.br&sz=128',
  KLBN4: 'https://www.google.com/s2/favicons?domain=klabin.com.br&sz=128',
  POMO4: 'https://www.google.com/s2/favicons?domain=marcopolo.com.br&sz=128',
  POMO3: 'https://www.google.com/s2/favicons?domain=marcopolo.com.br&sz=128',
  AXIA3: 'https://www.google.com/s2/favicons?domain=allos.com.br&sz=128',
  AXIA7: 'https://www.google.com/s2/favicons?domain=allos.com.br&sz=128',
  S2GM34: 'https://www.google.com/s2/favicons?domain=gm.com&sz=128',
  TOTS3: 'https://www.google.com/s2/favicons?domain=ri.totvs.com&sz=128',
  VULC3: 'https://www.google.com/s2/favicons?domain=vulcabras.com.br&sz=128',

  // FIIs complementares
  VILG11: 'https://www.google.com/s2/favicons?domain=vincipartners.com&sz=128',
  RBRR11: 'https://www.google.com/s2/favicons?domain=rbrasset.com.br&sz=128',
  MCCI11: 'https://www.google.com/s2/favicons?domain=mauacapital.com&sz=128',
  BTLG11: 'https://www.google.com/s2/favicons?domain=btgpactual.com&sz=128',
  HGLG11: 'https://www.google.com/s2/favicons?domain=cshg.com.br&sz=128',
  XPML11: 'https://www.google.com/s2/favicons?domain=xpasset.com.br&sz=128',

  // Renda Fixa e Contas
  WISE_EUR: 'https://www.google.com/s2/favicons?domain=wise.com&sz=128',
  WISE_USD: 'https://www.google.com/s2/favicons?domain=wise.com&sz=128',
  REVOLUT: 'https://www.google.com/s2/favicons?domain=revolut.com&sz=128',
  REVOLUT_X: 'https://www.google.com/s2/favicons?domain=revolut.com&sz=128',
  REVOLUT_EUR: 'https://www.google.com/s2/favicons?domain=revolut.com&sz=128',
  REVOLUT_USD: 'https://www.google.com/s2/favicons?domain=revolut.com&sz=128',
};

export function getAssetLogo(ticker: string, institution?: string, assetType?: string): string {
  if (!ticker) return '';
  const clean = ticker.trim().toUpperCase();
  const instLower = (institution || '').toLowerCase();

  // 1. Verificar mapa especial prioritário
  if (SPECIAL_LOGOS[clean]) {
    return SPECIAL_LOGOS[clean];
  }

  // 2. Verificar se é Tesouro Direto / Renda Fixa pública
  if (
    clean.includes('LTN') ||
    clean.includes('NTNB') ||
    clean.includes('RENDA+') ||
    clean.includes('TESOURO') ||
    clean.includes('SELIC') ||
    clean.includes('IPCA')
  ) {
    return 'https://www.google.com/s2/favicons?domain=tesourodireto.com.br&sz=128';
  }

  // 3. Verificar se é Wise ou Revolut (Caixinha / Conta)
  if (clean.includes('WISE') || instLower.includes('wise')) {
    return 'https://www.google.com/s2/favicons?domain=wise.com&sz=128';
  }
  if (clean.includes('REVOLUT') || (instLower.includes('revolut') && assetType !== 'CRYPTO' && !instLower.includes('revolut x'))) {
    return 'https://www.google.com/s2/favicons?domain=revolut.com&sz=128';
  }

  // 4. Verificar banco de logos do RASTRO
  const rastroMap = rastroLogos as Record<string, string>;
  if (rastroMap[clean]) {
    return rastroMap[clean];
  }

  // 5. Se for cripto e não estiver no mapa, tenta CoinCap
  if (assetType === 'CRYPTO' || instLower.includes('binance') || instLower.includes('revolut x')) {
    return `https://assets.coincap.io/assets/icons/${clean.toLowerCase()}@2x.png`;
  }

  // 6. Para ações B3 com padrão de 4 letras + número (ex: PETR4 -> petr.com.br ou ri domain)
  const base4 = clean.slice(0, 4).toLowerCase();
  return `https://www.google.com/s2/favicons?domain=${base4}.com.br&sz=128`;
}

export function getBankLogo(institutionName?: string | null, existingLogo?: string | null): string | null {
  if (existingLogo && existingLogo.trim()) {
    return existingLogo.trim();
  }
  if (!institutionName) return null;

  const lower = institutionName.trim().toLowerCase();
  if (!lower || lower.includes('dinheiro')) return null;

  if (lower.includes('revolut')) return 'https://www.google.com/s2/favicons?domain=revolut.com&sz=128';
  if (lower.includes('wise')) return 'https://www.google.com/s2/favicons?domain=wise.com&sz=128';
  if (lower.includes('santander')) return 'https://www.google.com/s2/favicons?domain=bancosantander.es&sz=128';
  if (lower.includes('nubank') || lower.includes('nuinvest') || lower === 'nu') return 'https://www.google.com/s2/favicons?domain=nubank.com.br&sz=128';
  if (lower.includes('binance')) return 'https://www.google.com/s2/favicons?domain=binance.com&sz=128';
  if (lower.includes('xp')) return 'https://www.google.com/s2/favicons?domain=xpi.com.br&sz=128';
  if (lower.includes('itaú') || lower.includes('itau')) return 'https://www.google.com/s2/favicons?domain=itau.com.br&sz=128';
  if (lower.includes('inter')) return 'https://www.google.com/s2/favicons?domain=inter.co&sz=128';
  if (lower.includes('bradesco')) return 'https://www.google.com/s2/favicons?domain=bradesco.com.br&sz=128';
  if (lower.includes('c6')) return 'https://www.google.com/s2/favicons?domain=c6bank.com.br&sz=128';
  if (lower.includes('btg')) return 'https://www.google.com/s2/favicons?domain=btgpactual.com&sz=128';
  if (lower.includes('banco do brasil') || lower === 'bb') return 'https://www.google.com/s2/favicons?domain=bb.com.br&sz=128';
  if (lower.includes('caixabank')) return 'https://www.google.com/s2/favicons?domain=caixabank.es&sz=128';
  if (lower.includes('caixa')) return 'https://www.google.com/s2/favicons?domain=caixa.gov.br&sz=128';
  if (lower.includes('bbva')) return 'https://www.google.com/s2/favicons?domain=bbva.es&sz=128';
  if (lower.includes('n26')) return 'https://www.google.com/s2/favicons?domain=n26.com&sz=128';
  if (lower.includes('nomad')) return 'https://www.google.com/s2/favicons?domain=nomadglobal.com&sz=128';
  if (lower.includes('avenue')) return 'https://www.google.com/s2/favicons?domain=avenue.us&sz=128';
  if (lower.includes('rico')) return 'https://www.google.com/s2/favicons?domain=rico.com.vc&sz=128';
  if (lower.includes('clear')) return 'https://www.google.com/s2/favicons?domain=clear.com.br&sz=128';
  if (lower.includes('b3') || lower.includes('tesouro')) return 'https://www.google.com/s2/favicons?domain=b3.com.br&sz=128';
  if (lower.includes('coinbase')) return 'https://www.google.com/s2/favicons?domain=coinbase.com&sz=128';
  if (lower.includes('bybit')) return 'https://www.google.com/s2/favicons?domain=bybit.com&sz=128';
  if (lower.includes('kraken')) return 'https://www.google.com/s2/favicons?domain=kraken.com&sz=128';
  if (lower.includes('mercado pago') || lower.includes('mercadopago')) return 'https://www.google.com/s2/favicons?domain=mercadopago.com.br&sz=128';
  if (lower.includes('picpay')) return 'https://www.google.com/s2/favicons?domain=picpay.com&sz=128';
  if (lower.includes('neon')) return 'https://www.google.com/s2/favicons?domain=neon.com.br&sz=128';
  if (lower.includes('pagbank') || lower.includes('pagseguro')) return 'https://www.google.com/s2/favicons?domain=pagbank.com.br&sz=128';
  if (lower.includes('millennium') || lower.includes('millenium')) return 'https://www.google.com/s2/favicons?domain=millenniumbcp.pt&sz=128';
  if (lower.includes('activo')) return 'https://www.google.com/s2/favicons?domain=activobank.pt&sz=128';
  if (lower.includes('sabadell')) return 'https://www.google.com/s2/favicons?domain=bancsabadell.com&sz=128';
  if (lower.includes('openbank')) return 'https://www.google.com/s2/favicons?domain=openbank.es&sz=128';
  if (lower === 'ing' || lower.includes('banco ing')) return 'https://www.google.com/s2/favicons?domain=ing.es&sz=128';

  return null;
}
