import sys
import os
import openpyxl

sys.stdout.reconfigure(encoding='utf-8')

excel_files = [f for f in os.listdir('.') if f.endswith('.xlsx')]
binance_file = [f for f in excel_files if 'Binance' in f][0]

wb = openpyxl.load_workbook(binance_file)
sheet = wb.active

rows = list(sheet.iter_rows(values_only=True))
header = rows[0]
print("HEADER:", header)

operations = set()
assets = set()

for r in rows[1:]:
    # find non-none values
    op = r[6]
    coin = r[8]
    if op: operations.add(op)
    if coin: assets.add(coin)

print("\nUNIQUE OPERATIONS:", operations)
print("UNIQUE ASSETS:", assets)

print("\n--- SAMPLE NON-EARN ROWS ---")
count = 0
for r in rows[1:]:
    op = str(r[6])
    if 'Earn' not in op and 'Interest' not in op:
        print(r)
        count += 1
        if count >= 30:
            break
