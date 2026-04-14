#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { captureCommand } from './commands/capture.js';
import { searchCommand } from './commands/search.js';
import { logCommand } from './commands/log.js';
import { finalizeCommand } from './commands/finalize.js';
import { rebuildCommand } from './commands/rebuild.js';
import { syncCommand } from './commands/sync.js';
import { revertRiskCommand } from './commands/revertRisk.js';
import { conflictCommand }   from './commands/conflict.js';
import { graphIndexCommand } from './commands/graphIndex.js';
import { migrateCommand } from './commands/migrate.js';


// Set default server URL (your hosted backend)
if (!process.env.GITWHY_API_URL) {
  process.env.GITWHY_API_URL = 'http://51.21.226.149:3000';
}

const program = new Command();

program
  .name('gitwhy')
  .description('Enrich your git history with the WHY behind every change')
  .version('2.0.0');

program.addCommand(initCommand());
program.addCommand(captureCommand());
program.addCommand(searchCommand());
program.addCommand(logCommand());
program.addCommand(finalizeCommand());
program.addCommand(rebuildCommand());
program.addCommand(syncCommand());

program.addCommand(revertRiskCommand());
program.addCommand(conflictCommand());
program.addCommand(graphIndexCommand());
program.addCommand(migrateCommand());


program.parse();
