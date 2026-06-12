"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { readApiError } from "../lib/api";
import { SparkIcon } from "./icons";

const tones = ["Educativo", "Inspirador", "Direto", "Storytelling", "Descontraído"];

export function CreateProjectForm({ apiBaseUrl }: { apiBaseUrl: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("");
  const [tone, setTone] = useState("Educativo");
  const [targetDuration, setTargetDuration] = useState(3);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBaseUrl}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          theme: theme.trim(),
          tone,
          targetDuration,
          description: description.trim() || undefined,
        }),
      });

      if (!response.ok && response.status !== 207) {
        throw new Error(await readApiError(response));
      }

      const project = (await response.json()) as { id: string; aiError?: string };
      router.push(`/editor/edit/${project.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar o projeto.");
      setIsSubmitting(false);
    }
  }

  return (
    <form className="creation-layout" onSubmit={submit}>
      <section className="form-card">
        <div className="form-section-heading">
          <span className="step-number">1</span>
          <div>
            <h2>Defina a ideia</h2>
            <p>Esses dados orientam a geração do roteiro inicial.</p>
          </div>
        </div>

        <div className="form-grid">
          <label className="field field-full">
            <span>Nome do projeto</span>
            <input
              autoFocus
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: 5 hábitos para trabalhar melhor"
              required
              value={title}
            />
          </label>
          <label className="field field-full">
            <span>Tema do vídeo</span>
            <textarea
              onChange={(event) => setTheme(event.target.value)}
              placeholder="Explique o assunto, público e mensagem principal..."
              required
              rows={4}
              value={theme}
            />
            <small>Quanto mais contexto, melhor será o roteiro.</small>
          </label>
          <label className="field">
            <span>Duração alvo</span>
            <select
              onChange={(event) => setTargetDuration(Number(event.target.value))}
              value={targetDuration}
            >
              <option value={1}>1 minuto</option>
              <option value={3}>3 minutos</option>
              <option value={5}>5 minutos</option>
              <option value={8}>8 minutos</option>
              <option value={10}>10 minutos</option>
            </select>
          </label>
          <label className="field">
            <span>Tom principal</span>
            <select onChange={(event) => setTone(event.target.value)} value={tone}>
              {tones.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="field field-full">
            <span>Observações opcionais</span>
            <textarea
              onChange={(event) => setDescription(event.target.value)}
              placeholder="CTA, referências, termos a evitar ou detalhes de marca."
              rows={3}
              value={description}
            />
          </label>
        </div>

        {error ? <div className="notice notice-error">{error}</div> : null}

        <div className="form-actions">
          <button className="button button-primary button-large" disabled={isSubmitting} type="submit">
            <SparkIcon />
            {isSubmitting ? "Criando roteiro..." : "Gerar projeto com IA"}
          </button>
          <span>A criação pode levar alguns segundos.</span>
        </div>
      </section>

      <aside className="creation-preview">
        <span className="eyebrow">O que será criado</span>
        <h2>Um fluxo completo, pronto para você dirigir.</h2>
        <div className="preview-steps">
          {[
            ["01", "Roteiro estruturado", "Cenas organizadas para edição."],
            ["02", "Plano de produção", "Voz, assets e áudio por cena."],
            ["03", "Render e revisão", "Vídeo final com aprovação."],
            ["04", "Distribuição", "Publicação ou agendamento no YouTube."],
          ].map(([number, label, copy]) => (
            <div className="preview-step" key={number}>
              <span>{number}</span>
              <div><strong>{label}</strong><small>{copy}</small></div>
            </div>
          ))}
        </div>
      </aside>
    </form>
  );
}
