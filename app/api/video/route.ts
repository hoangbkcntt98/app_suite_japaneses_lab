import { stat, readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { currentGardenUser } from "@manga/lib/auth/garden-auth";

const sourceFolder = process.env.VIDEO_PATH_SOURCE_FOLDER?.trim();
const replaceFolder = process.env.VIDEO_PATH_REPLACE_FOLDER?.trim();
const allowedRoots = [
  path.resolve(/*turbopackIgnore: true*/ process.cwd()),
  "/var/web-data",
  ...(sourceFolder && replaceFolder
    ? [path.resolve(/*turbopackIgnore: true*/ replaceFolder)]
    : []),
];

function replaceVideoPath(input: string) {
  if (!sourceFolder || !replaceFolder) return input;

  const sourcePath = path.resolve(/*turbopackIgnore: true*/ input);
  const normalizedSource = path.resolve(/*turbopackIgnore: true*/ sourceFolder);
  if (sourcePath !== normalizedSource && !sourcePath.startsWith(`${normalizedSource}${path.sep}`)) {
    return input;
  }

  return path.join(
    /*turbopackIgnore: true*/ path.resolve(/*turbopackIgnore: true*/ replaceFolder),
    path.relative(normalizedSource, sourcePath)
  );
}

function resolveVideoPath(input: string) {
  const mappedInput = replaceVideoPath(input);
  const candidate = path.resolve(
    /*turbopackIgnore: true*/ input.startsWith("/")
      ? mappedInput
      : path.join(/*turbopackIgnore: true*/ process.cwd(), mappedInput)
  );
  return allowedRoots.some((root) => candidate === root || candidate.startsWith(`${root}${path.sep}`))
    ? candidate
    : null;
}

export async function GET(request: Request) {
  if (!await currentGardenUser(request)) {
    return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  }
  const requested = new URL(request.url).searchParams.get("path");
  if (!requested) return new Response("Missing video path", { status: 400 });

  const filePath = resolveVideoPath(requested);
  if (!filePath) return new Response("Invalid video path", { status: 403 });
  if (path.extname(filePath).toLowerCase() !== ".mp4") {
    return new Response("Unsupported video format", { status: 415 });
  }

  try {
    const file = await stat(filePath);
    if (!file.isFile()) return new Response("Video not found", { status: 404 });
    const body = await readFile(filePath);
    return new Response(body, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(body.byteLength),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("Video not found", { status: 404 });
  }
}
