import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api } from '@/services/api';

export type Language = 'pt' | 'es';

export interface LanguageOption {
  code: Language;
  label: string;
  nativeLabel: string;
  flag: string;
  description: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    code: 'pt',
    label: 'Português (Brasil)',
    nativeLabel: 'Português',
    flag: '🇧🇷',
    description: 'Interface padrão em português brasileiro',
  },
  {
    code: 'es',
    label: 'Español',
    nativeLabel: 'Español',
    flag: '🇪🇸',
    description: 'Interfaz completamente traducida al español',
  },
];

const STORAGE_KEY = 'rastro_language';

type Translations = Record<string, string>;

const TRANSLATIONS: Record<Language, Translations> = {
  pt: {
    // Nav & Titles
    'nav.dashboard': 'Dashboard',
    'nav.transactions': 'Transações',
    'nav.investments': 'Investimentos',
    'nav.watchlist': 'Radar & Acompanhamento',
    'nav.insights': 'Insights IA',
    'nav.connect': 'Contas',
    'nav.settings': 'Configurações',
    'nav.planilha': 'Planilha',
    'nav.planilha_full': 'Planilha Inteligente',
    'nav.overview': 'Visão Geral',
    'nav.watchlist_radar': 'Radar de Cotações',
    'nav.stocks': 'Ações (B3)',
    'nav.fiis': 'FIIs',
    'nav.fixed_income': 'Renda Fixa',
    'nav.crypto': 'Criptomoedas',
    'nav.trades': 'Histórico de Transações',
    'nav.dividends': 'Dividendos & Proventos',
    'nav.realized': 'Ganhos & Perdas',
    'nav.import_b3': 'Importar Extrato',
    'nav.logout': 'Sair da conta',
    'nav.last_sync': 'Última sync',
    'nav.main_currency': 'Moeda Principal',
    'nav.home': 'Início',
    'nav.invest': 'Investir',

    // Header
    'header.support_ai': 'Suporte IA',
    'header.support_tooltip': 'Abrir Chat de Suporte & Análise Financeira',
    'header.theme_light': 'Mudar para Tema Claro (Light)',
    'header.theme_dark': 'Mudar para Tema Escuro (Dark)',
    'header.currency_tooltip': 'Alternar Moeda de Exibição do Site',

    // Settings General
    'settings.title': 'Configurações & Preferências',
    'settings.subtitle': 'Personalize idioma, notificações automáticas, moedas de exibição, limites financeiros e automações de IA.',
    'settings.save_changes': 'Salvar Alterações',
    'settings.saving': 'Salvando...',
    'settings.unsaved_changes': 'Alterações não salvas',
    'settings.saved_success': 'Configurações salvas com sucesso.',
    'settings.save_error': 'Falha ao salvar configurações.',
    'settings.load_error': 'Falha ao carregar configurações.',

    // Settings Tabs
    'settings.tab_all': 'Visão Geral',
    'settings.tab_notifications': 'Notificações',
    'settings.tab_language_currency': 'Idioma & Moeda',
    'settings.tab_goals': 'Metas Financeiras',
    'settings.tab_system': 'Ações do Sistema',

    // Language Card
    'settings.language_title': 'Idioma do Sistema',
    'settings.language_subtitle': 'Escolha o idioma de exibição para a interface, navegação e relatórios.',
    'settings.language_changed': 'Idioma alterado com sucesso.',
    'settings.language_active': 'Idioma Ativo',

    // Currency Card
    'settings.currency_title': 'Moeda de Exibição do Sistema',
    'settings.currency_subtitle': 'Todos os valores e gráficos do painel serão convertidos automaticamente em tempo real.',
    'settings.currency_changed': 'Moeda de exibição alterada.',
    'settings.rate_updated': 'Cotação atualizada:',
    'settings.rate_fetching': 'Buscando cotação em tempo real para',
    'settings.rate_example': 'Exemplo',

    // Notifications Card
    'settings.notifications_title': 'Notificações & Canais de Alerta',
    'settings.notifications_subtitle': 'Receba relatórios e análises preditivas direto no seu celular.',
    'settings.whatsapp_title': 'WhatsApp',
    'settings.whatsapp_toggle': 'Resumos automáticos no WhatsApp',
    'settings.whatsapp_toggle_desc': 'Envia balanços de ganhos e gastos',
    'settings.ai_toggle': 'Análise e alertas de IA',
    'settings.ai_toggle_desc': 'Detecta anomalias e dicas preditivas',
    'settings.daily_report_time': 'Horário do Relatório Diário',
    'settings.whatsapp_number': 'Número WhatsApp (DDI + DDD + Número)',
    'settings.telegram_title': 'Telegram Bot',
    'settings.telegram_toggle': 'Enviar resumos pelo Telegram',
    'settings.telegram_toggle_desc': 'Mensagens automáticas via Bot dedicado',
    'settings.telegram_bot_token': 'Bot Token',
    'settings.telegram_chat_id': 'Chat ID',
    'settings.telegram_guide_title': 'Como configurar o Telegram:',

    // Goals Card
    'settings.goals_title': 'Metas & Limites Orçamentários',
    'settings.goals_subtitle': 'Defina orçamentos por categoria ou limite geral de gastos para monitoramento inteligente.',
    'settings.new_goal': 'Nova Meta Financeira',
    'settings.add_goal': 'Adicionar Meta',
    'settings.no_goals': 'Nenhuma meta configurada',
    'settings.no_goals_desc': 'Adicione um limite de gastos para receber alertas de estouro.',
    'settings.general_no_cat': 'Geral (Sem categoria)',

    // System Actions
    'settings.system_title': 'Ações Manuais & Execução de Jobs',
    'settings.system_subtitle': 'Execute gatilhos manuais de sincronização e geração de relatórios de IA sob demanda.',
    'settings.sync_banks': 'Sincronizar Bancos',
    'settings.sync_banks_desc': 'Atualizar extratos e saldos',
    'settings.daily_insight': 'Insight Diário',
    'settings.daily_insight_desc': 'Gerar análise IA de hoje',
    'settings.monthly_report': 'Relatório Mensal',
    'settings.monthly_report_desc': 'Gerar compilado do mês',

    // Summary Sidebar
    'settings.system_summary': 'Resumo do Sistema',
    'settings.active_currency': 'Moeda Ativa',
    'settings.active_goals': 'Metas Ativas',
    'settings.banking_connectors': 'Conectores Bancários',
    'settings.santander_desc': 'Conecte sua conta jurídica ou física Santander para sincronizar transações em tempo real.',
    'settings.configure_santander': 'Configurar Santander',
    'settings.security_title': 'Privacidade & Segurança',
    'settings.security_desc': 'Seus tokens do Telegram e dados bancários são armazenados com criptografia de ponta e nunca expostos.',

    // Statuses
    'status.active': 'Ativo',
    'status.inactive': 'Desativado',
    'status.pending': 'Pendente',
    'status.connected': 'Conectado',
    'status.available': 'Disponível',

    // Common
    'common.save': 'Salvar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Excluir',
    'common.edit': 'Editar',
    'common.back': 'Voltar',
    'common.search': 'Buscar',
    'common.filter': 'Filtrar',
    'common.value': 'Valor',
    'common.date': 'Data',
    'common.category': 'Categoria',
    'common.actions': 'Ações',
  },
  es: {
    // Nav & Titles
    'nav.dashboard': 'Panel de Control',
    'nav.transactions': 'Transacciones',
    'nav.investments': 'Inversiones',
    'nav.watchlist': 'Radar y Seguimiento',
    'nav.insights': 'Ideas de IA',
    'nav.connect': 'Cuentas',
    'nav.settings': 'Configuraciones',
    'nav.planilha': 'Planilla',
    'nav.planilha_full': 'Planilla Inteligente',
    'nav.overview': 'Visión General',
    'nav.watchlist_radar': 'Radar de Cotizaciones',
    'nav.stocks': 'Acciones (B3)',
    'nav.fiis': 'FIIs (Bienes Raíces)',
    'nav.fixed_income': 'Renta Fija',
    'nav.crypto': 'Criptomonedas',
    'nav.trades': 'Historial de Transacciones',
    'nav.dividends': 'Dividendos y Ganancias',
    'nav.realized': 'Ganancias y Pérdidas',
    'nav.import_b3': 'Importar Extracto',
    'nav.logout': 'Cerrar sesión',
    'nav.last_sync': 'Última sinc.',
    'nav.main_currency': 'Moneda Principal',
    'nav.home': 'Inicio',
    'nav.invest': 'Invertir',

    // Header
    'header.support_ai': 'Soporte IA',
    'header.support_tooltip': 'Abrir Chat de Soporte y Análisis Financiero',
    'header.theme_light': 'Cambiar a Tema Claro (Light)',
    'header.theme_dark': 'Cambiar a Tema Oscuro (Dark)',
    'header.currency_tooltip': 'Cambiar Moneda de Visualización',

    // Settings General
    'settings.title': 'Configuraciones y Preferencias',
    'settings.subtitle': 'Personalice el idioma, notificaciones automáticas, monedas de visualización, límites financieros y automatizaciones de IA.',
    'settings.save_changes': 'Guardar Cambios',
    'settings.saving': 'Guardando...',
    'settings.unsaved_changes': 'Cambios sin guardar',
    'settings.saved_success': 'Configuraciones guardadas con éxito.',
    'settings.save_error': 'Error al guardar las configuraciones.',
    'settings.load_error': 'Error al cargar las configuraciones.',

    // Settings Tabs
    'settings.tab_all': 'Visión General',
    'settings.tab_notifications': 'Notificaciones',
    'settings.tab_language_currency': 'Idioma y Moneda',
    'settings.tab_goals': 'Metas Financieras',
    'settings.tab_system': 'Acciones del Sistema',

    // Language Card
    'settings.language_title': 'Idioma del Sistema',
    'settings.language_subtitle': 'Elija el idioma de visualización para la interfaz, navegación e informes.',
    'settings.language_changed': 'Idioma cambiado con éxito.',
    'settings.language_active': 'Idioma Activo',

    // Currency Card
    'settings.currency_title': 'Moneda de Visualización del Sistema',
    'settings.currency_subtitle': 'Todos los valores y gráficos del panel se convertirán automáticamente en tiempo real.',
    'settings.currency_changed': 'Moneda de visualización modificada.',
    'settings.rate_updated': 'Cotización actualizada:',
    'settings.rate_fetching': 'Buscando cotización en tiempo real para',
    'settings.rate_example': 'Ejemplo',

    // Notifications Card
    'settings.notifications_title': 'Notificaciones y Canales de Alerta',
    'settings.notifications_subtitle': 'Reciba informes y análisis predictivos directamente en su teléfono móvil.',
    'settings.whatsapp_title': 'WhatsApp',
    'settings.whatsapp_toggle': 'Resúmenes automáticos en WhatsApp',
    'settings.whatsapp_toggle_desc': 'Envía balances de ingresos y gastos',
    'settings.ai_toggle': 'Análisis y alertas de IA',
    'settings.ai_toggle_desc': 'Detecta anomalías y consejos predictivos',
    'settings.daily_report_time': 'Hora del Informe Diario',
    'settings.whatsapp_number': 'Número de WhatsApp (DDI + Código de Área + Número)',
    'settings.telegram_title': 'Bot de Telegram',
    'settings.telegram_toggle': 'Enviar resúmenes por Telegram',
    'settings.telegram_toggle_desc': 'Mensajes automáticos a través de un bot dedicado',
    'settings.telegram_bot_token': 'Token del Bot',
    'settings.telegram_chat_id': 'ID de Chat',
    'settings.telegram_guide_title': 'Cómo configurar Telegram:',

    // Goals Card
    'settings.goals_title': 'Metas y Límites Presupuestarios',
    'settings.goals_subtitle': 'Defina presupuestos por categoría o límite de gasto general para un control inteligente.',
    'settings.new_goal': 'Nueva Meta Financiera',
    'settings.add_goal': 'Añadir Meta',
    'settings.no_goals': 'Ninguna meta configurada',
    'settings.no_goals_desc': 'Añada un límite de gasto para recibir alertas de sobrecosto.',
    'settings.general_no_cat': 'General (Sin categoría)',

    // System Actions
    'settings.system_title': 'Acciones Manuales y Ejecución de Tareas',
    'settings.system_subtitle': 'Ejecute sincronización manual y generación de informes de IA a pedido.',
    'settings.sync_banks': 'Sincronizar Bancos',
    'settings.sync_banks_desc': 'Actualizar extractos y saldos',
    'settings.daily_insight': 'Insight Diario',
    'settings.daily_insight_desc': 'Generar análisis de IA de hoy',
    'settings.monthly_report': 'Informe Mensual',
    'settings.monthly_report_desc': 'Generar compilación del mes',

    // Summary Sidebar
    'settings.system_summary': 'Resumen del Sistema',
    'settings.active_currency': 'Moneda Activa',
    'settings.active_goals': 'Metas Activas',
    'settings.banking_connectors': 'Conectores Bancarios',
    'settings.santander_desc': 'Conecte su cuenta jurídica o física de Santander para sincronizar transacciones en tiempo real.',
    'settings.configure_santander': 'Configurar Santander',
    'settings.security_title': 'Privacidad y Seguridad',
    'settings.security_desc': 'Sus tokens de Telegram y datos bancarios se almacenan con cifrado de extremo a extremo y nunca se exponen.',

    // Statuses
    'status.active': 'Activo',
    'status.inactive': 'Desactivado',
    'status.pending': 'Pendiente',
    'status.connected': 'Conectado',
    'status.available': 'Disponible',

    // Common
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.back': 'Volver',
    'common.search': 'Buscar',
    'common.filter': 'Filtrar',
    'common.value': 'Valor',
    'common.date': 'Fecha',
    'common.category': 'Categoría',
    'common.actions': 'Acciones',
  },
};

export interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string, fallback?: string) => string;
  formatDate: (date: string | Date) => string;
  timeAgo: (date: string | null) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (saved === 'es' || saved === 'pt') return saved;
    return 'pt';
  });

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang === 'es' ? 'es' : 'pt-BR';
      await api.updateSettings({ language: lang }).catch(() => {});
    } catch (err) {
      console.warn('[LanguageProvider] Falha ao persistir idioma:', err);
    }
  }, []);

  // Sincroniza o atributo lang do HTML
  useEffect(() => {
    document.documentElement.lang = language === 'es' ? 'es' : 'pt-BR';
  }, [language]);

  // Carrega idioma das configurações remotas se disponível
  useEffect(() => {
    let isMounted = true;
    api
      .getSettings()
      .then(({ settings }) => {
        if (!isMounted) return;
        const remoteLang = settings.language as Language | undefined;
        if (remoteLang && (remoteLang === 'es' || remoteLang === 'pt')) {
          setLanguageState(remoteLang);
          localStorage.setItem(STORAGE_KEY, remoteLang);
          document.documentElement.lang = remoteLang === 'es' ? 'es' : 'pt-BR';
        }
      })
      .catch(() => {
        // Ignora caso offline ou antes de autenticar
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const langDict = TRANSLATIONS[language];
      if (langDict && langDict[key]) {
        return langDict[key];
      }
      // Fallback para pt se não achar no idioma selecionado
      if (TRANSLATIONS.pt[key]) {
        return TRANSLATIONS.pt[key];
      }
      return fallback ?? key;
    },
    [language],
  );

  const formatDate = useCallback(
    (date: string | Date): string => {
      const d = typeof date === 'string' ? new Date(date) : date;
      const locale = language === 'es' ? 'es-ES' : 'pt-BR';
      return d.toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
    },
    [language],
  );

  const timeAgo = useCallback(
    (date: string | null): string => {
      if (!date) return language === 'es' ? 'nunca' : 'nunca';
      const diff = Date.now() - new Date(date).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return language === 'es' ? 'ahora' : 'agora';
      if (mins < 60) {
        return language === 'es' ? `hace ${mins} min` : `há ${mins}min`;
      }
      const hours = Math.floor(mins / 60);
      if (hours < 24) {
        return language === 'es' ? `hace ${hours}h` : `há ${hours}h`;
      }
      const days = Math.floor(hours / 24);
      if (language === 'es') {
        return `hace ${days} día${days > 1 ? 's' : ''}`;
      }
      return `há ${days} dia${days > 1 ? 's' : ''}`;
    },
    [language],
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, formatDate, timeAgo }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}

export function useTranslation() {
  return useLanguage().t;
}
