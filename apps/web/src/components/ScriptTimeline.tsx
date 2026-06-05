import React from 'react';
import { FileVideo, AlertCircle, Search } from 'lucide-react';
import { GenerateScriptOutput } from '@repo/types';

interface ScriptTimelineProps {
  script: GenerateScriptOutput | null;
  isLoading: boolean;
  error: string | null;
}

export const ScriptTimeline: React.FC<ScriptTimelineProps> = ({
  script,
  isLoading,
  error,
}) => {
  // 1. Loading state (Pulse Skeletons)
  if (isLoading) {
    return (
      <div className="flex w-full animate-pulse flex-col gap-6">
        {/* Title skeleton */}
        <div className="mb-2 h-8 w-3/4 rounded-xl bg-zinc-800"></div>
        {/* Cards skeletons */}
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5"
          >
            <div className="flex items-center justify-between">
              <div className="h-5 w-20 rounded-full bg-zinc-800"></div>
              <div className="h-5 w-32 rounded-full bg-zinc-800"></div>
            </div>
            <div className="mt-1 h-4 w-full rounded bg-zinc-800"></div>
            <div className="h-4 w-5/6 rounded bg-zinc-800"></div>
          </div>
        ))}
      </div>
    );
  }

  // 2. Error state
  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center justify-center rounded-2xl border border-red-900/20 bg-red-950/10 p-8 text-center">
        <div className="mb-4 rounded-full border border-red-500/20 bg-red-500/10 p-3">
          <AlertCircle className="h-6 w-6 text-red-400" />
        </div>
        <h3 className="text-base font-semibold text-red-200">
          Falha ao gerar roteiro
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{error}</p>
      </div>
    );
  }

  // 3. Empty state
  if (!script) {
    return (
      <div className="flex min-h-[400px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 p-12 text-center">
        <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-zinc-400">
          <FileVideo className="h-8 w-8" />
        </div>
        <h3 className="text-base font-semibold text-zinc-200">Roteiro vazio</h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
          Preencha as configurações ao lado e clique em{' '}
          <strong className="font-semibold text-zinc-400">Gerar Roteiro</strong>{' '}
          para estruturar seu vídeo automaticamente via IA.
        </p>
      </div>
    );
  }

  // 4. Success state (Script display)
  return (
    <div className="flex w-full flex-col gap-6">
      {/* Title */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-5 shadow-sm">
        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
          Roteiro Gerado
        </span>
        <h1 className="mt-1 text-xl font-bold text-zinc-100">{script.title}</h1>
      </div>

      {/* Scenes List */}
      <div className="flex flex-col gap-4">
        {script.scenes.map((scene) => (
          <div
            key={scene.sceneIndex}
            className="group rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-zinc-700/80 hover:bg-zinc-900/80"
          >
            {/* Scene Header */}
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-full border border-indigo-500/10 bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-400">
                Cena {scene.sceneIndex + 1}
              </span>
            </div>

            {/* Narration Text */}
            <p className="mb-4 text-sm leading-relaxed text-zinc-200">
              {scene.text}
            </p>

            {/* Keyword tag */}
            <div className="flex items-center gap-2 border-t border-zinc-800/60 pt-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                <Search className="h-3.5 w-3.5 text-zinc-500" />
                <span>Mídia Sugerida:</span>
              </div>
              <span className="rounded-full border border-zinc-700/50 bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-300">
                {scene.keyword}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
