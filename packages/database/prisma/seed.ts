import { prisma } from '../src/client.js';

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Seed Voice Profiles
  const voices = [
    {
      id: 'voice-rachel-uuid-0001',
      name: 'Rachel (Sweet/Narrator)',
      provider: 'elevenlabs',
      voiceId: '21m00Tcm4TlvDq8ikWAM',
      gender: 'female',
      previewUrl: 'https://api.elevenlabs.io/v1/voices/21m00Tcm4TlvDq8ikWAM/previews',
    },
    {
      id: 'voice-drew-uuid-0002',
      name: 'Drew (News/Professional)',
      provider: 'elevenlabs',
      voiceId: '29vD33N1CtxCmqQRPOHJ',
      gender: 'male',
      previewUrl: 'https://api.elevenlabs.io/v1/voices/29vD33N1CtxCmqQRPOHJ/previews',
    },
    {
      id: 'voice-clyde-uuid-0003',
      name: 'Clyde (Deep/Video Games)',
      provider: 'elevenlabs',
      voiceId: '2Ezo5yI7cXq4f5N4nGB3',
      gender: 'male',
      previewUrl: 'https://api.elevenlabs.io/v1/voices/2Ezo5yI7cXq4f5N4nGB3/previews',
    },
  ];

  console.log('Populating Voice Profiles...');
  for (const voice of voices) {
    await prisma.voiceProfile.upsert({
      where: { id: voice.id },
      update: voice,
      create: voice,
    });
  }

  // 2. Seed Test Channels
  const channels = [
    {
      id: 'channel-test-uuid-0001',
      name: 'Studio Test Channel',
      provider: 'youtube',
      encryptedAccessToken: 'dummy_access_token',
      encryptedRefreshToken: 'dummy_refresh_token',
      tokenExpiry: new Date(Date.now() + 3600 * 1000), // 1 hour from now
    },
  ];

  console.log('Populating Test Channels...');
  for (const channel of channels) {
    await prisma.channel.upsert({
      where: { id: channel.id },
      update: channel,
      create: channel,
    });
  }

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
