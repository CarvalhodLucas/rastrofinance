import { useCallback, useEffect, useState } from 'react';
import { api } from '@/services/api';
import type { ConnectedAccount } from '@/types/finance';

const PLUGGY_SCRIPT_SRC =
  'https://cdn.pluggy.ai/pluggy-connect/v2.10.0/pluggy-connect.js';

/** Carrega o script do Pluggy Connect uma única vez. */
function loadPluggyScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PluggyConnect) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${PLUGGY_SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('Falha ao carregar o Pluggy Connect.')),
      );
      return;
    }
    const script = document.createElement('script');
    script.src = PLUGGY_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar o Pluggy Connect.'));
    document.body.appendChild(script);
  });
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { accounts } = await api.getAccounts();
      setAccounts(accounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar contas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { accounts, loading, error, reload: load };
}

export function usePluggyConnect() {
  const [connecting, setConnecting] = useState(false);

  /**
   * Abre o widget Pluggy Connect: pega token, carrega script, inicializa.
   * onSuccess: salva o item no backend e dispara o callback recebido.
   */
  const openConnect = useCallback(
    async (
      onConnected: () => void,
      onErrorMsg: (msg: string) => void,
    ): Promise<void> => {
      setConnecting(true);
      try {
        const [{ accessToken }] = await Promise.all([
          api.getConnectToken(),
          loadPluggyScript(),
        ]);

        const widget = new window.PluggyConnect({
          connectToken: accessToken,
          includeSandbox: true,
          onSuccess: (itemData) => {
            api
              .saveItem(itemData.item.id)
              .then(() => onConnected())
              .catch((err) =>
                onErrorMsg(
                  err instanceof Error
                    ? err.message
                    : 'Falha ao salvar a conexão.',
                ),
              )
              .finally(() => setConnecting(false));
          },
          onError: () => {
            onErrorMsg('Não foi possível conectar a instituição.');
            setConnecting(false);
          },
          onClose: () => setConnecting(false),
        });
        widget.init();
      } catch (err) {
        onErrorMsg(
          err instanceof Error ? err.message : 'Erro ao abrir o Pluggy Connect.',
        );
        setConnecting(false);
      }
    },
    [],
  );

  return { openConnect, connecting };
}
