import React, { useState } from 'react';
import {
  Sparkles,
  Loader2,
  BookOpen,
  Film,
  Flame,
  Briefcase,
} from 'lucide-react';
import { GenerateScriptInput } from '@repo/types';

interface ScriptFormProps {
  onSubmit: (input: GenerateScriptInput) => void;
  isLoading: boolean;
}

const TONES = [
  {
    value: 'educational',
    label: 'Educacional',
    icon: BookOpen,
    desc: 'Informativo e didático',
  },
  {
    value: 'dramatic',
    label: 'Dramático',
    icon: Film,
    desc: 'Emocional e intenso',
  },
  {
    value: 'energetic',
    label: 'Enérgico',
    icon: Flame,
    desc: 'Rápido e entusiasmado',
  },
  {
    value: 'professional',
    label: 'Profissional',
    icon: Briefcase,
    desc: 'Formal e corporativo',
  },
];

export const ScriptForm: React.FC<ScriptFormProps> = ({
  onSubmit,
  isLoading,
}) => {
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('educational');
  const [sceneCount, setSceneCount] = useState(5);
  const [language, setLanguage] = useState('Portuguese');
  const [validationError, setValidationError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!topic.trim()) {
      setValidationError('O tema do roteiro é obrigatório.');
      return;
    }

    if (topic.trim().length < 3) {
      setValidationError('O tema deve ter pelo menos 3 caracteres.');
      return;
    }

    onSubmit({
      topic: topic.trim(),
      tone,
      sceneCount,
      language,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl backdrop-blur-md"
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-4">
        <Sparkles className="h-5 w-5 text-indigo-400" />
        <h2 className="text-lg font-semibold text-zinc-100">
          Criador de Roteiro
        </h2>
      </div>

      {/* Topic Input */}
      <div className="flex flex-col gap-2">
        <label htmlFor="topic" className="text-sm font-medium text-zinc-300">
          Sobre o que será o vídeo?
        </label>
        <textarea
          id="topic"
          rows={3}
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value);
            if (validationError) setValidationError('');
          }}
          placeholder="Ex: A evolução histórica da inteligência artificial e seu impacto no mercado de trabalho..."
          disabled={isLoading}
          className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
        />
        {validationError && (
          <span className="mt-1 text-xs font-medium text-red-400" role="alert">
            {validationError}
          </span>
        )}
      </div>

      {/* Tone Cards Selection */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-zinc-300">
          Tom do roteiro
        </span>
        <div className="grid grid-cols-2 gap-3">
          {TONES.map((t) => {
            const Icon = t.icon;
            const isSelected = tone === t.value;
            return (
              <button
                key={t.value}
                type="button"
                disabled={isLoading}
                onClick={() => setTone(t.value)}
                className={`group relative flex flex-col items-start overflow-hidden rounded-xl border p-3.5 text-left transition-all disabled:opacity-50 ${
                  isSelected
                    ? 'border-indigo-500/80 bg-indigo-600/10 ring-1 ring-indigo-500/30'
                    : 'border-zinc-800/80 bg-zinc-950/50 hover:border-zinc-700 hover:bg-zinc-800/30'
                }`}
              >
                <div
                  className={`mb-2.5 rounded-lg p-2 transition-all ${
                    isSelected
                      ? 'bg-indigo-500 text-white'
                      : 'bg-zinc-900 text-zinc-400 group-hover:text-zinc-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold text-zinc-200">
                  {t.label}
                </span>
                <span className="mt-0.5 text-[10px] leading-tight text-zinc-500">
                  {t.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scene Count Slider */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm font-medium">
          <label htmlFor="sceneCount" className="text-zinc-300">
            Quantidade de cenas
          </label>
          <span className="rounded-full border border-indigo-500/10 bg-indigo-500/15 px-2 py-0.5 text-xs font-semibold text-indigo-400">
            {sceneCount} {sceneCount === 1 ? 'cena' : 'cenas'}
          </span>
        </div>
        <input
          id="sceneCount"
          type="range"
          min={1}
          max={15}
          value={sceneCount}
          disabled={isLoading}
          onChange={(e) => setSceneCount(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-950 accent-indigo-500 disabled:opacity-50"
        />
        <div className="flex justify-between px-0.5 text-[10px] text-zinc-500">
          <span>1</span>
          <span>5</span>
          <span>10</span>
          <span>15</span>
        </div>
      </div>

      {/* Language Selector */}
      <div className="flex flex-col gap-2">
        <label htmlFor="language" className="text-sm font-medium text-zinc-300">
          Idioma da narração
        </label>
        <select
          id="language"
          value={language}
          disabled={isLoading}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full cursor-pointer rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-200 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
        >
          <option value="Portuguese">Português (Brasil)</option>
          <option value="English">Inglês (Estados Unidos)</option>
          <option value="Spanish">Espanhol (América Latina)</option>
        </select>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="flex w-full transform cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 font-medium text-white shadow-lg transition-all hover:from-indigo-500 hover:to-violet-500 hover:shadow-indigo-500/10 active:scale-[0.98] disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Escrevendo Roteiro...</span>
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            <span>Gerar Roteiro</span>
          </>
        )}
      </button>
    </form>
  );
};
