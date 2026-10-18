import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, RefreshCw } from 'lucide-react';
import { AssetLogo } from '@/components/investments/AssetLogo';
import { WatchlistSparkline } from '@/components/investments/WatchlistSparkline';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type { WatchlistResponse } from '@/types/finance';

export function WatchlistQuickWidget() {
  const { user } = useAuth();
  const cacheKey = user?.id ? `rastro_watchlist_cache_${user.id}` : 'rastro_watchlist_cache_anon';

  const [data, setData] = useState<WatchlistResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setData(null);
    // 1. Tentar cache local primeiro para renderizar instantaneamente
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        setData(JSON.parse(cached));
        setLoading(false);
      } catch {}
    } else {
      setLoading(true);
    }

    // 2. Buscar atualizado em background
    void api
      .getWatchlist(false)
      .then((res) => {
        setData(res);
        localStorage.setItem(cacheKey, JSON.stringify(res));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id, cacheKey]);

  const items = data?.items || [];
  if (items.length === 0 && !loading) {
    return (
      <div className="bg-bg-surface/90 backdrop-blur-md rounded-2xl border border-border-default/70 p-4 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-accent-gold/15 flex items-center justify-center text-accent-gold">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-text-primary">Radar de Cotações</h3>
            <p className="text-xs text-text-muted">Acompanhe suas ações da B3 e criptos favoritas em um só lugar com alertas de preço.</p>
          </div>
        </div>
        <Link
          to="/investments?tab=WATCHLIST"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-black bg-accent-gold hover:bg-accent-gold/90 transition-all shadow-xs shrink-0"
        >
          <span>Personalizar Radar</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-bg-surface/90 backdrop-blur-md rounded-2xl border border-border-default/70 p-4 shadow-xs space-y-3">
      {/* Topo do Widget */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-accent-gold/15 flex items-center justify-center text-accent-gold">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-text-primary flex items-center gap-2">
              Radar de Cotações
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Ao Vivo
              </span>
            </h3>
            <p className="text-[11px] text-text-muted">Acompanhamento rápido: Bolsa B3 & Binance Cripto</p>
          </div>
        </div>

        <Link
          to="/investments?tab=WATCHLIST"
          className="flex items-center gap-1 text-xs font-semibold text-accent-gold hover:text-accent-gold/80 transition-colors"
        >
          <span>Abrir Radar</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Faixa Rolável Horizontal (Quick Glance) */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-0.5 scrollbar-none">
        {loading && items.length === 0 ? (
          <div className="flex items-center gap-2 py-4 px-2 text-xs text-text-muted">
            <RefreshCw className="h-4 w-4 animate-spin text-accent-gold" />
            <span>Carregando cotações rápidas...</span>
          </div>
        ) : (
          items.map((item) => {
            const varNum = parseFloat(item.variation);
            const isPositive = varNum >= 0;
            const displayTicker = item.ticker.replace(/\.SA$/, '');
            const isUsd = item.currency === 'USD';

            return (
              <Link
                key={item.ticker}
                to="/investments?tab=WATCHLIST"
                className="group flex items-center gap-3 bg-bg-elevated/70 hover:bg-bg-elevated p-2.5 rounded-xl border border-border-default/60 hover:border-accent-gold/40 transition-all shrink-0 min-w-[210px]"
              >
                <AssetLogo
                  ticker={displayTicker}
                  name={item.name}
                  assetType={item.type}
                  institution={item.type === 'CRYPTO' ? 'Binance' : 'B3'}
                  sizeClassName="h-7 w-7"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs text-text-primary truncate">{displayTicker}</span>
                    <span
                      className={`text-[10px] font-bold px-1 rounded tabular-nums ${
                        isPositive ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {varNum.toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-[11px] font-semibold text-text-secondary tabular-nums">
                      {isUsd
                        ? `$${item.price < 1 ? item.price.toFixed(4) : item.price.toFixed(2)}`
                        : `R$${item.price.toFixed(2)}`}
                    </span>
                    <WatchlistSparkline
                      data={item.sparkline}
                      isPositive={isPositive}
                      width={50}
                      height={18}
                    />
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
