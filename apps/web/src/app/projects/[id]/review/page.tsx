import { ProjectReview } from "../../../../components/ProjectReview";

interface ProjectReviewPageProps {
  params: { id: string };
}

export default function ProjectReviewPage({ params }: ProjectReviewPageProps) {
  const clientApiUrl =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.API_INTERNAL_URL ??
    "http://localhost:4000";

  return <ProjectReview projectId={params.id} apiBaseUrl={clientApiUrl} />;
}
