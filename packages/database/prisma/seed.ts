import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.create({
    data: {
      title: "Demo Project",
      description: "Projeto inicial para desenvolvimento local",
      status: "draft"
    }
  });

  const voiceProfile = await prisma.voiceProfile.create({
    data: {
      name: "Narrador Base",
      provider: "local",
      samplePath: "storage/voices/base-sample.wav",
      status: "active"
    }
  });

  const asset = await prisma.asset.create({
    data: {
      kind: "image",
      path: "storage/assets/demo-cover.png",
      projectId: project.id,
      source: "upload",
      status: "ready"
    }
  });

  await prisma.scene.createMany({
    data: [
      {
        projectId: project.id,
        orderIndex: 0,
        title: "Cena 1",
        script: "Introducao do video",
        status: "draft",
        voiceProfileId: voiceProfile.id,
        assetId: asset.id
      },
      {
        projectId: project.id,
        orderIndex: 1,
        title: "Cena 2",
        script: "Desenvolvimento do video",
        status: "draft",
        voiceProfileId: voiceProfile.id,
        assetId: asset.id
      }
    ]
  });

  await prisma.renderJob.create({
    data: {
      projectId: project.id,
      status: "queued"
    }
  });
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
    await prisma.$disconnect();
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
