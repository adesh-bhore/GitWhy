import { Command }      from 'commander';
import chalk            from 'chalk';
import simpleGit        from 'simple-git';
import { indexCommit }  from '../core/dependencyGraph.js';

export function graphIndexCommand() {
  const cmd = new Command('graph-index');
  cmd.description('Internal: index the latest commit into the dependency graph');

  cmd.action(async () => {
    try {
      const git    = simpleGit();
      const log    = await git.log({ maxCount: 1 });
      const latest = log.latest;

      if (!latest) {
        process.exit(0);
      }

      await indexCommit(latest.hash);
      // Silent on success — post-commit output is noise in normal workflow

    } catch (err) {
      // Never block or surface errors to the developer in the post-commit path
      if (process.env.DEBUG) {
        console.error(chalk.gray(`[gitwhy graph-index] ${err.message}`));
      }
      process.exit(0);
    }
  });

  return cmd;
}