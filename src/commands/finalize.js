import { Command } from 'commander';
import { finalizeContext } from '../storage/contextStore.js';
import { finalizeEmbedding } from '../storage/embeddingStore.js';
import simpleGit from 'simple-git';
import fs from 'fs';
import path from 'path';

export function finalizeCommand() {
  const cmd = new Command('finalize');
  cmd.description('Internal: called by post-commit hook to update provisional hash');

  cmd.action(async () => {
    try {
      const pendingFile = path.join(process.cwd(), '.gitwhy', '.pending');
      
      if (!fs.existsSync(pendingFile)) {
        // No pending context to finalize
        process.exit(0);
      }

      const provisionalKey = fs.readFileSync(pendingFile, 'utf8').trim();
      
      // Get the actual commit hash
      const git = simpleGit();
      const log = await git.log({ maxCount: 1 });
      const realHash = log.latest.hash;

      // Update both stores
      finalizeContext(provisionalKey, realHash);
      finalizeEmbedding(provisionalKey, realHash);

      // Clean up pending file
      fs.unlinkSync(pendingFile);

    } catch (err) {
      // Never block - just log error
      console.error(`GitWhy finalize error: ${err.message}`);
      process.exit(0);
    }
  });

  return cmd;
}
