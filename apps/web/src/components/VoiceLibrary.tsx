"use client";

import { useCallback, useEffect, useState } from "react";

import { readApiError } from "../lib/api";
import { MicIcon, PlusIcon } from "./icons";

interface VoiceProfile {
  id: string;
  name: string;
  provider: string;
  sampleDurationSeconds: number;
  status: string;
  createdAt: string;
}

export function VoiceLibrary({ apiBaseUrl }: { apiBaseUrl: string }) {
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [name, setName] = useState("");
  const [sample, setSample] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    const response = await fetch(`${apiBaseUrl}/voice-profiles`, { cache: "no-store" });
    if (!response.ok) throw new Error(await readApiError(response));
    setProfiles((await response.json()) as VoiceProfile[]);
  }, [apiBaseUrl]);

  useEffect(() => {
    loadProfiles()
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Erro ao carregar vozes."))
      .finally(() => setLoading(false));
  }, [loadProfiles]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!sample) {
      setError("Selecione uma amostra WAV.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const data = new FormData();
    data.append("name", name);
    data.append("sample", sample);

    try {
      const response = await fetch(`${apiBaseUrl}/voice-profiles`, { method: "POST", body: data });
      if (!response.ok) throw new Error(await readApiError(response));
      setName("");
      setSample(null);
      await loadProfiles();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao criar perfil.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="voice-layout">
      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Biblioteca</span>
            <h2>Vozes disponíveis</h2>
          </div>
          <span className="count-pill">{profiles.length} perfis</span>
        </div>
        {loading ? <div className="skeleton-list"><span /><span /><span /></div> : null}
        {!loading && profiles.length === 0 ? (
          <div className="empty-state compact">
            <span className="empty-icon"><MicIcon /></span>
            <h3>Nenhuma voz cadastrada</h3>
            <p>Envie uma amostra limpa para criar seu primeiro perfil.</p>
          </div>
        ) : (
          <div className="voice-grid">
            {profiles.map((profile, index) => (
              <article className="voice-card" key={profile.id}>
                <span className={`voice-avatar voice-${index % 4}`}><MicIcon /></span>
                <div>
                  <h3>{profile.name}</h3>
                  <p>{profile.provider}</p>
                </div>
                <div className="voice-meta">
                  <span>{profile.sampleDurationSeconds.toFixed(1)}s de amostra</span>
                  <span className="status status-approved">{profile.status}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <aside className="form-card voice-create-card">
        <span className="eyebrow">Nova voz</span>
        <h2>Adicione uma identidade vocal</h2>
        <p>Use um áudio WAV limpo, sem música ou ruído de fundo.</p>
        <form onSubmit={submit}>
          <label className="field">
            <span>Nome do perfil</span>
            <input onChange={(event) => setName(event.target.value)} placeholder="Ex.: Narrador institucional" required value={name} />
          </label>
          <label className="upload-field">
            <MicIcon />
            <strong>{sample?.name ?? "Selecionar amostra WAV"}</strong>
            <small>Arquivo de voz com duração curta</small>
            <input accept=".wav,audio/wav" onChange={(event) => setSample(event.target.files?.[0] ?? null)} type="file" />
          </label>
          {error ? <div className="notice notice-error">{error}</div> : null}
          <button className="button button-primary" disabled={submitting} type="submit">
            <PlusIcon />
            {submitting ? "Criando..." : "Criar perfil de voz"}
          </button>
        </form>
      </aside>
    </div>
  );
}
