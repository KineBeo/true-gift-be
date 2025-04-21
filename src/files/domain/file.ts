import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { Transform } from 'class-transformer';
import fileConfig from '../config/file.config';
import { FileConfig, FileDriver } from '../config/file-config.type';

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppConfig } from '../../config/app-config.type';
import appConfig from '../../config/app.config';

export class FileType {
  @ApiProperty({
    type: String,
    example: 'cbcfa8b8-3a25-4adb-a9c6-e325f0d0f3ae',
  })
  @Allow()
  id: string;

  @ApiProperty({
    type: String,
    example: 'https://example.com/path/to/file.jpg',
  })
  @Transform(
    ({ value }) => {
      if ((fileConfig() as FileConfig).driver === FileDriver.LOCAL) {
        // If the path includes 'ipfs-', this is our locally stored file with ipfs prefix
        if (value && value.includes('/ipfs-')) {
          return (appConfig() as AppConfig).backendDomain + value;
        }
        
        // For regular local files
        return (appConfig() as AppConfig).backendDomain + value;
      } else if (
        [FileDriver.S3_PRESIGNED, FileDriver.S3].includes(
          (fileConfig() as FileConfig).driver,
        )
      ) {
        const s3 = new S3Client({
          region: (fileConfig() as FileConfig).awsS3Region ?? '',
          credentials: {
            accessKeyId: (fileConfig() as FileConfig).accessKeyId ?? '',
            secretAccessKey: (fileConfig() as FileConfig).secretAccessKey ?? '',
          },
        });

        const command = new GetObjectCommand({
          Bucket: (fileConfig() as FileConfig).awsDefaultS3Bucket ?? '',
          Key: value,
        });

        return getSignedUrl(s3, command, { expiresIn: 3600 });
      } else if ((fileConfig() as FileConfig).driver === FileDriver.IPFS) {
        // Check if this is our temporary local IPFS solution (path starts with 'files/uploads/ipfs-')
        if (value && value.includes('/ipfs-')) {
          // For our temporary solution, just return the local URL
          return (appConfig() as AppConfig).backendDomain + value;
        }

        // For genuine IPFS CIDs, use the Pinata gateway
        if (value && !value.includes('/') && (
          value.startsWith('Qm') || 
          value.startsWith('bafy') || 
          value.startsWith('bafk') ||
          value.match(/^[a-zA-Z0-9]{46,59}$/)
        )) {
          // This is likely an IPFS hash
          const pinataGateway = (fileConfig() as FileConfig).pinataGatewayUrl ?? 'https://gateway.pinata.cloud/ipfs/';
          // Make sure the gateway URL ends with a slash
          const gatewayUrl = pinataGateway.endsWith('/') ? pinataGateway : `${pinataGateway}/`;
          // Return the complete URL
          return `${gatewayUrl}${value}`;
        }
      }

      return value;
    },
    {
      toPlainOnly: true,
    }
  )
  path: string;
}
