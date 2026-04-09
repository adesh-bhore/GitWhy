import { Command } from 'commander';
import chalk from 'chalk';
import { getStagedDiff } from '../core/diffAnalyser.js';
import { captureContext, captureContextAI } from '../core/contextBuilder.js';
import { saveContext } from '../storage/contextStore.js';
import { saveEmbedding } from '../storage/embeddingStore.js';
import simpleGit from 'simple-git';

export function captureCommand(){

    const cmd = new Command('capture');
    cmd.description('Internal: called by the prepare-commit-msg hook');
    cmd.argument('[msgFile]', 'Path to COMMIT_EDITMSG file');
    cmd.argument('[source]', 'Commit source type');
    cmd.argument('[sha]', 'SHA being amended');
    cmd.option('--skip', 'Skip interactive prompt, use AI directly');

    cmd.action(async (msgFile, source, sha, opts) => {

        try{
            // Get the current HEAD commit hash (pre-commit, so we use a temp approach)
            // We'll use the staged diff and record the hash after commit via post-commit hook
            // For simplicity, we generate a provisional ID and update it post-commit

            const git = simpleGit();
            const status = await git.status();
            
            if (status.staged.length === 0) {
                // Nothing staged — likely a merge commit or empty commit
                process.exit(0);
            }

            const { diff, stats } = await getStagedDiff();

            if (!diff || diff.trim().length === 0) {
                process.exit(0);
            }

             // Use a timestamp-based provisional key; updated to real hash by post-commit hook
            const provisionalKey = `pending-${Date.now()}`;

            let entry;
           
            if (opts.skip || process.env.GITWHY_AUTO_ENRICH === 'true') {
                console.log(chalk.gray('[DEBUG] Calling captureContextAI...'));
                entry = await captureContextAI(provisionalKey, diff);
                console.log(chalk.gray('[DEBUG] captureContextAI returned:', !!entry));
            } else {
                console.log(chalk.gray('[DEBUG] Calling captureContext...'));
                entry = await captureContext(provisionalKey, diff);
                console.log(chalk.gray('[DEBUG] captureContext returned:', !!entry));
            }

            console.log(chalk.gray('[DEBUG] Entry object:', JSON.stringify(entry, null, 2)));

            // Save provisional entry — will be keyed by real hash in post-commit
            console.log(chalk.gray('[DEBUG] Saving context...'));
            await saveContext(entry);
            console.log(chalk.gray('[DEBUG] Context saved successfully'));
            if (entry.embedding) {
                await saveEmbedding(provisionalKey, entry.embedding);
            }

            // Write provisional key to a temp file for post-commit to pick up
            const fs = await import('fs');
            const path = await import('path');
            fs.writeFileSync(
                path.join(process.cwd(), '.gitwhy', '.pending'),
                provisionalKey
            );


            console.log(chalk.green('\n✓ Context captured'));

        } catch (err) {
        // Never block the commit — print error and exit 0
        console.error(chalk.yellow(`\n⚠ GitWhy: ${err.message}`));
        process.exit(0);
        }
    });

  return cmd;
}