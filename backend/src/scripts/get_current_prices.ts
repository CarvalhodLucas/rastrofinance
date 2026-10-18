async function getCurrentPrices() {
  const coins = ['BTC', 'ETH', 'SOL', 'ONDO', 'ROSE', 'VIRTUAL', 'LINK', 'RENDER', 'XRP', 'SXT'];
  for (const c of coins) {
    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${c}USDT`);
      if (res.ok) {
        const data: any = await res.json();
        console.log(`${c}USDT: $${parseFloat(data.price)}`);
      } else {
        console.log(`${c}USDT: HTTP ${res.status}`);
      }
    } catch (e: any) {
      console.error(c, e.message);
    }
  }
}

getCurrentPrices().catch(console.error);
