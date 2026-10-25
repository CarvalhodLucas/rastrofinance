import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import {
  Activity,
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  getRememberPreference,
  setRememberPreference,
  getRememberedUsername,
  setRememberedUsername,
} from '@/services/api';

export function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState(() => getRememberedUsername());
  const [rememberMe, setRememberMe] = useState(() => getRememberPreference());
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { login, register } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      setErrorMsg('Informe o seu nickname.');
      return;
    }

    if (cleanUsername.length < 3) {
      setErrorMsg('O nickname deve conter pelo menos 3 caracteres.');
      return;
    }

    if (!password) {
      setErrorMsg('Informe a sua senha.');
      return;
    }

    if (isRegister) {
      if (password.length < 6) {
        setErrorMsg('A senha deve conter no mínimo 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('As senhas não coincidem. Digite novamente.');
        return;
      }
    }

    setLoading(true);
    try {
      if (isRegister) {
        await register(cleanUsername, password, name.trim() || undefined, rememberMe);
        setRememberPreference(rememberMe);
        setRememberedUsername(cleanUsername, rememberMe);
        notify('Conta criada com sucesso! Bem-vindo ao Rastro Finance.', 'success');
      } else {
        await login(cleanUsername, password, rememberMe);
        setRememberPreference(rememberMe);
        setRememberedUsername(cleanUsername, rememberMe);
        notify(`Olá novamente, @${cleanUsername}!`, 'success');
      }
      navigate(from, { replace: true });
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocorreu um erro. Verifique seus dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-bg-primary p-4 sm:p-6 lg:p-8 font-sans">
      {/* Background Decorative Ambient Blobs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-accent-gold/10 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-accent-blue/10 blur-[130px]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-accent-gold/5 blur-[160px]" />

      {/* Grid Pattern overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#1f29370a_1px,transparent_1px),linear-gradient(to_bottom,#1f29370a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      <div className="relative w-full max-w-md z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="group relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-bg-elevated to-bg-card border border-accent-gold/30 shadow-xl shadow-accent-gold/10 mb-4 transition-transform hover:scale-105 duration-300">
            <div className="absolute inset-0 rounded-2xl bg-accent-gold/15 blur-md group-hover:blur-lg transition-all" />
            <Activity className="relative h-7 w-7 text-accent-gold" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
            Rastro<span className="text-accent-gold"> Finance</span>
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-text-secondary max-w-xs">
            Controle financeiro pessoal, inteligência artificial e gestão patrimonial
          </p>
        </div>

        {/* Card Principal */}
        <div className="relative rounded-2xl border border-border/80 bg-bg-card/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-black/60">
          {/* Subtle Top Gold Highlight Bar */}
          <div className="absolute inset-x-8 top-0 h-[2px] bg-gradient-to-r from-transparent via-accent-gold/50 to-transparent" />

          {/* Tab Selector: Entrar vs Cadastrar */}
          <div className="flex rounded-xl bg-bg-primary/90 p-1 border border-border/60 mb-6">
            <button
              type="button"
              onClick={() => {
                setIsRegister(false);
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                !isRegister
                  ? 'bg-bg-elevated text-text-primary shadow-sm border border-border/80'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegister(true);
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                isRegister
                  ? 'bg-bg-elevated text-text-primary shadow-sm border border-border/80'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Criar Conta
            </button>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-red-500/10 border border-red-500/25 p-3 text-xs text-red-400 animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMsg}</div>
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo: Nickname */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
                Nickname / Usuário
              </label>
              <div className="relative rounded-xl border border-border bg-bg-elevated/70 focus-within:border-accent-gold/70 focus-within:ring-2 focus-within:ring-accent-gold/20 transition-all">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="ex: lucas"
                  className="w-full bg-transparent pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                />
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[11px] font-mono text-text-muted">
                  @user
                </div>
              </div>
              {isRegister && (
                <p className="mt-1 text-[11px] text-text-muted">
                  Apenas letras minúsculas, números e sublinhados (mínimo 3 letras).
                </p>
              )}
            </div>

            {/* Campo: Nome Completo (Apenas no cadastro) */}
            {isRegister && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
                  Como quer ser chamado? <span className="text-[10px] text-text-muted">(opcional)</span>
                </label>
                <div className="relative rounded-xl border border-border bg-bg-elevated/70 focus-within:border-accent-gold/70 focus-within:ring-2 focus-within:ring-accent-gold/20 transition-all">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                    <Sparkles className="h-4 w-4 text-accent-gold/70" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ex: Lucas Carvalho"
                    className="w-full bg-transparent pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Campo: Senha */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Senha
                </label>
                {!isRegister && (
                  <span className="text-[11px] text-text-muted hover:text-accent-gold cursor-default transition-colors">
                    Proteção local
                  </span>
                )}
              </div>
              <div className="relative rounded-xl border border-border bg-bg-elevated/70 focus-within:border-accent-gold/70 focus-within:ring-2 focus-within:ring-accent-gold/20 transition-all">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRegister ? 'Mínimo 6 caracteres' : '••••••••'}
                  className="w-full bg-transparent pl-10 pr-10 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-text-muted hover:text-text-secondary cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Campo: Confirmação de Senha (Apenas no cadastro) */}
            {isRegister && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
                  Confirme sua Senha
                </label>
                <div className="relative rounded-xl border border-border bg-bg-elevated/70 focus-within:border-accent-gold/70 focus-within:ring-2 focus-within:ring-accent-gold/20 transition-all">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    className="w-full bg-transparent pl-10 pr-10 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none font-mono"
                  />
                  {confirmPassword && confirmPassword === password && (
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-accent-green">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Opção: Permanecer conectado */}
            <div className="flex items-center justify-between pt-1 pb-0.5">
              <label
                htmlFor="remember-me"
                className="group flex items-center gap-2.5 cursor-pointer select-none"
              >
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    id="remember-me"
                    checked={rememberMe}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setRememberMe(val);
                      setRememberPreference(val);
                    }}
                    className="sr-only"
                  />
                  <div
                    className={`h-4 w-4 rounded border transition-all duration-200 flex items-center justify-center ${
                      rememberMe
                        ? 'bg-accent-gold border-accent-gold text-gray-950 shadow-sm shadow-accent-gold/25'
                        : 'bg-bg-elevated/80 border-border group-hover:border-accent-gold/50'
                    }`}
                  >
                    {rememberMe && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-text-primary group-hover:text-accent-gold transition-colors">
                    Permanecer conectado
                  </span>
                  <span className="text-[10px] text-text-muted">
                    {rememberMe
                      ? 'Sessão persistente por 6 meses neste navegador'
                      : 'Encerrar sessão ao fechar o navegador'}
                  </span>
                </div>
              </label>
            </div>

            {/* Botão de Ação */}
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-accent-gold px-4 py-2.5 text-sm font-bold text-gray-950 transition-all duration-200 hover:bg-amber-400 hover:shadow-lg hover:shadow-accent-gold/25 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-gray-950" />
                  <span>{isRegister ? 'Criando conta...' : 'Autenticando...'}</span>
                </>
              ) : (
                <>
                  <span>{isRegister ? 'Finalizar Cadastro' : 'Acessar Sistema'}</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          {/* Footer Card Features */}
          <div className="mt-6 pt-5 border-t border-border/60 flex items-center justify-between text-[11px] text-text-muted">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-accent-green" />
              <span>Criptografia scrypt + JWT</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-accent-gold" />
              <span>{rememberMe ? 'Sessão persistente (180 dias)' : 'Sessão temporária'}</span>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <p className="mt-6 text-center text-xs text-text-muted">
          Rastro Finance &bull; Seus dados e credenciais ficam salvos no seu banco de dados privado.
        </p>
      </div>
    </div>
  );
}
