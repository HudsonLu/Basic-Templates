import { NextResponse } from "next/server";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function makeDirectUrl(publicEndpoint: string, bucket: string, key: string) {
  return `${publicEndpoint.replace(/\/$/, "")}/${bucket}/${encodeURIComponent(key).replace(/%2F/g, "/")}`;
}

function makeS3Client(endpoint: string) {
  return new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  });
}

export async function GET() {
  const bucket = process.env.S3_BUCKET!;
  const internalEndpoint = process.env.S3_INTERNAL_ENDPOINT || "http://minio:9000";
  const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT || process.env.NEXT_PUBLIC_S3_PUBLIC_ENDPOINT || "http://localhost:9000";

  const internalS3 = makeS3Client(internalEndpoint);
  const publicS3 = makeS3Client(publicEndpoint); // <-- signs URLs with host the browser can reach

  const publicBucket = process.env.NEXT_PUBLIC_S3_PUBLIC_BUCKET || bucket;

  // ✅ must use internalS3 (container can reach minio:9000)
  const out = await internalS3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      MaxKeys: 200,
      // Optional if you only want a game folder:
      // Prefix: "games/3/",
    })
  );

  const objects = (out.Contents || [])
    .filter((o) => o.Key)
    .sort((a, b) => {
      const ta = a.LastModified ? new Date(a.LastModified).getTime() : 0;
      const tb = b.LastModified ? new Date(b.LastModified).getTime() : 0;
      return tb - ta;
    });

  // ✅ presign using publicS3 so URL host is localhost:9000 (browser can resolve)
  const items = await Promise.all(
    objects.map(async (o) => {
      const key = o.Key!;
      const signedPreviewUrl = await getSignedUrl(
        publicS3,
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { expiresIn: 60 * 5 }
      );

      return {
        key,
        size: o.Size ?? 0,
        lastModified: o.LastModified ? new Date(o.LastModified).toISOString() : null,
        directUrl: makeDirectUrl(publicEndpoint, publicBucket, key), // only works if objects are public
        signedPreviewUrl, // always works (temporary)
      };
    })
  );

  return NextResponse.json({ items });
}
