import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { Upload, FileSpreadsheet, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/services/api';

interface UploadDropzoneProps {
  onUploadStart: () => void;
  onUploadSuccess: (data: { batchId: string; parsed: any[]; needsReview: any[]; totalRows: number }) => void;
  onUploadError: (errMessage: string) => void;
}

export function UploadDropzone({ onUploadStart, onUploadSuccess, onUploadError }: UploadDropzoneProps) {
  const { notify } = useToast();
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileName = selectedFile.name.toLowerCase();
    const isValidExtension = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValidExtension) {
      notify('Formato não suportado. Envie um arquivo .xlsx, .xls ou .csv', 'error');
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > maxSize) {
      notify('Arquivo muito grande. O extrato B3 geralmente não ultrapassa alguns MB.', 'error');
      return;
    }

    setFile(selectedFile);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const triggerInputClick = () => {
    inputRef.current?.click();
  };

  const removeFile = () => {
    setFile(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSubmit = async () => {
    if (!file) return;

    onUploadStart();
    try {
      const response = await api.uploadB3Extract(file);
      onUploadSuccess(response);
    } catch (err: any) {
      const errMsg = err.message || 'Falha ao processar arquivo com a API DeepSeek.';
      onUploadError(errMsg);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={!file ? triggerInputClick : undefined}
        className={`relative flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer ${
          dragActive
            ? 'border-accent-gold bg-accent-gold/5 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
            : file
            ? 'border-[#2D3748] bg-[#111827] cursor-default'
            : 'border-[#2D3748] bg-[#111827] hover:border-accent-gold/50 hover:bg-bg-elevated/20'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleChange}
          className="hidden"
        />

        {!file ? (
          <div className="flex flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-gold/10 text-accent-gold mb-4">
              <Upload className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-text-primary mb-1">
              Arraste o extrato aqui ou clique para selecionar
            </p>
            <p className="text-xs text-text-secondary">
              Suporta apenas planilhas nos formatos .xlsx, .xls ou .csv (Máx. 10MB)
            </p>
          </div>
        ) : (
          <div className="w-full flex items-center justify-between p-4 rounded-lg bg-bg-elevated border border-border">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-gold/10 text-accent-gold">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-text-primary truncate max-w-[280px]">
                  {file.name}
                </p>
                <p className="text-xs text-text-secondary">
                  {formatFileSize(file.size)}
                </p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeFile();
              }}
              className="p-1 rounded-full hover:bg-bg-primary text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {file && (
        <div className="mt-6 flex justify-center">
          <Button
            onClick={handleSubmit}
            size="lg"
            className="w-full sm:w-auto px-12 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
          >
            Processar com IA
          </Button>
        </div>
      )}
    </div>
  );
}
