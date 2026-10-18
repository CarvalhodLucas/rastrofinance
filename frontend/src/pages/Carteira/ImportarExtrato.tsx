import { useState } from 'react';
import { Info, Loader2, AlertCircle } from 'lucide-react';
import { ImportProgressSteps } from '@/components/carteira/ImportProgressSteps';
import { UploadDropzone } from '@/components/carteira/UploadDropzone';
import { PreviewTable } from '@/components/carteira/PreviewTable';
import { ImportSummary } from '@/components/carteira/ImportSummary';
import { Button } from '@/components/ui/Button';

type ImportStep = 'upload' | 'processing' | 'preview' | 'completed';

export function ImportarExtrato() {
  const [step, setStep] = useState<ImportStep>('upload');
  const [batchId, setBatchId] = useState<string | null>(null);
  const [parsed, setParsed] = useState<any[]>([]);
  const [needsReview, setNeedsReview] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [summary, setSummary] = useState<{
    imported: number;
    newHoldings: number;
    totalInvested: number;
  } | null>(null);

  const handleUploadStart = () => {
    setError(null);
    setStep('processing');
  };

  const handleUploadSuccess = (data: {
    batchId: string;
    parsed: any[];
    needsReview: any[];
    totalRows: number;
  }) => {
    setBatchId(data.batchId);
    setParsed(data.parsed);
    setNeedsReview(data.needsReview);
    setStep('preview');
  };

  const handleUploadError = (errMessage: string) => {
    setError(errMessage);
    setStep('upload');
  };

  const handleConfirmSuccess = (confirmSummary: {
    imported: number;
    newHoldings: number;
    totalInvested: number;
  }) => {
    setSummary(confirmSummary);
    setStep('completed');
  };

  const handleCancel = () => {
    setBatchId(null);
    setParsed([]);
    setNeedsReview([]);
    setSummary(null);
    setError(null);
    setStep('upload');
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div className="text-left space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-gold/15 text-accent-gold text-lg">
              📥
            </span>
            Importar Extrato B3
          </h1>
          <p className="text-sm text-text-secondary">
            Envie sua planilha de negociação B3 para alimentar automaticamente sua carteira com Inteligência Artificial.
          </p>
        </div>
      </div>

      {/* Indicador de progresso */}
      <ImportProgressSteps currentStep={step} />

      {/* Conteúdo com base no step atual */}
      <div className="flex justify-center">
        <div className="w-full max-w-4xl">
          {/* Alerta de erro se houver */}
          {error && (
            <div className="mb-6 p-4 rounded-xl border border-accent-red/20 bg-accent-red/5 flex items-start gap-3 text-left">
              <AlertCircle className="h-5 w-5 text-accent-red shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-text-primary">Erro no Processamento</h4>
                <p className="text-xs text-text-secondary">{error}</p>
                <Button
                  onClick={handleCancel}
                  size="sm"
                  variant="outline"
                  className="mt-1 cursor-pointer text-xs"
                >
                  Tentar Novamente
                </Button>
              </div>
            </div>
          )}

          {step === 'upload' && (
            <div className="space-y-8">
              {/* Card de instruções */}
              <div className="rounded-xl border border-border bg-bg-card p-6 text-left space-y-4">
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <Info className="h-5 w-5 text-accent-gold" />
                  Como obter seu extrato de negociação B3:
                </h3>
                <ol className="list-decimal list-inside space-y-2.5 text-sm text-text-secondary pl-1">
                  <li>
                    Acesse{' '}
                    <a
                      href="https://investidor.b3.com.br"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-gold hover:underline font-semibold"
                    >
                      investidor.b3.com.br
                    </a>{' '}
                    e faça login com seu CPF.
                  </li>
                  <li>
                    No menu superior, vá em <span className="font-semibold text-text-primary">Extratos</span> →{' '}
                    <span className="font-semibold text-text-primary">Extrato de Negociação</span>.
                  </li>
                  <li>Selecione o período desejado e todas as corretoras que utilizou no período.</li>
                  <li>
                    Clique em filtrar e depois baixe o arquivo em Excel (<span className="font-mono text-text-primary font-bold">.xlsx</span>).
                  </li>
                  <li>Faça o upload do arquivo gerado no campo abaixo.</li>
                </ol>
              </div>

              {/* Área de Dropzone */}
              <UploadDropzone
                onUploadStart={handleUploadStart}
                onUploadSuccess={handleUploadSuccess}
                onUploadError={handleUploadError}
              />
            </div>
          )}

          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 rounded-xl border border-border bg-bg-card/40">
              <div className="relative flex items-center justify-center">
                <Loader2 className="h-12 w-12 text-accent-gold animate-spin relative z-10" />
                <div className="absolute inset-0 rounded-full bg-accent-gold/10 animate-ping" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-text-primary">
                  Processando com IA do DeepSeek...
                </h3>
                <p className="text-sm text-text-secondary max-w-sm">
                  Lendo planilha, mapeando colunas e interpretando os tickers, quantidades e valores monetários. Isso pode levar alguns segundos.
                </p>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="text-left">
                <h2 className="text-lg font-bold text-text-primary">
                  Revisão dos dados da carteira
                </h2>
                <p className="text-xs text-text-secondary">
                  Abaixo estão os dados interpretados pela IA. Você pode editar os campos em linha ou remover linhas indesejadas antes de confirmar a importação final.
                </p>
              </div>
              <PreviewTable
                batchId={batchId!}
                initialParsed={parsed}
                initialNeedsReview={needsReview}
                onConfirm={handleConfirmSuccess}
                onCancel={handleCancel}
              />
            </div>
          )}

          {step === 'completed' && summary && (
            <ImportSummary
              importedCount={summary.imported}
              newHoldingsCount={summary.newHoldings}
              totalInvested={summary.totalInvested}
              onReset={handleCancel}
            />
          )}
        </div>
      </div>
    </div>
  );
}
export default ImportarExtrato;
