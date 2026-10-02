import { readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const buildDir = path.join(projectDir, "Build");
const maxChunkBytes = 19 * 1024 * 1024;
const assets = { sizes: {} };

for (const extension of ["data", "wasm"]) {
  const fileName = `Web.${extension}`;
  const filePath = path.join(buildDir, fileName);
  const partPattern = new RegExp(`^${fileName.replace(".", "\\.")}\\.part\\d{3,}$`);
  const existingParts = (await readdir(buildDir)).filter((name) => partPattern.test(name)).sort();
  let fileSize;
  try {
    fileSize = (await stat(filePath)).size;
  } catch (error) {
    if (error.code !== "ENOENT" || existingParts.length === 0) {
      throw error;
    }
    for (const partName of existingParts) {
      const partSize = (await stat(path.join(buildDir, partName))).size;
      if (partSize > maxChunkBytes) {
        throw new Error(`${partName} exceeds the configured chunk size`);
      }
    }
    assets[extension] = existingParts.map((file) => ({ file }));
    assets.sizes[extension] = await Promise.all(existingParts.map(async (partName) =>
      (await stat(path.join(buildDir, partName))).size
    ));
    continue;
  }

  if (fileSize <= maxChunkBytes) {
    for (const partName of existingParts) {
      await unlink(path.join(buildDir, partName));
    }
    assets[extension] = [{ file: fileName }];
    assets.sizes[extension] = [fileSize];
    continue;
  }

  const contents = await readFile(filePath);
  const partNames = [];
  for (let offset = 0, part = 0; offset < contents.length; offset += maxChunkBytes, part++) {
    const partName = `${fileName}.part${String(part).padStart(3, "0")}`;
    const partPath = path.join(buildDir, partName);
    await writeFile(partPath, contents.subarray(offset, offset + maxChunkBytes));
    partNames.push(partName);
  }

  for (const existingFile of await readdir(buildDir)) {
    if (partPattern.test(existingFile) && !partNames.includes(existingFile)) {
      await unlink(path.join(buildDir, existingFile));
    }
  }

  await unlink(filePath);
  assets[extension] = partNames.map((file) => ({ file }));
  assets.sizes[extension] = await Promise.all(partNames.map(async (partName) =>
    (await stat(path.join(buildDir, partName))).size
  ));
  console.log(`${fileName}: ${fileSize} bytes -> ${partNames.length} parts`);
}

await writeFile(path.join(buildDir, "assets.json"), `${JSON.stringify(assets, null, 2)}\n`);