import { FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { formatDateShort } from '@/lib/format';
import type { AiInsight } from '@/types/finance';

/** Exibe a narrativa do relatório mensal mais recente. */
export function MonthlyNarrative({ insight }: { insight?: AiInsight }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-accent-gold" />
          Relatório mensal
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!insight ? (
          <EmptyState
            title="Nenhum relatório mensal ainda"
            description="O relatório é gerado automaticamente no primeiro dia de cada mês."
          />
        ) : (
          <article>
            <h4 className="font-semibold text-text-primary">{insight.title}</h4>
            {insight.period_start && insight.period_end && (
              <p className="mb-3 text-xs text-text-muted">
                {formatDateShort(insight.period_start)} —{' '}
                {formatDateShort(insight.period_end)}
              </p>
            )}
            <p className="whitespace-pre-line text-sm leading-[1.7] text-text-secondary">
              {insight.narrative}
            </p>
          </article>
        )}
      </CardContent>
    </Card>
  );
}
