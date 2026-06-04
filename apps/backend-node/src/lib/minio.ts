import { S3Client, CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';

// Initialize S3Client configured for local MinIO compatibility
export const minioClient = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT_INTERNAL || 'http://localhost:9000',
  region: 'us-east-1', // Dummy region required by S3 SDK
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER || 'minioadmin',
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD || 'minioadmin',
  },
  forcePathStyle: true, // Required for MinIO
});

export async function initializeMinIO() {
  const buckets = ['videos', 'voices', 'assets', 'thumbnails'];
  const publicBuckets = ['voices', 'assets', 'thumbnails'];

  for (const bucket of buckets) {
    try {
      // Check if the bucket already exists
      await minioClient.send(new HeadBucketCommand({ Bucket: bucket }));
      console.log(`MinIO bucket "${bucket}" already exists.`);
    } catch (err: any) {
      // Create bucket if NotFound (404)
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        console.log(`MinIO bucket "${bucket}" not found. Creating...`);
        await minioClient.send(new CreateBucketCommand({ Bucket: bucket }));
        console.log(`MinIO bucket "${bucket}" created successfully.`);

        // Apply Public Read policy if required
        if (publicBuckets.includes(bucket)) {
          console.log(`Applying public read policy to MinIO bucket "${bucket}"...`);
          const policy = {
            Version: '2012-10-17',
            Statement: [
              {
                Sid: 'PublicRead',
                Effect: 'Allow',
                Principal: '*',
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${bucket}/*`],
              },
            ],
          };
          await minioClient.send(
            new PutBucketPolicyCommand({
              Bucket: bucket,
              Policy: JSON.stringify(policy),
            })
          );
          console.log(`Public read policy applied to MinIO bucket "${bucket}" successfully.`);
        }
      } else {
        console.error(`Unexpected error checking/creating MinIO bucket "${bucket}":`, err);
        throw err;
      }
    }
  }
}
