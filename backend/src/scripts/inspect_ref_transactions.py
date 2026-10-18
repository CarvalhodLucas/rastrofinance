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

print("\n--- DETAILED LOOK AT 'Ref' ROWS ---")
for idx, r in enumerate(rows[header_row_idx+1:]):
    obs = str(r[11] if len(r)>11 else '')
    op = str(r[6] or '')
    if 'Ref' in obs or op == 'Buy Crypto With Fiat':
        # print surrounding rows
        time_str = r[3]
        coin = r[8]
        amount = r[9]
        print(f"Row {idx+1:4d} | Time: {time_str} | Op: {op:25s} | Coin: {str(coin):8s} | Amount: {str(amount):15s} | Obs: {obs}")
        # print previous 2 and next 2 rows in Excel
        actual_row_idx = header_row_idx + 1 + idx
        for offset in range(-2, 3):
            if offset == 0: continue
            cur_idx = actual_row_idx + offset
            if 0 <= cur_idx < len(rows):
                cr = rows[cur_idx]
                print(f"   [neighbor {offset:2d}] Time: {cr[3]} | Op: {str(cr[6]):25s} | Coin: {str(cr[8]):8s} | Amount: {str(cr[9]):15s} | Obs: {cr[11] if len(cr)>11 else ''}")
        print("-" * 100)
