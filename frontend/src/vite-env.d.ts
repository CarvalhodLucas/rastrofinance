/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Tipagem global do widget Pluggy Connect carregado via CDN. */
interface PluggyConnectOptions {
  connectToken: string;
  includeSandbox?: boolean;
  onSuccess?: (itemData: { item: { id: string } }) => void;
  onError?: (error: unknown) => void;
  onClose?: () => void;
}

interface PluggyConnectInstance {
  init: () => void;
}

interface Window {
  PluggyConnect: new (options: PluggyConnectOptions) => PluggyConnectInstance;
}
