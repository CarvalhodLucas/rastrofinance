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

# Mapa de compras acumuladas por ativo: qty total e valor gasto em USD
totals = defaultdict(lambda: {'qty': 0.0, 'spent_usd': 0.0})

# Histórico de preços spot aproximados na data das compras Auto-Invest (Ref)
# Ex: BTC em Out/2025 ~ $65,000, SOL em Out/2025 ~ $160, ONDO ~ $0.80, ETH ~ $2,600, ROSE ~ $0.06, VIRTUAL ~ $1.20
# Para cada linha 'Buy Crypto With Fiat' com 'Ref':
# Se Amount BRL/EUR deduzido existir, usa o valor deduzido.
# Se for 'Ref' sem dedução direta, calcula usando o preço da cotação no dia.

# Vamos processar linha a linha:
for r in rows[header_row_idx+1:]:
    op = str(r[6] or '')
    coin = str(r[8] or '')
    try:
        amount = float(r[9])
    except:
        continue
    obs = str(r[11] if len(r)>11 else '')
    time_str = str(r[3] or '')

    if op == 'Buy Crypto With Fiat' and amount > 0:
        # Se houver um valor em BRL ou EUR deduzido na mesma hora
        spent_usd = 0
        if 'Via CashBalance' in obs:
            # Tentar achar a dedução no mesmo segundo
            # Por ex: se a dedução foi R$ 600 -> spent_usd = 600 / 5.22 = 114.94 USD
            # se a dedução foi EUR 100 -> spent_usd = 100 * 1.08 = 108 USD
            pass

print("=== CALCULANDO TICKET MÉDIO REAL DAS COMPRAS REGISTRADAS NO EXCEL ===")
