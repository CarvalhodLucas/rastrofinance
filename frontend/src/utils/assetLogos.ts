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
};

export function getAssetLogo(ticker: string, institution?: string, assetType?: string): string {
  if (!ticker) return '';
  const clean = ticker.trim().toUpperCase();

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

  // 3. Verificar se é Wise
  if (clean.includes('WISE') || (institution && institution.toLowerCase().includes('wise'))) {
    return 'https://www.google.com/s2/favicons?domain=wise.com&sz=128';
  }

  // 4. Verificar banco de logos do RASTRO
  const rastroMap = rastroLogos as Record<string, string>;
  if (rastroMap[clean]) {
    return rastroMap[clean];
  }

  // 5. Se for cripto e não estiver no mapa, tenta CoinCap
  if (assetType === 'CRYPTO' || institution === 'Binance') {
    return `https://assets.coincap.io/assets/icons/${clean.toLowerCase()}@2x.png`;
  }

  // 6. Para ações B3 com padrão de 4 letras + número (ex: PETR4 -> petr.com.br ou ri domain)
  const base4 = clean.slice(0, 4).toLowerCase();
  return `https://www.google.com/s2/favicons?domain=${base4}.com.br&sz=128`;
}
