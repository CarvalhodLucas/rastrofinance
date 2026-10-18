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

# Dicionário de moedas: total_qty e total_cost_brl
asset_costs = defaultdict(lambda: {'total_qty': 0.0, 'total_cost_brl': 0.0})

# Taxas históricas de conversão para BRL
# EUR = 6.00 BRL
# USD = 5.22 BRL
EUR_BRL = 6.00
USD_BRL = 5.22

# Agrupar por timestamp
time_groups = defaultdict(list)
for r in rows[header_row_idx+1:]:
    time_str = r[3]
    op = r[6]
    coin = r[8]
    amount_str = r[9]

    if not time_str or not op or not coin or not amount_str:
        continue

    try:
        amount = float(amount_str)
    except:
        continue

    time_groups[time_str].append({
        'time': str(time_str),
        'op': str(op),
        'coin': str(coin),
        'amount': amount
    })

# Processar as operações em ordem cronológica (da mais antiga para a mais recente)
sorted_times = sorted(time_groups.keys())

for time_str in sorted_times:
    items = time_groups[time_str]
    
    # 1. 'Buy Crypto With Fiat' ou compras com saldo
    for i in items:
        if i['op'] == 'Buy Crypto With Fiat' and i['amount'] > 0:
            coin = i['coin']
            qty = i['amount']
            
            # Procurar item negativo correspondente na mesma transação
            negatives = [item for item in items if item['amount'] < 0]
            cost_brl = 0.0
            if negatives:
                neg = negatives[0]
                neg_coin = neg['coin']
                neg_amt = abs(neg['amount'])
                if neg_coin == 'BRL': cost_brl = neg_amt
                elif neg_coin == 'EUR': cost_brl = neg_amt * EUR_BRL
                elif neg_coin == 'USDT' or neg_coin == 'USD': cost_brl = neg_amt * USD_BRL
            
            if cost_brl > 0:
                asset_costs[coin]['total_qty'] += qty
                asset_costs[coin]['total_cost_brl'] += cost_brl

    # 2. 'Binance Convert'
    neg_converts = [i for i in items if i['op'] == 'Binance Convert' and i['amount'] < 0]
    pos_converts = [i for i in items if i['op'] == 'Binance Convert' and i['amount'] > 0]

    if neg_converts and pos_converts:
        src = neg_converts[0]
        dst = pos_converts[0]
        
        src_coin = src['coin']
        src_amt = abs(src['amount'])
        dst_coin = dst['coin']
        dst_qty = dst['amount']
        
        cost_brl = 0.0
        if src_coin == 'BRL':
            cost_brl = src_amt
        elif src_coin == 'EUR':
            cost_brl = src_amt * EUR_BRL
        elif src_coin == 'USDT' or src_coin == 'USD':
            cost_brl = src_amt * USD_BRL
        else:
            # Convert de outra altcoin (ex: XLM -> SOL, TAO -> LINK)
            # Usa o custo médio acumulado da moeda de origem
            if asset_costs[src_coin]['total_qty'] > 0:
                avg_src_cost_brl = asset_costs[src_coin]['total_cost_brl'] / asset_costs[src_coin]['total_qty']
                cost_brl = src_amt * avg_src_cost_brl

        if cost_brl > 0 and dst_coin not in ['BRL', 'EUR', 'USDT', 'USD']:
            asset_costs[dst_coin]['total_qty'] += dst_qty
            asset_costs[dst_coin]['total_cost_brl'] += cost_brl

print("\n==================== TICKET MÉDIO EXATO CALCULADO DO EXCEL DA BINANCE ====================")
usd_rate = 5.2238

results = {}
for coin, data in asset_costs.items():
    if data['total_qty'] > 0 and data['total_cost_brl'] > 0:
        avg_brl = data['total_cost_brl'] / data['total_qty']
        avg_usd = avg_brl / usd_rate
        results[coin] = {
            'qty': data['total_qty'],
            'total_cost_brl': data['total_cost_brl'],
            'avg_brl': avg_brl,
            'avg_usd': avg_usd
        }
        print(f"Moeda: {coin:8s} | Qtd Comprada: {data['total_qty']:14.8f} | Preço Médio (R$): R$ {avg_brl:10.2f} | TICKET MÉDIO ($): ${avg_usd:10.4f}")

# Salvar resultados em JSON para integração
import json
with open('backend/src/scripts/excel_ticket_medio.json', 'w') as f:
    json.dump(results, f, indent=2)
