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

print("\n--- ALL RAW COLUMNS FOR 'Ref' ROWS ---")
for idx, r in enumerate(rows[header_row_idx+1:]):
    obs = str(r[11] if len(r)>11 else '')
    if 'Ref' in obs or r[6] == 'Buy Crypto With Fiat':
        print(f"Row {idx+1:4d}:", [c for c in r if c is not None])
