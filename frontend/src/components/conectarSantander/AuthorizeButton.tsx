import { useState } from 'react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Loader2, Landmark } from 'lucide-react';

interface AuthorizeButtonProps {
  label?: string;
}

export function AuthorizeButton({ label = 'Conectar Santander' }: AuthorizeButtonProps) {
  const { notify } = useToast();
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    try {
      setLoading(true);
      
      // Busca os bancos pra confirmar que Santander está lá (opcional, pode ser direto)
      // Vamos tentar direto "Banco Santander" 
      const response = await api.connectEnableBanking('Banco Santander');
      
      if (response.authorizationUrl) {
        window.location.href = response.authorizationUrl;
      } else {
        notify('Não foi possível obter a URL de autorização do banco.', 'error');
        setLoading(false);
      }
    } catch (err: any) {
      notify(err.message || 'Erro ao conectar. Tente novamente.', 'error');
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleConnect} disabled={loading} className="gap-2 bg-accent-gold text-bg-primary hover:bg-accent-gold/90 border-0">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}
      {label}
    </Button>
  );
}
