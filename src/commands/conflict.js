import { Command }           from 'commander';
import { runConflictOracle } from '../core/conflictOracle.js';

export function conflictCommand() {
  const cmd = new Command('conflict');
  cmd.description('Show context for the current merge conflict');

  cmd.action(async () => {
    try {
      await runConflictOracle();
    } catch (err) {
      // conflict oracle failure must never block a merge
      if (process.env.DEBUG) console.error(err);
      process.exit(0);
    }
  });

  return cmd;
}