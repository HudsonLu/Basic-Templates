import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function sanitizeFileName(name: string) {
  // keep it simple + safe for URLs/keys
  return name
    .replace(/[/\\]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

function randomShort() {
  return Math.random().toString(16).slice(2, 10);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const fileName = body?.fileName as string | undefined;
    const contentType = body?.contentType as string | undefined;
    const gameId = body?.gameId as string | undefined;

    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: "fileName and contentType are required" },
        { status: 400 }
      );
    }

    if (!gameId || !String(gameId).trim()) {
      return NextResponse.json(
        { error: "gameId is required" },
        { status: 400 }
      );
    }

    const bucket = process.env.S3_BUCKET!;
    const s3 = new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      endpoint: process.env.S3_ENDPOINT!, // e.g. http://localhost:9000
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    });

    const cleanName = sanitizeFileName(fileName);
    const key = `games/${String(gameId).trim()}/${Date.now()}-${randomShort()}-${cleanName}`;

    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 }); // 5 minutes

    return NextResponse.json({ uploadUrl, key });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message || "server error" },
      { status: 500 }
    );
  }
}
