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

print("All non-earn transactions from Excel:")
for r in rows[header_row_idx+1:]:
    op = str(r[6] or '')
    if 'Earn' not in op and 'Interest' not in op:
        time_str = r[3]
        coin = r[8]
        amount = r[9]
        obs = r[11] if len(r) > 11 else ''
        print(f"{time_str} | Op: {op:30s} | Coin: {str(coin):10s} | Amount: {str(amount):15s} | Obs: {obs}")
