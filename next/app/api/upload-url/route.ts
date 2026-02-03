/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const fileName = String(body?.fileName || "");
    const contentType = String(body?.contentType || "");
    const size = Number(body?.size || 0);

    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: "fileName and contentType are required" },
        { status: 400 }
      );
    }

    const bucket = process.env.S3_BUCKET!;
    const key = `${Date.now()}-${fileName}`; // simple unique key

    // IMPORTANT:
    // If Next is running on your HOST (npm run dev), use localhost endpoint.
    // If Next runs in Docker, use http://minio:9000 instead.
    const s3 = new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    });

    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: size || undefined,
      }),
      { expiresIn: 60 * 5 }
    );

    return NextResponse.json({ uploadUrl, key });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "server error" }, { status: 500 });
  }
}
