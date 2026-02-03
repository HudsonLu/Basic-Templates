import { NextResponse } from "next/server";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function makeDirectUrl(publicEndpoint: string, bucket: string, key: string) {
  return `${publicEndpoint.replace(/\/$/, "")}/${bucket}/${encodeURIComponent(key).replace(/%2F/g, "/")}`;
}

export async function GET() {
  const bucket = process.env.S3_BUCKET!;
  const s3 = new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  });

  const publicEndpoint = process.env.NEXT_PUBLIC_S3_PUBLIC_ENDPOINT || "http://localhost:9000";
  const publicBucket = process.env.NEXT_PUBLIC_S3_PUBLIC_BUCKET || bucket;

  const out = await s3.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 200 }));

  const objects = (out.Contents || [])
    .filter((o) => o.Key)
    .sort((a, b) => {
      const ta = a.LastModified ? new Date(a.LastModified).getTime() : 0;
      const tb = b.LastModified ? new Date(b.LastModified).getTime() : 0;
      return tb - ta;
    });

  const items = await Promise.all(
    objects.map(async (o) => {
      const key = o.Key!;
      const signedPreviewUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { expiresIn: 60 * 5 }
      );

      return {
        key,
        size: o.Size ?? 0,
        lastModified: o.LastModified ? new Date(o.LastModified).toISOString() : null,
        directUrl: makeDirectUrl(publicEndpoint, publicBucket, key),
        signedPreviewUrl,
      };
    })
  );

  return NextResponse.json({ items });
}
