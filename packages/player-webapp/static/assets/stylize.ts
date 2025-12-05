#!/usr/bin/env bun
/**
 * Image Stylization Script using OpenRouter API
 *
 * Usage:
 *   bun run stylize.ts --name "Steve Jobs" --style lowpoly
 *   bun run stylize.ts -all --style lowpoly
 *   bun run stylize.ts --name "Elon Musk" --style lowpoly,anime,watercolor
 *   bun run stylize.ts --name "Elon Musk" --style all
 *   bun run stylize.ts -all --style all
 *
 * Environment:
 *   OPENROUTER_API_KEY - Your OpenRouter API key
 *
 * Options:
 *   --name <name>    Process a specific image by name (without .jpg extension)
 *   -all             Process all images in raw/
 *   --style <style>  Style(s) to apply: single style, comma-separated list, or 'all'
 *   --model <model>  OpenRouter model to use (default: google/gemini-2.0-flash-exp:free)
 *   --help           Show this help message
 */

import { readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, basename } from "node:path";

// Available artistic styles with their prompts
const STYLES: Record<string, { name: string; prompt: string }> = {
  lowpoly: {
    name: "Low Poly",
    prompt:
      "Transform this portrait into a low poly geometric art style. Use flat shaded triangular polygons with bold colors. Keep the likeness recognizable but stylized with angular geometric shapes. The background should also be geometric low poly style.",
  },
  watercolor: {
    name: "Watercolor",
    prompt:
      "Transform this portrait into a beautiful watercolor painting style. Use soft, flowing colors with visible brush strokes and gentle color bleeds. Include subtle paper texture and artistic watercolor splashes around the edges.",
  },
  anime: {
    name: "Anime",
    prompt:
      "Transform this portrait into an anime/manga art style. Use clean lines, large expressive eyes, stylized hair, and vibrant colors typical of Japanese animation. Keep the likeness recognizable in anime form.",
  },
  oilpainting: {
    name: "Oil Painting",
    prompt:
      "Transform this portrait into a classic oil painting style reminiscent of the Dutch Masters. Use rich, deep colors with visible brush strokes, dramatic lighting (chiaroscuro), and a painterly quality.",
  },
  pencilsketch: {
    name: "Pencil Sketch",
    prompt:
      "Transform this portrait into a detailed pencil sketch. Use fine graphite lines, cross-hatching for shadows, and leave some areas as white paper. Create a realistic hand-drawn sketch appearance.",
  },
  pixelart: {
    name: "Pixel Art",
    prompt:
      "Transform this portrait into retro pixel art style. Use a limited color palette with visible square pixels, reminiscent of 16-bit or 32-bit era video game character portraits.",
  },
  popart: {
    name: "Pop Art",
    prompt:
      "Transform this portrait into Andy Warhol-style pop art. Use bold, contrasting colors, halftone dots, and high contrast. Create a vibrant, iconic pop art representation.",
  },
  cyberpunk: {
    name: "Cyberpunk",
    prompt:
      "Transform this portrait into a cyberpunk style. Add neon accents, holographic elements, cyber implants, and a futuristic aesthetic with purple, cyan, and magenta color scheme.",
  },
};

const AVAILABLE_STYLES = Object.keys(STYLES);

// Configuration
const CONFIG = {
  rawDir: join(import.meta.dir, "raw"),
  processedDir: join(import.meta.dir, "processed"),
  errorsDir: join(import.meta.dir, "errors"),
  defaultModel: "google/gemini-2.5-flash-image",
  apiEndpoint: "https://openrouter.ai/api/v1/chat/completions",
};

async function dumpErrorResponse(data: any, context: string): Promise<string> {
  if (!existsSync(CONFIG.errorsDir)) {
    await mkdir(CONFIG.errorsDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `error_${context}_${timestamp}.json`;
  const filepath = join(CONFIG.errorsDir, filename);
  await Bun.write(filepath, JSON.stringify(data, null, 2));
  return filepath;
}

interface Args {
  name?: string;
  all: boolean;
  style: string;
  model: string;
  help: boolean;
}

function parseArgs(): Args {
  const args: Args = {
    all: false,
    style: "lowpoly",
    model: CONFIG.defaultModel,
    help: false,
  };

  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "-a" || arg === "--all") {
      args.all = true;
    } else if (arg === "--name" && argv[i + 1]) {
      args.name = argv[++i];
    } else if (arg === "--style" && argv[i + 1]) {
      args.style = argv[++i].toLowerCase();
    } else if (arg === "--model" && argv[i + 1]) {
      args.model = argv[++i];
    }
  }

  return args;
}

function showHelp(): void {
  console.log(`
Image Stylization Script using OpenRouter API

Usage:
  bun run stylize.ts --name "Steve Jobs" --style lowpoly
  bun run stylize.ts -all --style lowpoly
  bun run stylize.ts --name "Elon Musk" --style lowpoly,anime,watercolor
  bun run stylize.ts --name "Elon Musk" --style all
  bun run stylize.ts -all --style all

Options:
  --name <name>    Process a specific image by name (without .jpg extension)
  -all             Process all images in raw/
  --style <style>  Style(s) to apply - single style, comma-separated list, or 'all' (default: lowpoly)
  --model <model>  OpenRouter model (default: ${CONFIG.defaultModel})
  --help           Show this help message

Available Styles:
${AVAILABLE_STYLES.map((s) => `  - ${s.padEnd(12)} ${STYLES[s].name}`).join(
  "\n"
)}
  - all            Apply all styles to each image

Environment Variables:
  OPENROUTER_API_KEY  Your OpenRouter API key (required)
`);
}

async function getImageFiles(
  rawDir: string,
  specificName?: string
): Promise<string[]> {
  const files = await readdir(rawDir);
  const imageFiles = files.filter(
    (f) =>
      f.toLowerCase().endsWith(".jpg") ||
      f.toLowerCase().endsWith(".jpeg") ||
      f.toLowerCase().endsWith(".png")
  );

  if (specificName) {
    const matchingFile = imageFiles.find(
      (f) =>
        f.toLowerCase().replace(/\.(jpg|jpeg|png)$/i, "") ===
          specificName.toLowerCase() ||
        f.toLowerCase() === specificName.toLowerCase() ||
        f.toLowerCase() === `${specificName.toLowerCase()}.jpg`
    );

    if (!matchingFile) {
      console.error(`❌ Image not found: ${specificName}`);
      console.log(`Available images:`);
      imageFiles
        .slice(0, 10)
        .forEach((f) =>
          console.log(`  - ${f.replace(/\.(jpg|jpeg|png)$/i, "")}`)
        );
      if (imageFiles.length > 10) {
        console.log(`  ... and ${imageFiles.length - 10} more`);
      }
      process.exit(1);
    }
    return [matchingFile];
  }

  return imageFiles;
}

async function imageToBase64(filePath: string): Promise<string> {
  const file = Bun.file(filePath);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString("base64");
}

async function stylizeImage(
  imagePath: string,
  style: string,
  model: string,
  apiKey: string
): Promise<{ success: boolean; imageData?: string; error?: string; cost?: number }> {
  const styleConfig = STYLES[style];
  if (!styleConfig) {
    return { success: false, error: `Unknown style: ${style}` };
  }

  const base64Image = await imageToBase64(imagePath);
  const mimeType = imagePath.toLowerCase().endsWith(".png")
    ? "image/png"
    : "image/jpeg";

  const requestBody = {
    model,
    modalities: ["image"],  // Force image-only output
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
            },
          },
          {
            type: "text",
            text: styleConfig.prompt + " IMPORTANT: You must generate and return ONLY a transformed image. Do not include any text explanation or description. Return the stylized image directly.",
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(CONFIG.apiEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/seedhunter",
        "X-Title": "Seedhunter Image Stylizer",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `API error (${response.status}): ${errorText}`,
      };
    }

    const data = (await response.json()) as any;

    // Extract cost from usage
    const cost = data.usage?.cost as number | undefined;

    // Extract image from response
    const message = data.choices?.[0]?.message;
    if (!message) {
      const errorFile = await dumpErrorResponse(data, "no_message");
      return { success: false, error: `No response message from API (dumped to ${errorFile})` };
    }

    // Handle different response formats
    // Check for images array first (newer Gemini format)
    if (message.images && Array.isArray(message.images) && message.images.length > 0) {
      const imageItem = message.images[0];
      if (imageItem.type === "image_url" && imageItem.image_url?.url) {
        const dataUrl = imageItem.image_url.url;
        if (dataUrl.startsWith("data:")) {
          const base64Data = dataUrl.split(",")[1];
          return { success: true, imageData: base64Data, cost };
        }
      }
    }

    // Some models return base64 image data in content array
    if (message.content && Array.isArray(message.content)) {
      for (const part of message.content) {
        // Gemini format: inline_data with base64
        if (part.type === "inline_data" && part.inline_data?.data) {
          return { success: true, imageData: part.inline_data.data, cost };
        }
        // OpenAI format: image_url with data URL
        if (part.type === "image_url" && part.image_url?.url) {
          const dataUrl = part.image_url.url;
          if (dataUrl.startsWith("data:")) {
            const base64Data = dataUrl.split(",")[1];
            return { success: true, imageData: base64Data, cost };
          }
        }
        // Generic format: image with data
        if (part.type === "image" && part.data) {
          return { success: true, imageData: part.data, cost };
        }
      }
    }

    // Some models might return a URL or other format
    if (message.image) {
      return { success: true, imageData: message.image, cost };
    }

    // If text response only, the model might not support image generation
    const textContent =
      typeof message.content === "string"
        ? message.content
        : message.content?.find((p: any) => p.type === "text")?.text;

    if (textContent) {
      const errorFile = await dumpErrorResponse(data, "text_only");
      return {
        success: false,
        error: `Model returned text instead of image (dumped to ${errorFile})`,
      };
    }

    const errorFile = await dumpErrorResponse(data, "extraction_failed");
    return { success: false, error: `Could not extract image from response (dumped to ${errorFile})` };
  } catch (error) {
    return { success: false, error: `Request failed: ${error}` };
  }
}

async function saveImage(
  base64Data: string,
  originalName: string,
  style: string,
  outputDir: string
): Promise<string> {
  const nameWithoutExt = originalName.replace(/\.(jpg|jpeg|png)$/i, "");
  const outputPath = join(outputDir, `${nameWithoutExt}_${style}.png`);

  const buffer = Buffer.from(base64Data, "base64");
  await Bun.write(outputPath, buffer);

  return outputPath;
}

interface ProcessResult {
  imageName: string;
  style: string;
  success: boolean;
  outputPath?: string;
  error?: string;
  cost?: number;
}

async function processImage(
  imageName: string,
  styles: string[],
  model: string,
  apiKey: string
): Promise<ProcessResult[]> {
  const imagePath = join(CONFIG.rawDir, imageName);
  const results: ProcessResult[] = [];

  // Process all styles for this image in parallel
  const stylePromises = styles.map(async (style) => {
    const result = await stylizeImage(imagePath, style, model, apiKey);

    if (result.success && result.imageData) {
      const outputPath = await saveImage(
        result.imageData,
        imageName,
        style,
        CONFIG.processedDir
      );
      return {
        imageName,
        style,
        success: true,
        outputPath,
        cost: result.cost,
      };
    } else {
      return {
        imageName,
        style,
        success: false,
        error: result.error,
      };
    }
  });

  return await Promise.all(stylePromises);
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  // Validate API key
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error(
      "❌ Error: OPENROUTER_API_KEY environment variable is required"
    );
    console.log("   Set it with: export OPENROUTER_API_KEY=your_key_here");
    process.exit(1);
  }

  // Validate arguments
  if (!args.name && !args.all) {
    console.error("❌ Error: Must specify either --name <name> or -all");
    showHelp();
    process.exit(1);
  }

  // Determine styles to apply
  let stylesToApply: string[];
  if (args.style === "all") {
    stylesToApply = AVAILABLE_STYLES;
  } else {
    // Parse comma-separated styles
    stylesToApply = args.style
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);
  }

  // Validate styles
  for (const style of stylesToApply) {
    if (!STYLES[style]) {
      console.error(`❌ Error: Unknown style '${style}'`);
      console.log(`   Available styles: ${AVAILABLE_STYLES.join(", ")}, all`);
      process.exit(1);
    }
  }

  // Ensure directories exist
  if (!existsSync(CONFIG.rawDir)) {
    console.error(`❌ Error: Raw images directory not found: ${CONFIG.rawDir}`);
    process.exit(1);
  }

  if (!existsSync(CONFIG.processedDir)) {
    await mkdir(CONFIG.processedDir, { recursive: true });
    console.log(`📁 Created output directory: ${CONFIG.processedDir}`);
  }

  // Get images to process
  const imageFiles = await getImageFiles(CONFIG.rawDir, args.name);

  console.log(`\n🎨 Image Stylization Tool`);
  console.log(`   Model: ${args.model}`);
  console.log(
    `   Styles: ${stylesToApply.map((s) => STYLES[s].name).join(", ")}`
  );
  console.log(`   Images: ${imageFiles.length}`);
  console.log(`   Output: ${CONFIG.processedDir}`);
  console.log(`   Processing: Parallel (all images and styles simultaneously)\n`);

  // Process all images in parallel
  const startTime = Date.now();
  const allPromises = imageFiles.map((imageFile) =>
    processImage(imageFile, stylesToApply, args.model, apiKey)
  );
  const allResults = await Promise.all(allPromises);

  // Display results
  const flatResults = allResults.flat();
  let totalCost = 0;
  let successCount = 0;
  let errorCount = 0;

  console.log(`\n📊 Results:`);
  console.log(`${"─".repeat(80)}`);

  // Group by image
  for (let i = 0; i < imageFiles.length; i++) {
    const imageFile = imageFiles[i];
    const displayName = imageFile.replace(/\.(jpg|jpeg|png)$/i, "");
    const imageResults = allResults[i];

    console.log(`\n🖼️  ${displayName}`);
    for (const result of imageResults) {
      const styleName = STYLES[result.style].name.padEnd(15);
      if (result.success && result.outputPath) {
        const costStr = result.cost !== undefined ? ` ($${result.cost.toFixed(4)})` : "";
        console.log(`   ✅ ${styleName} → ${basename(result.outputPath)}${costStr}`);
        successCount++;
        if (result.cost) totalCost += result.cost;
      } else {
        console.log(`   ❌ ${styleName} → ${result.error}`);
        errorCount++;
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${"─".repeat(80)}`);
  console.log(`✨ Done! ${successCount} successful, ${errorCount} failed`);
  console.log(`   Time: ${elapsed}s | Total cost: $${totalCost.toFixed(4)}`);
}

main().catch(console.error);
