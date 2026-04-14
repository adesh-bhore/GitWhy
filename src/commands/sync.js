import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import simpleGit from 'simple-git';
import { loadContexts } from '../storage/contextStore.js';
import { saveEmbedding } from '../storage/embeddingStore.js';
import { generateEmbedding } from '../ai/embeddings.js';
import { indexCommit } from '../core/dependencyGraph.js';
import { saveGraph } from '../storage/graphStore.js';

export function syncCommand() {
  const cmd = new Command('sync');
  cmd.description('Rebuild embeddings and dependency graph after git pull');

  cmd.action(async () => {
    try {
      const contexts = loadContexts();
      
      if (contexts.length === 0) {
        console.log(chalk.yellow('No contexts found. Nothing to sync.'));
        return;
      }

      console.log(chalk.bold(`\n🔄 Syncing GitWhy data for ${contexts.length} commits...\n`));

      // Step 1: Rebuild embeddings from contexts.json
      const embeddingSpinner = ora('Rebuilding embeddings...').start();
      let embeddingCount = 0;

      for (const context of contexts) {
        try {
          const fileContext = context.files && context.files.length > 0 
            ? `\nFiles: ${context.files.join(', ')}` 
            : '';
          
          const contextText = `Problem: ${context.problem}\nAlternatives considered: ${context.alternatives}${fileContext}`;
          const embedding = await generateEmbedding(contextText);
          await saveEmbedding(context.commitHash, embedding);
          embeddingCount++;
        } catch (err) {
          // Continue on error - don't block the entire sync
          if (process.env.DEBUG) {
            console.error(chalk.gray(`\n[embedding error] ${context.commitHash.substring(0, 7)}: ${err.message}`));
          }
        }
      }

      embeddingSpinner.succeed(`Rebuilt ${embeddingCount} embeddings`);

      // Step 2: Rebuild dependency graph from git history
      const graphSpinner = ora('Rebuilding dependency graph...').start();
      
      // Reset graph to empty state
      saveGraph({ nodes: [], edges: [] });
      
      const git = simpleGit();
      const log = await git.log();
      const commits = log.all;

      let graphCount = 0;
      for (const commit of commits.reverse()) {
        try {
          await indexCommit(commit.hash);
          graphCount++;
        } catch (err) {
          // Continue on error
          if (process.env.DEBUG) {
            console.error(chalk.gray(`\n[graph error] ${commit.hash.substring(0, 7)}: ${err.message}`));
          }
        }
      }

      graphSpinner.succeed(`Rebuilt dependency graph with ${graphCount} commits`);

      console.log(chalk.green(`\n✓ Sync complete!`));
      console.log(chalk.gray('You can now use: gitwhy search, gitwhy revert-risk, gitwhy conflict\n'));

    } catch (err) {
      console.error(chalk.red(`\nSync failed: ${err.message}`));
      process.exit(1);
    }
  });

  return cmd;
}
