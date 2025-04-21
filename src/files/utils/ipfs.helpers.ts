import { ConfigService } from '@nestjs/config';

/**
 * Helper functions for working with IPFS in TrueGift
 */

/**
 * Gets the IPFS gateway URL from environment or uses default
 * @param configService NestJS ConfigService for accessing environment variables
 * @returns The IPFS gateway URL with trailing slash
 */
export const getIpfsGatewayUrl = (configService: ConfigService): string => {
  const gatewayUrl = configService.get('file.pinataGatewayUrl') || 
                    process.env.PINATA_GATEWAY_URL || 
                    'https://gateway.pinata.cloud/ipfs/';
  
  // Ensure the URL ends with a trailing slash
  return gatewayUrl.endsWith('/') ? gatewayUrl : `${gatewayUrl}/`;
};

/**
 * Checks if a path is an IPFS CID (Content Identifier)
 * @param path The path to check
 * @returns true if the path is an IPFS CID
 */
export const isIpfsCid = (path: string): boolean => {
  if (!path) return false;
  
  // IPFS CIDs have no slashes and follow specific formats
  return !path.includes('/') && (
    path.startsWith('Qm') || // CIDv0
    path.startsWith('bafy') || // CIDv1 - dag-pb
    path.startsWith('bafk') || // CIDv1 - raw
    !!path.match(/^[a-zA-Z0-9]{46,59}$/) // General CID length check
  );
};

/**
 * Converts any path to a proper IPFS URL
 * @param path The file path or CID
 * @param configService NestJS ConfigService 
 * @returns A fully qualified IPFS URL
 */
export const toIpfsUrl = (path: string, configService: ConfigService): string => {
  if (!path) return '';
  
  const gatewayUrl = getIpfsGatewayUrl(configService);
  
  // If it's a CID, just add the gateway prefix
  if (isIpfsCid(path)) {
    return `${gatewayUrl}${path}`;
  }
  
  // If it already has the ipfs prefix from another gateway, extract the CID
  if (path.includes('/ipfs/')) {
    const parts = path.split('/ipfs/');
    const cid = parts[parts.length - 1];
    return `${gatewayUrl}${cid}`;
  }
  
  // If it's already a complete URL with our gateway, use it as is
  if (path.includes(gatewayUrl)) {
    return path;
  }
  
  // Otherwise, assume it's a relative path
  return `${configService.get('app.backendDomain')}/${path}`;
}; 