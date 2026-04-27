import { Info } from 'lucide-react';
import { getDefinition, type DefinitionKey } from '../content/definitions';
import { classNames } from '../engines/engineUtils';

interface TermProps {
  id: DefinitionKey;
  label?: string;
  compact?: boolean;
  className?: string;
}

export function Term({ id, label, compact = false, className }: TermProps) {
  const definition = getDefinition(id);
  const visibleLabel = label || definition.title;

  return (
    <details className={classNames('group relative inline-block align-middle', className)}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md px-1 py-0.5 font-black text-emerald-800 hover:bg-emerald-50">
        <span>{visibleLabel}</span>
        <Info className="h-3.5 w-3.5 text-emerald-600" aria-label={`${visibleLabel}说明`} />
      </summary>
      <div
        className={classNames(
          'absolute left-0 z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white p-3 text-left shadow-xl',
          compact ? 'text-xs leading-5' : 'text-sm leading-6'
        )}
      >
        <div className="mb-1 font-black text-slate-950">{definition.title}</div>
        <div className="font-medium text-slate-700">{definition.body}</div>
      </div>
    </details>
  );
}
