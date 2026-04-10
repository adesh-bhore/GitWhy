import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadContexts } from '../storage/contextStore.js';
import { saveEmbedding } from '../storage/embeddingStore.js';
import { generateEmbedding } from '../ai/embeddings.js';

export function rebuildCommand() {
  const cmd = new Command('rebuild');
  cmd.description('Rebuild all embeddings with improved context');

  cmd.action(async () => {
    try {
      const contexts = loadContexts();
      
      if (contexts.length === 0) {
        console.log(chalk.yellow('No contexts found to rebuild'));
        return;
      }

      console.log(chalk.bold(`\nRebuilding embeddings for ${contexts.length} commits...\n`));

      for (const context of contexts) {
        const spinner = ora(`Processing ${context.commitHash.substring(0, 7)}...`).start();
        
        try {
          // Build enhanced context text with files
          const fileContext = context.files && context.files.length > 0 
            ? `\nFiles: ${context.files.join(', ')}` 
            : '';
          
          const contextText = `Problem: ${context.problem}\nAlternatives considered: ${context.alternatives}${fileContext}`;
          
          // Generate new embedding
          const embedding = await generateEmbedding(contextText);
          
          // Save it
          await saveEmbedding(context.commitHash, embedding);
          
          spinner.succeed(`${context.commitHash.substring(0, 7)} - ${context.problem.substring(0, 50)}...`);
        } catch (err) {
          spinner.fail(`${context.commitHash.substring(0, 7)} - Error: ${err.message}`);
        }
      }

      console.log(chalk.green(`\n✓ Rebuilt ${contexts.length} embeddings`));
      console.log(chalk.gray('Try searching again with: gitwhy search "your query"\n'));

    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

  return cmd;
}
