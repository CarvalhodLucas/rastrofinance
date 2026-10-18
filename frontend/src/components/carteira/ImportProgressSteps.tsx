import React from 'react';
import { Check } from 'lucide-react';

interface ImportProgressStepsProps {
  currentStep: 'upload' | 'processing' | 'preview' | 'completed';
}

export function ImportProgressSteps({ currentStep }: ImportProgressStepsProps) {
  const steps = [
    { key: 'upload', label: 'Upload' },
    { key: 'processing', label: 'Processando com IA' },
    { key: 'preview', label: 'Revisar' },
    { key: 'completed', label: 'Concluído' },
  ];

  const getStepIndex = (step: string) => steps.findIndex((s) => s.key === step);
  const currentIndex = getStepIndex(currentStep);

  return (
    <div className="flex items-center justify-between w-full max-w-2xl mx-auto my-8 px-4">
      {steps.map((step, idx) => {
        const isCompleted = idx < currentIndex;
        const isActive = idx === currentIndex;

        return (
          <React.Fragment key={step.key}>
            {/* Step Circle */}
            <div className="flex flex-col items-center relative z-10">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                  isCompleted
                    ? 'border-accent-green bg-accent-green text-bg-primary'
                    : isActive
                    ? 'border-accent-gold bg-accent-gold text-bg-primary font-bold shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                    : 'border-border bg-bg-elevated text-text-secondary'
                }`}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5 stroke-[3px]" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <span
                className={`mt-2 text-xs font-semibold text-center whitespace-nowrap transition-colors duration-200 ${
                  isActive ? 'text-accent-gold' : isCompleted ? 'text-text-primary' : 'text-text-secondary'
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Line connector */}
            {idx < steps.length - 1 && (
              <div className="h-0.5 flex-1 min-w-[20px] bg-bg-elevated -translate-y-4 relative mx-2">
                <div
                  className={`absolute inset-0 transition-all duration-500 ${
                    idx < currentIndex ? 'bg-accent-green w-full' : 'bg-border w-0'
                  }`}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
