export default function HomePage() {
  return (
    <main
      style={{
        alignItems: "center",
        display: "flex",
        justifyContent: "center",
        padding: "48px 24px"
      }}
    >
      <section
        style={{
          background: "rgba(255, 255, 255, 0.82)",
          border: "1px solid rgba(0, 0, 0, 0.08)",
          borderRadius: 24,
          boxShadow: "0 18px 60px rgba(77, 59, 36, 0.14)",
          maxWidth: 760,
          padding: 40,
          width: "100%"
        }}
      >
        <p
          style={{
            fontSize: 13,
            letterSpacing: "0.2em",
            margin: 0,
            textTransform: "uppercase"
          }}
        >
          Sprint 0
        </p>
        <h1 style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", marginBottom: 16, marginTop: 12 }}>
          Open Video Studio
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.6, margin: 0 }}>
          Workspace base pronta para evoluir `web` e `api` de forma previsivel, com scripts
          padronizados e smoke checks para bootstrap local.
        </p>
      </section>
    </main>
  );
}
