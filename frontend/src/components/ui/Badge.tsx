import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  color?: string | null;
}

/**
 * Badge de categoria. Aceita uma cor hex (da categoria) e cria um
 * fundo translúcido + texto na mesma cor.
 */
export function Badge({ className, color, style, ...props }: BadgeProps) {
  const tint = color ?? '#9CA3AF';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
        className,
      )}
      style={{
        color: tint,
        backgroundColor: `${tint}1f`, // ~12% alpha
        ...style,
      }}
      {...props}
    />
  );
}
