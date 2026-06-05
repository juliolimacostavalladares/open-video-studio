'use client';

import React, { useState } from 'react';
import { Film } from 'lucide-react';
import { ScriptForm } from '@/components/ScriptForm';
import { ScriptTimeline } from '@/components/ScriptTimeline';
import { GenerateScriptInput, GenerateScriptOutput } from '@repo/types';
import { env } from '@/env';

export default function Home() {
  const [script, setScript] = useState<GenerateScriptOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateScript = async (input: GenerateScriptInput) => {
    setIsLoading(true);
    setError(null);
    setScript(null);

    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_API_URL}/api/script/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        },
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.message ||
            `Erro do servidor (${response.status}). Verifique as configurações de IA.`,
        );
      }

      const data: GenerateScriptOutput = await response.json();
      setScript(data);
    } catch (err) {
      console.error('Failed to generate script:', err);
      setError(
        (err as Error).message ||
          'Ocorreu um erro inesperado ao se conectar com o servidor.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 font-[family-name:var(--font-geist-sans)]">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 p-2 text-white shadow-md shadow-indigo-500/10">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-zinc-100 md:text-base">
                Open Video Studio
              </span>
              <span className="ml-2 hidden border-l border-zinc-800 pl-2 text-[10px] text-zinc-500 md:inline">
                v1.0.0
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold text-zinc-400">
              Ciclo 2: AI & TTS
            </span>
          </div>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="mx-auto flex w-full max-w-7xl flex-grow flex-col gap-8 px-6 py-8">
        {/* Intro Hero Section */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-100 md:text-3xl">
            Produza Vídeos com{' '}
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              Inteligência Artificial
            </span>
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-500">
            Escreva o roteiro estruturado cena a cena, defina narrações em
            português e referências visuais com um clique para iniciar a criação
            do seu conteúdo.
          </p>
        </div>

        {/* Workspace Layout */}
        <div className="flex flex-col items-start gap-8 lg:flex-row">
          {/* Left Sidebar Form */}
          <div className="sticky top-24 w-full shrink-0 lg:w-[380px]">
            <ScriptForm onSubmit={handleGenerateScript} isLoading={isLoading} />
          </div>

          {/* Right Editor Timeline */}
          <div className="flex min-h-[500px] w-full flex-1 rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6">
            <ScriptTimeline
              script={script}
              isLoading={isLoading}
              error={error}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
