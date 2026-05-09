// WHY: One-shot seed that registers @ladonte as a cast member using the
// production-grade 8-pose style sheet that already exists in
// ~/Desktop/Domains/ladonteprince.com. Skips the /api/generate/reference-sheet
// regeneration step (the existing sheet is better than what we'd produce).
//
// Run with:
//   npx tsx scripts/seed-ladonte-cast.ts ladonte@ladonteprince.com
//
// Pre-req: run `npm run db:migrate` once so the Asset.handle / directorDefaults
// columns + new AssetKind enum values exist.

import { db } from "../src/lib/db";
import * as fs from "node:fs/promises";
import * as path from "node:path";

type CastSeed = {
  handle: string;
  label: string;
  description: string;
  sourceSheetPath: string;
  sourcePhotoPaths: string[];
  directorDefaults?: Record<string, string>;
};

const LADONTEPRINCE_ROOT = path.resolve(
  process.env.HOME ?? "",
  "Desktop/Domains/ladonteprince.com",
);

const SEEDS: CastSeed[] = [
  {
    handle: "ladonte",
    label: "LaDonte Prince",
    description:
      "Mid-30s, dark complexion, athletic-stocky build, locs in box braids. Default wardrobe: black overshirt + white tee + black trousers. Studio-grade 8-pose turnaround (front / 3-quarter / side / back full-body, plus 4-angle headshots).",
    sourceSheetPath: path.join(
      LADONTEPRINCE_ROOT,
      "archive/the-velvet-prophet/06_production/renoise_test/LADONTE_STYLE_SHEET_FINAL.png",
    ),
    sourcePhotoPaths: [
      path.join(
        LADONTEPRINCE_ROOT,
        "productions/shared-assets/character/ladonte-frontal.png",
      ),
      path.join(
        LADONTEPRINCE_ROOT,
        "productions/shared-assets/character/ladonte-three-quarter.png",
      ),
      path.join(
        LADONTEPRINCE_ROOT,
        "productions/shared-assets/character/ladonte-side-profile.png",
      ),
    ],
  },
];

// WHY: Resolved from cwd because tsx runs this as an ES module where
// __dirname is undefined. Run the script from the project root.
const PUBLIC_CAST_DIR = path.resolve(process.cwd(), "public/cast");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyIfExists(
  src: string,
  destDir: string,
  newName?: string,
): Promise<string | null> {
  try {
    await fs.access(src);
  } catch {
    console.warn(`⚠ Skipping (not found): ${src}`);
    return null;
  }
  const destName = newName ?? path.basename(src);
  const dest = path.join(destDir, destName);
  await fs.copyFile(src, dest);
  return `/cast/${path.relative(PUBLIC_CAST_DIR, dest).replace(/\\/g, "/")}`;
}

async function main() {
  const userEmail = process.argv[2];
  if (!userEmail) {
    console.error(
      "Usage: npx tsx scripts/seed-ladonte-cast.ts <user-email>",
    );
    process.exit(1);
  }

  const user = await db.user.findFirst({
    where: { email: userEmail },
    select: { id: true, email: true },
  });
  if (!user) {
    console.error(`No user found with email ${userEmail}`);
    process.exit(1);
  }
  console.log(`✓ Seeding cast for ${user.email} (id: ${user.id})`);

  await ensureDir(PUBLIC_CAST_DIR);

  // WHY: Gitignore everything we drop in public/cast/ — the sheets are 10MB
  // each and don't belong in git history. This file ensures the folder is
  // tracked but its contents aren't.
  const gitignorePath = path.join(PUBLIC_CAST_DIR, ".gitignore");
  await fs.writeFile(gitignorePath, "*\n!.gitignore\n");

  for (const seed of SEEDS) {
    console.log(`\n— @${seed.handle} (${seed.label})`);

    const handleDir = path.join(PUBLIC_CAST_DIR, seed.handle);
    await ensureDir(handleDir);
    const sourceDir = path.join(handleDir, "source");
    await ensureDir(sourceDir);

    // Copy sheet
    const sheetUrl = await copyIfExists(seed.sourceSheetPath, handleDir, "sheet.png");
    if (!sheetUrl) {
      console.warn(`  ✗ No sheet for @${seed.handle}, skipping cast row.`);
      continue;
    }
    console.log(`  ✓ Sheet: ${sheetUrl}`);

    // Copy source photos
    const sourceUrls: string[] = [];
    for (const sp of seed.sourcePhotoPaths) {
      const url = await copyIfExists(sp, sourceDir);
      if (url) sourceUrls.push(url);
    }
    console.log(`  ✓ Source photos: ${sourceUrls.length}`);

    // Upsert Asset row
    const existing = await db.asset.findFirst({
      where: { userId: user.id, handle: seed.handle },
      select: { id: true },
    });

    const data = {
      userId: user.id,
      kind: "CHARACTER_SHEET" as const,
      handle: seed.handle,
      title: seed.label,
      gcsUri: sheetUrl,
      publicUrl: sheetUrl,
      directorDefaults: seed.directorDefaults ?? {},
      metadata: {
        sourcePhotoUrls: sourceUrls,
        description: seed.description,
        provenance: "seeded from ladonteprince.com archive",
      },
    };

    if (existing) {
      await db.asset.update({ where: { id: existing.id }, data });
      console.log(`  ✓ Updated existing asset (id: ${existing.id})`);
    } else {
      const created = await db.asset.create({ data });
      console.log(`  ✓ Created asset (id: ${created.id})`);
    }
  }

  console.log("\n✓ Done. Visit /dashboard/cast to verify.");
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
