#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { captureCommand } from './commands/capture.js';
import { searchCommand } from './commands/search.js';
import { logCommand } from './commands/log.js';
import { finalizeCommand } from './commands/finalize.js';

// Set default server URL (your hosted backend)
if (!process.env.GITWHY_API_URL) {
  process.env.GITWHY_API_URL = 'http://51.21.226.149';
}

const program = new Command();

program
  .name('gitwhy')
  .description('Enrich your git history with the WHY behind every change')
  .version('1.0.0');

program.addCommand(initCommand());
program.addCommand(captureCommand());
program.addCommand(searchCommand());
program.addCommand(logCommand());
program.addCommand(finalizeCommand());

program.parse();
