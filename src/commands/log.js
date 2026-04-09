import { Command } from 'commander';
import chalk from 'chalk';
import { loadContexts } from '../storage/contextStore.js';

export function logCommand() {
  const cmd = new Command('log');
  cmd.description('List all captured context entries in reverse chronological order');
  cmd.option('-n, --limit <n>', 'Number of entries to show', '20');
  cmd.option('--ai-only', 'Show only AI-generated entries');
  cmd.option('--human-only', 'Show only human-answered entries');
  cmd.option('--json', 'Output as JSON');

  cmd.action(async (opts) => {
    try {
      let contexts = loadContexts();

      if (contexts.length === 0) {
        console.log(chalk.yellow('No context entries found. Run `gitwhy init` and make some commits.'));
        return;
      }

      // Apply filters
      if (opts.aiOnly) {
        contexts = contexts.filter(c => c.aiGenerated === true);
      }
      if (opts.humanOnly) {
        contexts = contexts.filter(c => c.aiGenerated === false);
      }

      // Sort by timestamp (newest first)
      contexts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Apply limit
      const limit = parseInt(opts.limit);
      const displayContexts = contexts.slice(0, limit);

      // JSON output
      if (opts.json) {
        console.log(JSON.stringify(displayContexts, null, 2));
        return;
      }

      // Pretty terminal output
      console.log(`\n${chalk.bold('GitWhy Context History')}\n`);
      console.log(chalk.gray('─'.repeat(70)));

      displayContexts.forEach((entry, index) => {
        const hash = entry.commitHash.slice(0, 7);
        const date = new Date(entry.timestamp).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        const aiTag = entry.aiGenerated ? chalk.gray(' [AI]') : chalk.blue(' [Human]');

        console.log(
          `${chalk.bold(`${index + 1}.`)} ${chalk.yellow(hash)}${aiTag}  ${chalk.gray(date)}`
        );
        console.log(`   ${chalk.bold('Problem:')}  ${entry.problem}`);
        console.log(`   ${chalk.gray('Against:')}  ${entry.alternatives}`);

        if (entry.files && entry.files.length > 0) {
          const fileList = entry.files.slice(0, 3).join(', ');
          const moreFiles = entry.files.length > 3 ? ` +${entry.files.length - 3} more` : '';
          console.log(`   ${chalk.gray('Files:')}    ${chalk.gray(fileList + moreFiles)}`);
        }

        if (entry.additions !== undefined || entry.deletions !== undefined) {
          console.log(
            `   ${chalk.gray('Changes:')}  ${chalk.green(`+${entry.additions || 0}`)} ${chalk.red(`-${entry.deletions || 0}`)}`
          );
        }

        console.log('');
      });

      console.log(chalk.gray('─'.repeat(70)));
      
      const totalShown = displayContexts.length;
      const totalAvailable = contexts.length;
      const moreAvailable = totalAvailable > totalShown ? ` (${totalAvailable - totalShown} more available)` : '';
      
      console.log(chalk.gray(`  Showing ${totalShown} of ${totalAvailable} entries${moreAvailable}`));
      
      if (totalAvailable > totalShown) {
        console.log(chalk.gray(`  Use --limit ${totalAvailable} to see all entries`));
      }

    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      if (process.env.DEBUG) console.error(err);
      process.exit(1);
    }
  });

  return cmd;
}
