import XLSX from 'xlsx';

export interface B3ParsedData {
  headers: string[];
  rows: Record<string, any>[];
  totalRows: number;
}

/**
 * Lê o arquivo Excel/CSV do extrato B3 e extrai as linhas como objetos brutos.
 * O layout pode variar, então a função detecta dinamicamente a linha de cabeçalho
 * e retorna as linhas sem processar semanticamente (deixando isso para a IA).
 */
export function parseB3File(fileBuffer: Buffer, filename: string): B3ParsedData {
  // Lê a planilha usando XLSX.read()
  const workbook = XLSX.read(fileBuffer, {
    type: 'buffer',
    cellDates: true, // Auto converter datas do Excel
    cellNF: false,
    cellText: false
  });
  
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Planilha vazia ou sem abas.');
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error('Planilha vazia ou inválida.');
  }

  // Converte para grid de arrays (linhas e colunas)
  const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
  
  if (data.length === 0) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  // Detecta dinamicamente a linha de cabeçalho. 
  // Procuramos pela primeira linha com pelo menos 3 colunas não-vazias que se pareça com cabeçalho B3.
  let headerIndex = -1;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    const nonEmpties = row.filter((val: any) => val !== null && val !== undefined && val !== '');
    if (nonEmpties.length >= 3) {
      const rowStr = JSON.stringify(row).toLowerCase();
      if (
        rowStr.includes('negócio') || 
        rowStr.includes('movimentação') || 
        rowStr.includes('código') || 
        rowStr.includes('produto') || 
        rowStr.includes('quantidade') ||
        rowStr.includes('mercado') ||
        rowStr.includes('instituição')
      ) {
        headerIndex = i;
        break;
      }
    }
  }

  // Se não encontrar por termos chave, pega a primeira linha com pelo menos 3 valores
  if (headerIndex === -1) {
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;
      const nonEmpties = row.filter((val: any) => val !== null && val !== undefined && val !== '');
      if (nonEmpties.length >= 3) {
        headerIndex = i;
        break;
      }
    }
  }

  if (headerIndex === -1) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  const headerRow = data[headerIndex];
  if (!headerRow) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  // Filtra nomes vazios nos headers
  const headers = headerRow
    .map((h: any) => String(h || '').trim())
    .filter(Boolean);

  const rows: Record<string, any>[] = [];

  for (let i = headerIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    
    // Ignora linhas vazias
    const nonEmpties = row.filter((val: any) => val !== null && val !== undefined && val !== '');
    if (nonEmpties.length === 0) continue;
    
    // Ignora linhas de rodapé/totalizadores
    const rowStr = JSON.stringify(row).toLowerCase();
    if (rowStr.includes('total') || rowStr.includes('subtotal') || rowStr.includes('resumo')) {
      continue;
    }

    const rowObj: Record<string, any> = {};
    let hasData = false;
    
    for (let j = 0; j < headerRow.length; j++) {
      const colName = headerRow[j];
      if (colName) {
        const val = row[j];
        rowObj[colName] = val;
        if (val !== null && val !== undefined && val !== '') {
          hasData = true;
        }
      }
    }

    if (hasData) {
      rows.push(rowObj);
    }
  }

  return {
    headers,
    rows,
    totalRows: rows.length
  };
}
