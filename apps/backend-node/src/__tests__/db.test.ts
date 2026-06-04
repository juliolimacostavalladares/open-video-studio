import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '@repo/database';

describe('Database ORM & Encryption Tests', () => {
  beforeEach(async () => {
    // Clear channels before each test
    await prisma.channel.deleteMany({});
  });

  afterAll(async () => {
    // Clean up connections
    await prisma.$disconnect();
  });

  it('should successfully connect to the test database', async () => {
    const result = await prisma.$queryRaw`SELECT 1 as result`;
    expect(result).toBeDefined();

    const rows = result as unknown as { result: number }[];
    const firstRow = rows[0];
    if (!firstRow) {
      throw new Error('No rows returned');
    }
    expect(firstRow.result).toBe(1);
  });

  it('should encrypt tokens on creation and decrypt on retrieval', async () => {
    const channelName = 'Test Tech Channel';
    const rawAccessToken = 'secret-access-token-12345';
    const rawRefreshToken = 'secret-refresh-token-67890';

    // 1. Create a channel using extended prisma client
    const created = await prisma.channel.create({
      data: {
        name: channelName,
        provider: 'youtube',
        encryptedAccessToken: rawAccessToken,
        encryptedRefreshToken: rawRefreshToken,
      },
    });

    // Verify properties returned by client are decrypted automatically
    expect(created.name).toBe(channelName);
    expect(created.encryptedAccessToken).toBe(rawAccessToken);
    expect(created.encryptedRefreshToken).toBe(rawRefreshToken);

    // 2. Fetch the channel directly using the raw PostgreSQL query to verify it is encrypted in DB
    const rawDbChannels = await prisma.$queryRaw<
      { encryptedAccessToken: string; encryptedRefreshToken: string }[]
    >`
      SELECT "encryptedAccessToken", "encryptedRefreshToken" FROM "Channel" WHERE "id" = ${created.id}
    `;

    expect(rawDbChannels).toHaveLength(1);
    const dbRow = rawDbChannels[0];
    if (!dbRow) {
      throw new Error('No db channel row returned');
    }

    // Verify it starts with the encryption prefix 'enc:' and is not plaintext
    expect(dbRow.encryptedAccessToken).not.toBe(rawAccessToken);
    expect(dbRow.encryptedAccessToken.startsWith('enc:')).toBe(true);

    expect(dbRow.encryptedRefreshToken).not.toBe(rawRefreshToken);
    expect(dbRow.encryptedRefreshToken?.startsWith('enc:')).toBe(true);

    // 3. Query it back using the normal Prisma client and verify decryption
    const retrieved = await prisma.channel.findUnique({
      where: { id: created.id },
    });

    expect(retrieved).not.toBeNull();
    expect(retrieved?.encryptedAccessToken).toBe(rawAccessToken);
    expect(retrieved?.encryptedRefreshToken).toBe(rawRefreshToken);
  });
});
