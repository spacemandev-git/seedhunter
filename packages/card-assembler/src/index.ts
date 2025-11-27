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

program
  .command('generate')
  .description('Generate founder list using AI')
  .option('-c, --count <number>', 'Number of founders to generate', '200')
  .option('-o, --output <path>', 'Output file path', 'data/founders.json')
  .option('--append', 'Append to existing list instead of overwriting')
  .action(generateCommand)

program
  .command('fetch')
  .description('Fetch profile pictures for founders')
  .option('-i, --input <path>', 'Founders JSON file', 'data/founders.json')
  .option('-o, --output <path>', 'Output directory for images', 'data/raw_images')
  .option('--retry-failed', 'Retry previously failed fetches')
  .action(fetchCommand)

program
  .command('stylize')
  .description('Apply visual style to profile images')
  .option('-i, --input <path>', 'Input directory with raw images', 'data/raw_images')
  .option('-o, --output <path>', 'Output directory for styled images', 'data/styled_images')
  .option('-s, --style <style>', 'Style to apply (duotone, posterize, halftone)', 'duotone')
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
  .action(async (opts) => {
    console.log('🚀 Starting full card generation pipeline...\n')
    
    await generateCommand({ count: opts.count, output: 'data/founders.json' })
    await fetchCommand({ input: 'data/founders.json', output: 'data/raw_images' })
    await stylizeCommand({ input: 'data/raw_images', output: 'data/styled_images', style: 'duotone' })
    await assembleCommand({ input: 'data/styled_images', output: 'output/cards', data: 'data/founders.json' })
    await exportCommand({ input: 'output/cards', backend: '../backend/static/cards' })
    
    console.log('\n✅ Pipeline complete!')
  })

program.parse()
