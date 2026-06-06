"use client";

import { useEffect, useState } from "react";

interface VoiceProfile {
  id: string;
  name: string;
  provider: string;
  sampleDurationSeconds: number;
  status: string;
}

interface VoiceProfileManagerProps {
  apiBaseUrl: string;
}

async function parseError(response: Response) {
  const body = (await response.json().catch(() => ({}))) as { message?: string };
  return body.message ?? `HTTP ${response.status}`;
}

export function VoiceProfileManager({ apiBaseUrl }: VoiceProfileManagerProps) {
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [name, setName] = useState("");
  const [sample, setSample] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfiles() {
      try {
        const response = await fetch(`${apiBaseUrl}/voice-profiles`, {
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error(await parseError(response));
        }

        const body = (await response.json()) as VoiceProfile[];
        if (!cancelled) {
          setProfiles(body);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Erro ao carregar vozes");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadProfiles();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("name", name);

      if (sample) {
        formData.append("sample", sample);
      }

      const response = await fetch(`${apiBaseUrl}/voice-profiles`, {
        body: formData,
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      const created = (await response.json()) as VoiceProfile;
      setProfiles((current) => [created, ...current]);
      setName("");
      setSample(null);
      setSuccessMessage("Perfil de voz criado com sucesso");

      const fileInput = document.getElementById("voice-sample-input") as HTMLInputElement | null;
      if (fileInput) {
        fileInput.value = "";
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao criar perfil de voz");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      aria-label="Biblioteca de vozes"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16,
        padding: 24,
        backdropFilter: "blur(12px)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
        <div>
          <h2 style={{ color: "#f8fafc", margin: "0 0 4px", fontSize: 20 }}>Biblioteca de vozes</h2>
          <p style={{ color: "#94a3b8", margin: 0, fontSize: 14 }}>
            Envie uma amostra WAV com pelo menos 3 segundos para criar um perfil local.
          </p>
        </div>
        <span
          style={{
            color: "#cbd5e1",
            fontSize: 13,
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(15, 23, 42, 0.4)"
          }}
        >
          {profiles.length} perfil(is)
        </span>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, marginTop: 20 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ color: "#e2e8f0", fontSize: 13 }}>Nome do perfil</span>
          <input
            id="voice-profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Narrador principal"
            style={{
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.3)",
              background: "rgba(15,23,42,0.5)",
              color: "#f8fafc",
              padding: "12px 14px"
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ color: "#e2e8f0", fontSize: 13 }}>Amostra de voz (.wav)</span>
          <input
            id="voice-sample-input"
            type="file"
            accept=".wav,audio/wav"
            onChange={(event) => setSample(event.target.files?.[0] ?? null)}
            style={{ color: "#cbd5e1" }}
          />
        </label>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button
            id="voice-profile-submit"
            type="submit"
            disabled={isSubmitting}
            style={{
              border: 0,
              borderRadius: 10,
              padding: "12px 18px",
              background: isSubmitting ? "#334155" : "#f97316",
              color: "#fff7ed",
              cursor: isSubmitting ? "wait" : "pointer",
              fontWeight: 600
            }}
          >
            {isSubmitting ? "Enviando..." : "Criar perfil"}
          </button>

          {successMessage ? <span style={{ color: "#86efac", fontSize: 13 }}>{successMessage}</span> : null}
          {errorMessage ? (
            <span id="voice-profile-error" style={{ color: "#fda4af", fontSize: 13 }}>
              {errorMessage}
            </span>
          ) : null}
        </div>
      </form>

      <div style={{ marginTop: 24 }}>
        {isLoading ? (
          <p style={{ color: "#94a3b8", margin: 0 }}>Carregando perfis de voz...</p>
        ) : profiles.length === 0 ? (
          <p style={{ color: "#94a3b8", margin: 0 }}>Nenhum perfil de voz cadastrado ainda.</p>
        ) : (
          <ul id="voice-profile-list" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
            {profiles.map((profile) => (
              <li
                key={profile.id}
                style={{
                  borderRadius: 12,
                  padding: 14,
                  border: "1px solid rgba(148,163,184,0.18)",
                  background: "rgba(15,23,42,0.32)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <strong style={{ color: "#f8fafc", display: "block" }}>{profile.name}</strong>
                    <span style={{ color: "#94a3b8", fontSize: 13 }}>
                      {profile.provider} • {profile.sampleDurationSeconds.toFixed(2)}s
                    </span>
                  </div>
                  <span style={{ color: "#cbd5e1", fontSize: 12, textTransform: "uppercase" }}>
                    {profile.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
