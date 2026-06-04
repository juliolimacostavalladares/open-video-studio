import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt } from './encryption.js';

const globalForPrisma = globalThis as unknown as {
  prismaExtended: PrismaClient;
};

let extendedPrisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  const basePrisma = new PrismaClient();
  extendedPrisma = basePrisma.$extends({
    query: {
      channel: {
        async create({ args, query }) {
          if (args.data) {
            if (args.data.encryptedAccessToken) {
              args.data.encryptedAccessToken = encrypt(args.data.encryptedAccessToken);
            }
            if (args.data.encryptedRefreshToken) {
              args.data.encryptedRefreshToken = encrypt(args.data.encryptedRefreshToken);
            }
          }
          return query(args);
        },
        async createMany({ args, query }) {
          if (args.data) {
            const dataArray = Array.isArray(args.data) ? args.data : [args.data];
            for (const item of dataArray) {
              if (item.encryptedAccessToken) {
                item.encryptedAccessToken = encrypt(item.encryptedAccessToken);
              }
              if (item.encryptedRefreshToken) {
                item.encryptedRefreshToken = encrypt(item.encryptedRefreshToken);
              }
            }
          }
          return query(args);
        },
        async update({ args, query }) {
          if (args.data) {
            if (typeof args.data.encryptedAccessToken === 'string') {
              args.data.encryptedAccessToken = encrypt(args.data.encryptedAccessToken);
            }
            if (typeof args.data.encryptedRefreshToken === 'string') {
              args.data.encryptedRefreshToken = encrypt(args.data.encryptedRefreshToken);
            }
          }
          return query(args);
        },
        async updateMany({ args, query }) {
          if (args.data) {
            if (typeof args.data.encryptedAccessToken === 'string') {
              args.data.encryptedAccessToken = encrypt(args.data.encryptedAccessToken);
            }
            if (typeof args.data.encryptedRefreshToken === 'string') {
              args.data.encryptedRefreshToken = encrypt(args.data.encryptedRefreshToken);
            }
          }
          return query(args);
        },
        async upsert({ args, query }) {
          if (args.create) {
            if (args.create.encryptedAccessToken) {
              args.create.encryptedAccessToken = encrypt(args.create.encryptedAccessToken);
            }
            if (args.create.encryptedRefreshToken) {
              args.create.encryptedRefreshToken = encrypt(args.create.encryptedRefreshToken);
            }
          }
          if (args.update) {
            if (typeof args.update.encryptedAccessToken === 'string') {
              args.update.encryptedAccessToken = encrypt(args.update.encryptedAccessToken);
            }
            if (typeof args.update.encryptedRefreshToken === 'string') {
              args.update.encryptedRefreshToken = encrypt(args.update.encryptedRefreshToken);
            }
          }
          return query(args);
        },
      },
    },
    result: {
      channel: {
        // Automatically decrypt token fields when reading them
        encryptedAccessToken: {
          needs: { encryptedAccessToken: true },
          compute(channel) {
            return channel.encryptedAccessToken ? decrypt(channel.encryptedAccessToken) : '';
          },
        },
        encryptedRefreshToken: {
          needs: { encryptedRefreshToken: true },
          compute(channel) {
            return channel.encryptedRefreshToken ? decrypt(channel.encryptedRefreshToken) : null;
          },
        },
      },
    },
  }) as unknown as PrismaClient;
} else {
  if (!globalForPrisma.prismaExtended) {
    const basePrisma = new PrismaClient();
    globalForPrisma.prismaExtended = basePrisma.$extends({
      query: {
        channel: {
          async create({ args, query }) {
            if (args.data) {
              if (args.data.encryptedAccessToken) {
                args.data.encryptedAccessToken = encrypt(args.data.encryptedAccessToken);
              }
              if (args.data.encryptedRefreshToken) {
                args.data.encryptedRefreshToken = encrypt(args.data.encryptedRefreshToken);
              }
            }
            return query(args);
          },
          async createMany({ args, query }) {
            if (args.data) {
              const dataArray = Array.isArray(args.data) ? args.data : [args.data];
              for (const item of dataArray) {
                if (item.encryptedAccessToken) {
                  item.encryptedAccessToken = encrypt(item.encryptedAccessToken);
                }
                if (item.encryptedRefreshToken) {
                  item.encryptedRefreshToken = encrypt(item.encryptedRefreshToken);
                }
              }
            }
            return query(args);
          },
          async update({ args, query }) {
            if (args.data) {
              if (typeof args.data.encryptedAccessToken === 'string') {
                args.data.encryptedAccessToken = encrypt(args.data.encryptedAccessToken);
              }
              if (typeof args.data.encryptedRefreshToken === 'string') {
                args.data.encryptedRefreshToken = encrypt(args.data.encryptedRefreshToken);
              }
            }
            return query(args);
          },
          async updateMany({ args, query }) {
            if (args.data) {
              if (typeof args.data.encryptedAccessToken === 'string') {
                args.data.encryptedAccessToken = encrypt(args.data.encryptedAccessToken);
              }
              if (typeof args.data.encryptedRefreshToken === 'string') {
                args.data.encryptedRefreshToken = encrypt(args.data.encryptedRefreshToken);
              }
            }
            return query(args);
          },
          async upsert({ args, query }) {
            if (args.create) {
              if (args.create.encryptedAccessToken) {
                args.create.encryptedAccessToken = encrypt(args.create.encryptedAccessToken);
              }
              if (args.create.encryptedRefreshToken) {
                args.create.encryptedRefreshToken = encrypt(args.create.encryptedRefreshToken);
              }
            }
            if (args.update) {
              if (typeof args.update.encryptedAccessToken === 'string') {
                args.update.encryptedAccessToken = encrypt(args.update.encryptedAccessToken);
              }
              if (typeof args.update.encryptedRefreshToken === 'string') {
                args.update.encryptedRefreshToken = encrypt(args.update.encryptedRefreshToken);
              }
            }
            return query(args);
          },
        },
      },
      result: {
        channel: {
          // Automatically decrypt token fields when reading them
          encryptedAccessToken: {
            needs: { encryptedAccessToken: true },
            compute(channel) {
              return channel.encryptedAccessToken ? decrypt(channel.encryptedAccessToken) : '';
            },
          },
          encryptedRefreshToken: {
            needs: { encryptedRefreshToken: true },
            compute(channel) {
              return channel.encryptedRefreshToken ? decrypt(channel.encryptedRefreshToken) : null;
            },
          },
        },
      },
    }) as unknown as PrismaClient;
  }
  extendedPrisma = globalForPrisma.prismaExtended;
}

export const prisma = extendedPrisma;



