import { useState } from 'react';
import { X, Plus, Trash2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useCategories } from '@/hooks/useCategories';

interface Props {
  open: boolean;
  onClose: () => void;
}

const EMOJI_PRESETS = ['🛒', '🍕', '🚗', '🏠', '🩺', '🎬', '👕', '💻', '📚', '✈️', '🐶', '🎁', '⚡', '🍷', '⚽', '🎮', '🛠️', '🧾', '💎', '🔑'];

export function ManageCategoriesModal({ open, onClose }: Props) {
  const { categories, addCategory, deleteCategory } = useCategories();
  const { notify } = useToast();

  const [newCatName, setNewCatName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🏷️');

  if (!open) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;

    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      notify(`A categoria "${trimmed}" já existe!`, 'info');
      return;
    }

    addCategory(trimmed, selectedEmoji);
    notify(`Categoria "${trimmed}" criada com sucesso!`, 'success');
    setNewCatName('');
  };

  const handleDelete = (name: string) => {
    deleteCategory(name);
    notify(`Categoria "${name}" removida!`, 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-bg-card shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-bg-elevated/30">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-accent-gold" />
            <h3 className="font-bold text-base text-text-primary">Gerenciar Categorias</h3>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer text-text-muted hover:text-text-primary p-1 rounded-lg hover:bg-bg-elevated transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Formulário de Criação */}
          <form onSubmit={handleAdd} className="space-y-3 bg-accent-gold/5 p-4 rounded-xl border border-accent-gold/20">
            <label className="block text-xs font-bold uppercase tracking-wider text-accent-gold">
              + Criar Nova Categoria
            </label>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Nome da categoria (ex: Petshop, Presentes)..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full h-10 rounded-lg border border-border bg-bg-card px-3 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent-gold"
                />
              </div>

              <Button
                type="submit"
                disabled={!newCatName.trim()}
                className="h-10 px-4 font-bold text-xs gap-1 shrink-0"
              >
                <Plus className="h-4 w-4" />
                Criar
              </Button>
            </div>

            {/* Seletor de Ícones Emoji */}
            <div>
              <span className="block text-[11px] font-medium text-text-secondary mb-1.5">
                Escolha um ícone para a nova categoria:
              </span>
              <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto p-1 bg-bg-card rounded-lg border border-border">
                {EMOJI_PRESETS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedEmoji(emoji)}
                    className={`h-8 w-8 text-base rounded-md flex items-center justify-center transition-transform cursor-pointer ${
                      selectedEmoji === emoji
                        ? 'bg-accent-gold/20 border border-accent-gold scale-110'
                        : 'hover:bg-bg-elevated hover:scale-105'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </form>

          {/* Lista de Categorias Ativas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                Categorias Existentes ({categories.length})
              </span>
              <span className="text-[10px] text-text-muted">
                Clique no 🗑️ para remover
              </span>
            </div>

            <div className="divide-y divide-border/50 border border-border rounded-xl bg-bg-card overflow-hidden">
              {categories.map((cat) => (
                <div
                  key={cat.name}
                  className="flex items-center justify-between px-3 py-2.5 hover:bg-bg-elevated/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-elevated text-sm border border-border">
                      {cat.icon}
                    </span>
                    <span className="text-xs font-semibold text-text-primary truncate">
                      {cat.name}
                    </span>
                    {cat.isCustom && (
                      <span className="rounded bg-accent-gold/15 px-1.5 py-0.5 text-[9px] font-bold text-accent-gold border border-accent-gold/30">
                        Personalizada
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(cat.name)}
                    title={`Excluir categoria ${cat.name}`}
                    className="p-1.5 text-text-muted hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 bg-bg-elevated/20 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs font-semibold">
            Concluído
          </Button>
        </div>
      </div>
    </div>
  );
}
