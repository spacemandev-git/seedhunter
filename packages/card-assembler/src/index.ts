#!/usr/bin/env bun
import { Command } from 'commander'
import { generateCommand } from './commands/generate'
import { fetchCommand } from './commands/fetch'
import { stylizeCommand } from './commands/stylize'
import { assembleCommand } from './commands/assemble'
import { exportCommand } from './commands/export'

const program = new Command()
  .name('card-assembler')
  .description('Generate Seedhunter founder trading cards')
  .version('1.0.0')

const VALID_CATEGORIES = ['tech', 'finance', 'retail', 'media', 'transport', 'food', 'health', 'crypto']

program
  .command('generate')
  .description('Generate founder list using AI')
  .option('-c, --count <number>', 'Number of founders to generate', '200')
  .option('-o, --output <path>', 'Output file path', 'data/founders.json')
  .option('--append', 'Append to existing list instead of overwriting')
  .option('--categories <list>', `Comma-separated list of industries to focus on (${VALID_CATEGORIES.join(', ')})`)
  .action(generateCommand)

program
  .command('fetch')
  .description('Generate lowpoly portraits using AI (Nano Banana)')
  .option('-i, --input <path>', 'Founders JSON file', 'data/founders.json')
  .option('-o, --output <path>', 'Output directory for images', 'data/raw_images')
  .option('--retry-failed', 'Retry previously failed generations')
  .action(fetchCommand)

program
  .command('stylize')
  .description('Apply visual style to profile images')
  .option('-i, --input <path>', 'Input directory with raw images', 'data/raw_images')
  .option('-o, --output <path>', 'Output directory for styled images', 'data/styled_images')
  .option('-s, --style <style>', 'Style to apply (none, duotone, posterize, halftone, lowpoly)', 'none')
  .option('--force', 'Reprocess all images even if already done')
  .action(stylizeCommand)

program
  .command('assemble')
  .description('Create final card images from styled photos')
  .option('-i, --input <path>', 'Input directory with styled images', 'data/styled_images')
  .option('-o, --output <path>', 'Output directory for cards', 'output/cards')
  .option('-d, --data <path>', 'Founders data JSON', 'data/founders.json')
  .action(assembleCommand)

program
  .command('export')
  .description('Export cards to backend static folder')
  .option('-i, --input <path>', 'Cards directory', 'output/cards')
  .option('-b, --backend <path>', 'Backend static cards path', '../backend/static/cards')
  .action(exportCommand)

program
  .command('all')
  .description('Run the full card generation pipeline')
  .option('-c, --count <number>', 'Number of founders', '200')
  .option('--categories <list>', `Comma-separated list of industries to focus on (${VALID_CATEGORIES.join(', ')})`)
  .action(async (opts) => {
    console.log('🚀 Starting full card generation pipeline...\n')
    console.log('Using Gemini (text model) via OpenRouter for founder data generation')
    console.log('Using Nano Banana (image model) via OpenRouter for lowpoly portraits')
    if (opts.categories) {
      console.log(`Focusing on industries: ${opts.categories}`)
    }
    console.log('')
    
    await generateCommand({ count: opts.count, output: 'data/founders.json', categories: opts.categories })
    await fetchCommand({ input: 'data/founders.json', output: 'data/raw_images' })
    await stylizeCommand({ input: 'data/raw_images', output: 'data/styled_images', style: 'none' })
    await assembleCommand({ input: 'data/styled_images', output: 'output/cards', data: 'data/founders.json' })
    await exportCommand({ input: 'output/cards', backend: '../backend/static/cards' })
    
    console.log('\n✅ Pipeline complete!')
  })

program.parse()
