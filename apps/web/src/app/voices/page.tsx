import { PageHeader } from "../../components/PageHeader";
import { VoiceLibrary } from "../../components/VoiceLibrary";
import { getClientApiUrl } from "../../lib/api";

export default function VoicesPage() {
  return (
    <div className="page">
      <PageHeader
        description="Gerencie as vozes que podem narrar seus projetos."
        eyebrow="Produção de áudio"
        title="Biblioteca de vozes"
      />
      <VoiceLibrary apiBaseUrl={getClientApiUrl()} />
    </div>
  );
}
