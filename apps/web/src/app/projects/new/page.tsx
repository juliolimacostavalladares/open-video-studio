import { CreateProjectForm } from "../../../components/CreateProjectForm";
import { PageHeader } from "../../../components/PageHeader";
import { getClientApiUrl } from "../../../lib/api";

export default function NewProjectPage() {
  return (
    <div className="page">
      <PageHeader
        description="Comece com uma boa ideia. A IA prepara a primeira versão do roteiro para você dirigir."
        eyebrow="Novo projeto"
        title="Crie seu próximo vídeo"
      />
      <CreateProjectForm apiBaseUrl={getClientApiUrl()} />
    </div>
  );
}
