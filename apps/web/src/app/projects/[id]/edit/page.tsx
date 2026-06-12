import { redirect } from "next/navigation";

interface ProjectEditPageProps {
  params: { id: string };
}

export default async function ProjectEditPage({
  params,
}: ProjectEditPageProps) {
  const editorUrl = process.env.NEXT_PUBLIC_EDITOR_URL ?? "http://localhost:3001";
  redirect(`${editorUrl}/edit/${params.id}`);
}
