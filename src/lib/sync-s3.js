import {
  ChecksumMode,
  GetObjectCommand,
  S3Client,
  paginateListObjectsV2,
} from "@aws-sdk/client-s3";
import { join } from "path";
import { writeFileWithMkdir } from "./fs.js";

/**
 * @param {{ client: S3Client, key: string, destinationFolder: string, bucketName: string }}
 */
const downloadFileFromS3 = async ({
  client,
  key,
  destinationFolder,
  bucketName,
}) => {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
    ChecksumMode: ChecksumMode.ENABLED,
  });
  const response = await client.send(command);
  const path = join(destinationFolder, key);
  if (response.ContentType.includes("application/x-directory")) {
    console.info(`File ${key} is a directory, skipping`);
    return;
  }
  console.info(`Creating directory ${path}`);
  await writeFileWithMkdir(path, response.Body);
  console.info(`Downloaded file ${key} to ${path}`);
};

/**
 * @param {{ client: S3Client, page: {Contents: {Key: string}[]}, destinationFolder: string, bucketName: string }}
 */
const syncFilesFromS3Page = async ({
  client,
  page,
  destinationFolder,
  bucketName,
}) => {
  await Promise.all(
    page.Contents.map(async (object) =>
      downloadFileFromS3({
        client,
        key: object.Key,
        destinationFolder,
        bucketName,
      }),
    ),
  );
};

/**
 * Log all of the object keys in a bucket.
 * @param {{ bucketName: string, pageSize: number, destinationFolder: string }}
 */
export const syncFilesFromS3 = async ({
  bucketName,
  pageSize,
  destinationFolder,
}) => {
  console.info(
    `Syncing files from S3 bucket ${bucketName} to ${destinationFolder}`,
  );
  const client = new S3Client({});

  const paginator = paginateListObjectsV2(
    { client, pageSize },
    { Bucket: bucketName },
  );

  for await (const page of paginator) {
    await syncFilesFromS3Page({ client, page, destinationFolder, bucketName });
  }
};
