import sys
import os
import openpyxl

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

print(f"Total rows in Excel: {len(rows)}")

target_coins = ['BTC', 'ETH', 'SOL', 'ONDO', 'ROSE', 'VIRTUAL', 'LINK', 'RENDER', 'SXT']

print("\n================ ALL TRANSACTIONS FOR TARGET COINS ================")
for idx, r in enumerate(rows[header_row_idx+1:]):
    coin = str(r[8] or '')
    op = str(r[6] or '')
    if coin in target_coins or any(c in str(r) for c in target_coins):
        if 'Earn' not in op and 'Interest' not in op:
            print(f"Row {idx+1:4d} | Time: {r[3]} | Op: {op:25s} | Coin: {coin:6s} | Change: {str(r[9]):15s} | Obs: {r[11] if len(r)>11 else ''}")
