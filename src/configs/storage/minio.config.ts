import { Client } from 'minio';

// MinIO configuration
const minioConfig = {
  endPoint: process.env.MINIO_ENDPOINT || 'cloudy-api.duckdns.org',
  port: parseInt(process.env.MINIO_PORT || '443'),
  useSSL: true,
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
};

// Initialize the client with default config
export let minioClient = new Client(minioConfig);

export const initMinIO = async () => {
  const bucketName = process.env.MINIO_BUCKET_NAME || 'cloudy';
  
  try {
    // Try to connect to AWS MinIO server
    const bucketExists = await minioClient.bucketExists(bucketName);
    if (!bucketExists) {
      await minioClient.makeBucket(bucketName, process.env.MINIO_REGION || 'ap-southeast-1');
      console.info(`Created MinIO bucket: ${bucketName}`);
    }
    console.info('✅ MinIO connection via AWS successful (Docker then Caddy built)');
    return true;
  } catch (Error) {
    console.warn('❌ MinIO connection via AWS failed:', Error);
    throw Error;
  }
}; 