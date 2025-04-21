export enum FileDriver {
  LOCAL = 'local',
  S3 = 's3',
  S3_PRESIGNED = 's3-presigned',
  IPFS = 'ipfs',
}

export type FileConfig = {
  driver: FileDriver;
  accessKeyId?: string;
  secretAccessKey?: string;
  awsDefaultS3Bucket?: string;
  awsS3Region?: string;
  pinataApiKey?: string;
  pinataSecretApiKey?: string;
  pinataGatewayUrl?: string;
  maxFileSize: number;
};
