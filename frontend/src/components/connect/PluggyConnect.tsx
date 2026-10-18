import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { usePluggyConnect } from '@/hooks/usePluggy';
import { useToast } from '@/components/ui/Toast';

interface Props {
  onConnected: () => void;
}

/** Botão que abre o widget Pluggy Connect para conectar um novo banco. */
export function PluggyConnect({ onConnected }: Props) {
  const { openConnect, connecting } = usePluggyConnect();
  const { notify } = useToast();

  const handleClick = () => {
    void openConnect(
      () => {
        notify('Banco conectado com sucesso!', 'success');
        onConnected();
      },
      (msg) => notify(msg, 'error'),
    );
  };

  return (
    <Button onClick={handleClick} disabled={connecting} size="lg">
      {connecting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Plus className="h-4 w-4" />
      )}
      {connecting ? 'Abrindo…' : 'Conectar novo banco'}
    </Button>
  );
}
