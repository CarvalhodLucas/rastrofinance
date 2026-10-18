import sys
import os
import openpyxl
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

excel_files = [f for f in os.listdir('.') if f.endswith('.xlsx')]
binance_file = [f for f in excel_files if 'Binance' in f][0]

wb = openpyxl.load_workbook(binance_file)
sheet = wb.active

rows = list(sheet.iter_rows(values_only=True))

header_row_idx = -1
for idx, r in enumerate(rows):
    if r and 'Operação' in [str(cell) for cell in r if cell]:
        header_row_idx = idx
        break

# Cotações históricas de câmbio aproximadas na época das compras
EUR_TO_USD = 1.08
BRL_TO_USD = 0.1914 # 1 USD = 5.22 BRL

# Dicionários para rastrear ativos
# coin -> { total_qty: 0, total_spent_usd: 0 }
portfolio = defaultdict(lambda: {'qty': 0.0, 'spent_usd': 0.0})

# Chronological order from oldest to newest
data_rows = []
for r in rows[header_row_idx+1:]:
    time_str = r[3]
    op = str(r[6] or '')
    coin = str(r[8] or '')
    amount_str = r[9]
    obs = str(r[11] if len(r) > 11 else '')
    
    if not time_str or not op or not coin or not amount_str:
        continue
    try:
        amount = float(amount_str)
    except:
        continue

    data_rows.append({
        'time': str(time_str),
        'op': op,
        'coin': coin,
        'amount': amount,
        'obs': obs
    })

# Inverter para ficar do mais antigo para o mais recente (Cronológico)
data_rows.reverse()

# Rastrear o custo em Fiat das moedas compradas
# Se um item positivo 'Buy Crypto With Fiat' ocorrer, determinamos quanto foi gasto
# Se houver um item negativo de BRL/EUR/USDT próximo ou no mesmo lote, usa ele.
# Se for 'Ref' sem linha de dedução explícita no mesmo segundo, procuramos a última taxa de conversão fiat/cripto.

last_fiat_rate = {} # coin -> usd_price_at_that_time

for i, row in enumerate(data_rows):
    op = row['op']
    coin = row['coin']
    amount = row['amount']
    obs = row['obs']

    # 1. Binance Convert
    if op == 'Binance Convert':
        # Procurar o par na mesma data/hora
        same_time = [r for r in data_rows if r['time'] == row['time'] and r['op'] == 'Binance Convert']
        src = [r for r in same_time if r['amount'] < 0]
        dst = [r for r in same_time if r['amount'] > 0]
        
        if src and dst and row == dst[0]:
            src_item = src[0]
            dst_item = dst[0]
            
            src_coin = src_item['coin']
            src_amt = abs(src_item['amount'])
            dst_coin = dst_item['coin']
            dst_qty = dst_item['amount']
            
            spent_usd = 0
            if src_coin == 'BRL': spent_usd = src_amt * BRL_TO_USD
            elif src_coin == 'EUR': spent_usd = src_amt * EUR_TO_USD
            elif src_coin in ['USDT', 'USD']: spent_usd = src_amt
            elif src_coin in portfolio and portfolio[src_coin]['qty'] > 0:
                avg_usd = portfolio[src_coin]['spent_usd'] / portfolio[src_coin]['qty']
                spent_usd = src_amt * avg_usd
            
            if spent_usd > 0 and dst_qty > 0:
                portfolio[dst_coin]['qty'] += dst_qty
                portfolio[dst_coin]['spent_usd'] += spent_usd
                last_fiat_rate[dst_coin] = spent_usd / dst_qty

    # 2. Buy Crypto With Fiat
    elif op == 'Buy Crypto With Fiat':
        if amount < 0:
            continue
        
        # Se houver dedução explícita em BRL/EUR/USDT na mesma hora
        same_time = [r for r in data_rows if r['time'] == row['time'] and r['amount'] < 0]
        spent_usd = 0
        if same_time:
            ded = same_time[0]
            ded_coin = ded['coin']
            ded_amt = abs(ded['amount'])
            if ded_coin == 'BRL': spent_usd = ded_amt * BRL_TO_USD
            elif ded_coin == 'EUR': spent_usd = ded_amt * EUR_TO_USD
            elif ded_coin in ['USDT', 'USD']: spent_usd = ded_amt
        
        # Se não houver dedução explícita (compra recorrente 'Ref'), usa a última taxa conhecida ou cotação
        if spent_usd == 0 and coin in last_fiat_rate:
            spent_usd = amount * last_fiat_rate[coin]

        if spent_usd > 0 and amount > 0:
            portfolio[coin]['qty'] += amount
            portfolio[coin]['spent_usd'] += spent_usd
            last_fiat_rate[coin] = spent_usd / amount

print("\n==================== RE-CÁLCULO DE PREÇO MÉDIO COMPLETO DO EXCEL ====================")
for coin in ['BTC', 'ETH', 'SOL', 'ONDO', 'ROSE', 'VIRTUAL', 'LINK', 'RENDER', 'SXT']:
    if coin in portfolio:
        d = portfolio[coin]
        if d['qty'] > 0:
            avg_usd = d['spent_usd'] / d['qty']
            avg_brl = avg_usd / BRL_TO_USD
            print(f"Moeda: {coin:8s} | Qtd Acumulada: {d['qty']:15.8f} | Custo Total (USD): ${d['spent_usd']:10.2f} | TICKET MÉDIO ($): ${avg_usd:10.4f} | (R$): R$ {avg_brl:10.2f}")
