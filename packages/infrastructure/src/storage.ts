import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { loadWorkspaceConfig, type WorkspaceConfig } from "@repo/config";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput
} from "@aws-sdk/client-s3";

export type StorageDriver = "local" | "s3";
export type StorageNamespace = "assets" | "audio" | "renders";

export type StorageObjectDescriptor = {
  body: Buffer;
  contentType?: string;
  key: string;
};

export type StorageService = {
  deleteObject(namespace: StorageNamespace, key: string): Promise<void>;
  getObject(namespace: StorageNamespace, key: string): Promise<StorageObjectDescriptor>;
  putObject(
    namespace: StorageNamespace,
    key: string,
    body: Buffer | string,
    contentType?: string
  ): Promise<StorageObjectDescriptor>;
};

function normalizeStorageKey(key: string) {
  const normalized = key.replaceAll("\\", "/").replace(/^\/+/, "");

  if (!normalized || normalized.includes("..")) {
    throw new Error(`Invalid storage key: ${key}`);
  }

  return normalized;
}

export function buildStorageObjectKey(namespace: StorageNamespace, key: string) {
  return `${namespace}/${normalizeStorageKey(key)}`;
}

function resolveLocalPath(basePath: string, objectKey: string) {
  const root = resolve(basePath);
  const fullPath = resolve(join(root, objectKey));

  if (!fullPath.startsWith(root)) {
    throw new Error(`Invalid resolved storage path for key ${objectKey}`);
  }

  return fullPath;
}

function createLocalStorage(config: WorkspaceConfig): StorageService {
  return {
    async deleteObject(namespace, key) {
      const objectKey = buildStorageObjectKey(namespace, key);
      const fullPath = resolveLocalPath(config.storageBasePath, objectKey);

      await rm(fullPath, { force: true });
    },
    async getObject(namespace, key) {
      const objectKey = buildStorageObjectKey(namespace, key);
      const fullPath = resolveLocalPath(config.storageBasePath, objectKey);
      const body = await readFile(fullPath);

      return {
        body,
        key: objectKey
      };
    },
    async putObject(namespace, key, body, contentType) {
      const objectKey = buildStorageObjectKey(namespace, key);
      const fullPath = resolveLocalPath(config.storageBasePath, objectKey);

      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, body);

      return {
        body: Buffer.isBuffer(body) ? body : Buffer.from(body),
        contentType,
        key: objectKey
      };
    }
  };
}

async function streamToBuffer(response: GetObjectCommandOutput["Body"]) {
  if (!response) {
    return Buffer.alloc(0);
  }

  const chunks: Buffer[] = [];

  for await (const chunk of response as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function createS3Client(config: WorkspaceConfig) {
  return new S3Client({
    credentials: {
      accessKeyId: config.storageAccessKey,
      secretAccessKey: config.storageSecretKey
    },
    endpoint: config.storageEndpoint,
    forcePathStyle: config.storageForcePathStyle,
    region: config.storageRegion
  });
}

function createS3Storage(config: WorkspaceConfig): StorageService {
  const client = createS3Client(config);
  let bucketReadyPromise: Promise<void> | undefined;

  async function ensureBucket() {
    if (!bucketReadyPromise) {
      bucketReadyPromise = (async () => {
        try {
          await client.send(
            new HeadBucketCommand({
              Bucket: config.storageBucket
            })
          );
        } catch {
          await client.send(
            new CreateBucketCommand({
              Bucket: config.storageBucket
            })
          );
        }
      })();
    }

    await bucketReadyPromise;
  }

  return {
    async deleteObject(namespace, key) {
      await ensureBucket();

      const objectKey = buildStorageObjectKey(namespace, key);

      await client.send(
        new DeleteObjectCommand({
          Bucket: config.storageBucket,
          Key: objectKey
        })
      );
    },
    async getObject(namespace, key) {
      await ensureBucket();

      const objectKey = buildStorageObjectKey(namespace, key);
      const response = await client.send(
        new GetObjectCommand({
          Bucket: config.storageBucket,
          Key: objectKey
        })
      );

      return {
        body: await streamToBuffer(response.Body),
        contentType: response.ContentType,
        key: objectKey
      };
    },
    async putObject(namespace, key, body, contentType) {
      await ensureBucket();

      const objectKey = buildStorageObjectKey(namespace, key);
      const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);

      await client.send(
        new PutObjectCommand({
          Body: buffer,
          Bucket: config.storageBucket,
          ContentType: contentType,
          Key: objectKey
        })
      );

      return {
        body: buffer,
        contentType,
        key: objectKey
      };
    }
  };
}

export function createStorageService(config: WorkspaceConfig = loadWorkspaceConfig()): StorageService {
  return config.storageDriver === "s3" ? createS3Storage(config) : createLocalStorage(config);
}
