# IPFS File Storage

This document explains how to use the IPFS (InterPlanetary File System) storage option via Pinata for the TrueGift application.

## Overview

The TrueGift application now supports storing files on IPFS using Pinata as a pinning service. This provides a decentralized storage option with the following benefits:

- Content-addressing: Files are identified by their content, not their location
- Permanent storage: Files can remain accessible even if the original uploader is offline
- Decentralized access: Files can be accessed from any IPFS gateway
- Immutability: Content cannot be changed once uploaded

## Configuration

To use the IPFS storage option, you need to update your `.env` file with the following variables:

```
FILE_DRIVER=ipfs
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_API_KEY=your_pinata_secret_api_key
PINATA_GATEWAY_URL=https://gateway.pinata.cloud/ipfs/
```

### Getting Pinata API Keys

1. Sign up for a Pinata account at [pinata.cloud](https://pinata.cloud)
2. Log in to your Pinata dashboard
3. Navigate to "API Keys" section
4. Create a new API key with appropriate permissions (at minimum, you need "pinFileToIPFS" permission)
5. Copy the API Key and API Secret to your `.env` file

## How It Works

When a file is uploaded using the IPFS driver:

1. The file is sent to Pinata's pinning service
2. Pinata returns a Content Identifier (CID) for the file
3. The CID is stored in the database as the file path
4. When the file needs to be accessed, the CID is combined with the Pinata gateway URL to create a complete URL

For example, if a file has a CID of `QmRLaT4WxUZqNJMwL4KVcdM2MRPXARKqcyEAK1Ea4ULvsz`, it can be accessed at:
`https://gateway.pinata.cloud/ipfs/QmRLaT4WxUZqNJMwL4KVcdM2MRPXARKqcyEAK1Ea4ULvsz`

## API Usage

The API endpoints remain the same as with other storage drivers:

- Upload a file: `POST /api/v1/files/upload`
- Upload a photo: `POST /api/v1/photos/upload`

The response will include a URL that points to the IPFS gateway with the file's CID.

## Frontend Integration

No changes are needed on the frontend as the file URLs are returned in the same format as with other storage drivers.

## Considerations

- IPFS uploads may be slower than traditional storage options
- Files uploaded to IPFS are public and cannot be easily deleted
- Consider adding content encryption for sensitive files before uploading
- Pinata has rate limits and storage quotas based on your plan

## Troubleshooting

If you encounter issues with IPFS storage:

1. Verify your Pinata API keys are correct
2. Check that the file size is within Pinata's limits
3. Ensure the file format is supported
4. Verify your Pinata account is active and has available storage 