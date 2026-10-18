import { env } from '../config/env.js';
import {
  getAllAccounts,
  getAllInvestments,
  getRecentTransactions,
  getActiveGoals,
} from './supabaseService.js';
import { getDividendsFromReport } from './dividendService.js';
import { getRealizedOperations } from './realizedService.js';
import { getUsdBrlRate, getEurBrlRate } from './quoteService.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const SUPPORT_SYSTEM_PROMPT = `Você é o Assistente Oficial e Analista Financeiro Inteligente da plataforma Rastro Finance (CRM Finanças).
Você atua em duas frentes fundamentais:
1. **Suporte Completo ao Usuário**: Tirar qualquer dúvida sobre funcionalidades, menus, importações, conexões e regras de negócio da plataforma inteira.
2. **Análise Financeira com Cruzamento de Dados Reais**: Você possui acesso em tempo real aos dados financeiros completos e consolidados do usuário (contas bancárias, carteira de investimentos, operações encerradas, dividendos, despesas e metas). Você DEVE cruzar essas informações sempre que o usuário fizer perguntas analíticas, comparativas ou pedir diagnósticos sobre sua saúde financeira.

### 🌟 SOBRE A PLATAFORMA RASTRO FINANCE:
O Rastro Finance é um sistema completo e moderno de gestão financeira pessoal e investimentos.
Ele une rastreamento de despesas, contas bancárias via Open Finance e gestão avançada de carteira de investimentos nacional e internacional.

### 📚 PRINCIPAIS MÓDULOS E FUNCIONALIDADES:

1. **Dashboard (Visão Geral)**:
   - Resumo consolidado do patrimônio e contas bancárias.
   - Indicadores de Fluxo de Caixa (Entradas, Saídas, Saldo Líquido do mês).
   - Separação inteligente entre Despesas Essenciais (moradia, saúde, alimentação básica) e Estilo de Vida (lazer, compras supérfluas).
   - Lista das últimas transações com categorização automática.

2. **Investimentos (Carteira Inteligente)**:
   - **Resumo**:
     - 4 Cards Hero com Patrimônio Total, Lucro/Prejuízo Total, Proventos Recebidos (12M) e Rentabilidade Total.
     - Gráfico de Evolução Patrimonial histórica (mês a mês dos últimos 12 meses, separando valor aplicado de ganho de capital).
     - Gráfico de Alocação por Classe de Ativo (Rosca donut com porcentagens reais).
     - Acórdions por classe (Ações, FIIs, Criptomoedas, Tesouro Direto, Renda Fixa, ETFs, Outros) com métricas consolidadas.
     - Seletor de moeda por tabela (BRL, USD, EUR, CLP) e seletor global no topo.
   - **Cotações e Preços em Tempo Real**:
     - Atualização automática de 1 em 1 hora (24/7) para Criptomoedas (Binance) e Dólar Comercial (USD/BRL), além de cotações da B3 via Yahoo Finance (com repetição a cada 30 min durante o pregão).
     - Botão manual "Sincronizar" para atualizar a qualquer momento.
   - **Importar B3**:
     - Permite importar a planilha oficial (.xlsx) exportada da "Área do Investidor" da B3.
     - Leitura e estruturação inteligente para cadastrar compras, vendas, desdobramentos e proventos.
   - **Binance (Criptomoedas)**:
     - Sincronização automática via API Key e API Secret.
     - Importação de histórico completo de compras e trocas (Swaps / Conversões de Cripto) via planilha Excel.
   - **Rentabilidade (Histórico Realizado)**:
     - Apuração de todas as operações encerradas (vendas com lucro ou prejuízo).
     - Filtros rápidos por classe (Todos, Ações, FIIs, Cripto, Renda Fixa) e por resultado (Todos, Lucros, Prejuízos).
     - Ordenação cronológica e botão para editar a data da operação caso o usuário queira corrigir o dia da venda.
   - **Proventos**:
     - Extrato e histórico de Dividendos, Juros sobre Capital Próprio (JCP) e Rendimentos de Fundos Imobiliários.
   - **Lançamentos**:
     - Histórico completo de transações da carteira (Compras, Vendas, Trocas), com opção de exclusão e recompilação.

3. **Transações & Extrato Bancário**:
   - Importação de arquivos de extrato (OFX, CSV, Excel).
   - Categorização automática inteligente (alimentação, transporte, lazer, contas fixas, etc.).
   - Filtros por conta bancária, data e tipo (receita / despesa).
   - Cadastro manual e edição de transações.

4. **Contas & Integrações (Open Finance)**:
   - **Pluggy**: Conexão Open Finance com bancos brasileiros (XP Investimentos, NuInvest, Nubank, Itaú, etc.).
   - **Enable Banking**: Conexão oficial Open Banking europeia com Santander España.
   - **Wise**: Saldos e extratos multimoeda (Dólar, Euro, etc.).

5. **Planilha Inteligente (SmartSheet)**:
   - Visualização estilo planilha com edição rápida de células, fórmulas e exportação.

6. **Configurações**:
   - Alternância de Tema Escuro (Dark) e Tema Claro (Light).
   - Escolha da moeda principal de visualização: Real (BRL R$), Dólar (USD $), Euro (EUR €) ou Peso Chileno (CLP $).
   - Gerenciamento de chaves de API e integrações.

---

### 🧠 DIRETRIZES PARA CRUZAMENTO E ANÁLISE DE DADOS:
- Sempre que o usuário perguntar sobre suas finanças ou solicitar comparações, cruze os dados fornecidos no bloco abaixo.
- Use valores e percentuais exatos (ex: "Seus proventos acumulados de R$ 782,43 equivalem a X% dos seus gastos recentes...").
- Se o usuário perguntar sobre risco ou alocação, calcule a proporção real de Criptomoedas versus Renda Fixa e saldos líquidos.
- Responda em Português do Brasil com formatação elegante em Markdown (tópicos, negrito, destaques).
- REGRA CRÍTICA: NUNCA diga que você é DeepSeek, nem use a frase "impulsionado pelo modelo DeepSeek" ou mencione fornecedores externos de IA. Seu nome e identidade são exclusivamente "Assistente Inteligente do Rastro Finance".
`;

/**
 * Compila o snapshot financeiro em tempo real do usuário para permitir cruzamento analítico de dados.
 */
async function buildFinancialContext(): Promise<string> {
  try {
    const [accounts, investments, dividendsRes, realizedOps, goals, usdBrl, eurBrl] =
      await Promise.all([
        getAllAccounts().catch(() => []),
        getAllInvestments().catch(() => []),
        getDividendsFromReport().catch(() => null),
        getRealizedOperations().catch(() => []),
        getActiveGoals().catch(() => []),
        getUsdBrlRate().catch(() => 5.20),
        getEurBrlRate().catch(() => 5.50),
      ]);

    // 1. Investimentos Ativos
    const activeInvs = investments.filter(
      (i) => i.quantity > 0 && i.sync_source !== 'GORILA_CLOSED'
    );
    let totalInvestmentsBrl = 0;
    let totalInvestedCostBrl = 0;
    const byClass: Record<string, { totalBrl: number; count: number; items: string[] }> = {};
    const byBroker: Record<string, number> = {};

    for (const inv of activeInvs) {
      const ticker = (inv.code_ticker || inv.name || '').toUpperCase();
      const isUsd =
        inv.currency === 'USD' ||
        inv.currency === 'USDT' ||
        inv.asset_type === 'CRYPTO' ||
        inv.institution?.toUpperCase() === 'BINANCE' ||
        ticker.includes('WISE_USD');
      const isEur = inv.currency === 'EUR' || ticker.includes('WISE_EUR');
      const mult = isUsd ? usdBrl : isEur ? eurBrl : 1.0;

      const rawVal =
        inv.total_value ??
        inv.quantity * (inv.current_price || inv.average_price || 0);
      const rawCost = inv.quantity * (inv.average_price || inv.current_price || 0);
      const valBrl = rawVal * mult;
      const costBrl = rawCost * mult;

      totalInvestmentsBrl += valBrl;
      totalInvestedCostBrl += costBrl;

      const cat = inv.asset_type || 'OUTRO';
      if (!byClass[cat]) byClass[cat] = { totalBrl: 0, count: 0, items: [] };
      byClass[cat].totalBrl += valBrl;
      byClass[cat].count += 1;
      byClass[cat].items.push(
        `${inv.code_ticker || inv.name}: ${inv.quantity} un @ R$ ${valBrl.toFixed(2)} (${inv.institution})`
      );

      const broker = inv.institution || 'Manual';
      byBroker[broker] = (byBroker[broker] || 0) + valBrl;
    }

    // 2. Contas Bancárias
    let totalCashAccountsBrl = 0;
    const accountsSummary = accounts
      .map((a) => {
        const isUsd = a.currency === 'USD';
        const isEur = a.currency === 'EUR';
        const mult = isUsd ? usdBrl : isEur ? eurBrl : 1.0;
        const balBrl = (a.balance || 0) * mult;
        totalCashAccountsBrl += balBrl;
        return `- ${a.institution_name} (${a.account_name}): ${a.currency || 'BRL'} ${(a.balance || 0).toFixed(2)} (equiv. R$ ${balBrl.toFixed(2)})`;
      })
      .join('\n');

    // 3. Operações Encerradas (Histórico Realizado)
    const totalRealizedProfitLoss = realizedOps.reduce(
      (sum, o) => sum + (o.result_brl || 0),
      0
    );
    const winTrades = realizedOps.filter((o) => o.result_brl >= 0);
    const lossTrades = realizedOps.filter((o) => o.result_brl < 0);
    const topGain = [...winTrades].sort((a, b) => b.result_brl - a.result_brl)[0];
    const topLoss = [...lossTrades].sort((a, b) => a.result_brl - b.result_brl)[0];

    // 4. Transações Recentes e Padrões de Gasto
    const recentTxs = await getRecentTransactions(60).catch(() => []);
    let recentExpenseTotal = 0;
    let recentIncomeTotal = 0;
    const expenseByCategory: Record<string, number> = {};

    for (const t of recentTxs) {
      const amt = Number(t.amount || 0);
      if (amt < 0) {
        const abs = Math.abs(amt);
        recentExpenseTotal += abs;
        const cat = t.category || 'Outros';
        expenseByCategory[cat] = (expenseByCategory[cat] || 0) + abs;
      } else {
        recentIncomeTotal += amt;
      }
    }

    const topCategories = Object.entries(expenseByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, val]) => `${cat}: R$ ${val.toFixed(2)}`)
      .join(', ');

    return `
=== 📊 DADOS FINANCEIROS CONSOLIDADOS DO USUÁRIO EM TEMPO REAL ===
Cotações Oficiais: USD/BRL = R$ ${usdBrl.toFixed(2)} | EUR/BRL = R$ ${eurBrl.toFixed(2)}

1. CONTAS BANCÁRIAS E SALDOS DISPONÍVEIS:
- Saldo Líquido Total em Contas: R$ ${totalCashAccountsBrl.toFixed(2)}
Detalhe das Contas:
${accountsSummary || 'Nenhuma conta cadastrada.'}

2. CARTEIRA DE INVESTIMENTOS ATIVA:
- Patrimônio Total em Investimentos: R$ ${totalInvestmentsBrl.toFixed(2)}
- Custo Total Aplicado (Preço Médio): R$ ${totalInvestedCostBrl.toFixed(2)}
- Lucro/Prejuízo Não Realizado: R$ ${(totalInvestmentsBrl - totalInvestedCostBrl).toFixed(2)} (${totalInvestedCostBrl > 0 ? (((totalInvestmentsBrl - totalInvestedCostBrl) / totalInvestedCostBrl) * 100).toFixed(2) : 0}%)
- Distribuição por Classe:
${Object.entries(byClass)
  .map(
    ([cls, data]) =>
      `  * ${cls}: R$ ${data.totalBrl.toFixed(2)} (${((data.totalBrl / (totalInvestmentsBrl || 1)) * 100).toFixed(1)}%) - ${data.count} ativos: [${data.items.slice(0, 10).join('; ')}]`
  )
  .join('\n')}
- Distribuição por Instituição/Corretora:
${Object.entries(byBroker)
  .map(
    ([broker, val]) =>
      `  * ${broker}: R$ ${val.toFixed(2)} (${((val / (totalInvestmentsBrl || 1)) * 100).toFixed(1)}%)`
  )
  .join('\n')}

3. OPERAÇÕES ENCERRADAS (HISTÓRICO REALIZADO / VENDAS PASSADAS):
- Total de Operações Fechadas: ${realizedOps.length} (Lucros: ${winTrades.length}, Prejuízos: ${lossTrades.length})
- Resultado Líquido Realizado Total: R$ ${totalRealizedProfitLoss.toFixed(2)}
- Maior Ganho Histórico: ${topGain ? `${topGain.ticker} (+R$ ${topGain.result_brl.toFixed(2)}) em ${topGain.date?.substring(0, 10) || 'legado'}` : 'N/A'}
- Maior Perda Histórica: ${topLoss ? `${topLoss.ticker} (R$ ${topLoss.result_brl.toFixed(2)}) em ${topLoss.date?.substring(0, 10) || 'legado'}` : 'N/A'}

4. PROVENTOS E DIVIDENDOS:
- Total Acumulado de Dividendos/JCP/Rendimentos Recebidos: R$ ${(dividendsRes?.total_overall || 0).toFixed(2)}

5. TRANSAÇÕES E DESPESAS RECENTES:
- Total de Saídas Recentes analisadas: R$ ${recentExpenseTotal.toFixed(2)}
- Total de Entradas Recentes analisadas: R$ ${recentIncomeTotal.toFixed(2)}
- Principais Categorias de Gasto: ${topCategories || 'Nenhuma registrada'}

6. METAS FINANCEIRAS ATIVAS:
${goals.length > 0 ? goals.map((g) => `- Meta "${g.name}": Alvo R$ ${Number(g.target_amount).toFixed(2)} | Atual R$ ${Number(g.current_amount).toFixed(2)}`).join('\n') : 'Nenhuma meta cadastrada.'}

7. PATRIMÔNIO LÍQUIDO CONSOLIDADO (CONTAS + CARTEIRA):
- Patrimônio Geral: R$ ${(totalCashAccountsBrl + totalInvestmentsBrl).toFixed(2)}
===================================================================
`;
  } catch (err) {
    console.warn('[supportService] Falha ao coletar contexto financeiro:', err);
    return '';
  }
}

export async function askSupportAssistant(
  messages: ChatMessage[],
  currentPage?: string
): Promise<{ reply: string; model: string }> {
  const apiKey = env.OPENROUTER_API_KEY;
  const model = 'deepseek/deepseek-v4.1-flash';

  if (!apiKey || apiKey === 'xxxx') {
    throw new Error('Chave da API do OpenRouter não configurada no servidor.');
  }

  // Coleta dados consolidados em tempo real para permitir cruzamento de dados
  const liveFinancialContext = await buildFinancialContext();

  let contextAddon = '';
  if (currentPage) {
    contextAddon = `\n[Página Atual do Usuário: "${currentPage}"]\n`;
  }

  const systemMessage: ChatMessage = {
    role: 'system',
    content: `${SUPPORT_SYSTEM_PROMPT}\n${contextAddon}\n${liveFinancialContext}`,
  };

  const fullMessages = [systemMessage, ...messages];

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://rastrofinance.com',
      'X-Title': 'Rastro Finance Support Chat',
    },
    body: JSON.stringify({
      model,
      messages: fullMessages,
      temperature: 0.4,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[supportService] Erro na API do OpenRouter:', errorText);
    throw new Error(`Erro na comunicação com o assistente de IA (${response.status}): ${errorText}`);
  }

  const data: any = await response.json();
  const reply = data?.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    throw new Error('Nenhuma resposta retornada pelo modelo de suporte.');
  }

  return {
    reply,
    model: data.model || model,
  };
}
