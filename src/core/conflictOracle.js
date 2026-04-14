import simpleGit from 'simple-git';
import chalk from 'chalk';
import { loadGraph } from '../storage/graphStore.js';
import { getContext } from '../storage/contextStore.js';


/**
 * Called by the prepare-merge-msg hook when a merge conflict occurs.
 * Finds the diverging commits for each conflicting file and
 * prints both sides' captured intent before the editor opens.
 */

export async function runConflictOracle() {
    const git = simpleGit();

    // Find the common ancestor of the two branches being merged
    let mergeBase;
    try {
        const result = await git.raw(['merge-base', 'HEAD', 'MERGE_HEAD']);
        mergeBase = result.trim();
    } catch {
        return;   // Not a two-branch merge — squash/rebase/octopus, skip
    }

    // Get conflicting files from Git's conflict markers
    const status = await git.status();
    const conflicting = status.conflicted;

    if (conflicting.length === 0) return;



    // For each branch, get the commits that touched conflicting files
    // since the common ancestor
    const ourLog = await getCommitsTouchingFiles(git, mergeBase, 'HEAD', conflicting);
    const theirLog = await getCommitsTouchingFiles(git, mergeBase, 'MERGE_HEAD', conflicting);

    console.log(`\n${chalk.bold.yellow('GitWhy — Conflict Context')}`);
    console.log(chalk.gray(`  Common ancestor: ${mergeBase.slice(0, 7)}`));
    console.log(chalk.gray('─'.repeat(60)));


    for (const file of conflicting) {
        const ourCommit = ourLog[file];
        const theirCommit = theirLog[file];

        console.log(`\n  ${chalk.bold('File:')} ${chalk.cyan(file)}`);

        if (ourCommit) {
            const ctx = getContext(ourCommit);
            console.log(`\n  ${chalk.green('YOUR side')} (${ourCommit.slice(0, 7)})`);
            if (ctx) {
                console.log(`    Problem:  ${ctx.problem}`);
                console.log(`    Against:  ${ctx.alternatives}`);
            } else {
                console.log(chalk.gray('    (no context captured — run gitwhy capture --hash ' + ourCommit.slice(0, 7) + ')'));
            }
        }

        if (theirCommit) {
            const ctx = getContext(theirCommit);
            console.log(`\n  ${chalk.blue('THEIR side')} (${theirCommit.slice(0, 7)})`);
            if (ctx) {
                console.log(`    Problem:  ${ctx.problem}`);
                console.log(`    Against:  ${ctx.alternatives}`);
            } else {
                console.log(chalk.gray('    (no context captured)'));
            }
        }
    }

    console.log(`\n${chalk.gray('─'.repeat(60))}\n`);
}


/**
* Returns a map of {file → most recent commit hash}
* for the given files, between mergeBase and branchTip.
*/
async function getCommitsTouchingFiles(git, mergeBase, branchTip, files) {
    const result = {};

    for (const file of files) {
        try {
            // git log mergeBase..branchTip -- file → commits on this side that touched file
            const log = await git.log({
                from: mergeBase,
                to: branchTip,
                file
            });

            if (log.latest) {
                result[file] = log.latest.hash;
            }
        } catch {
            // file may not exist on this side — skip
        }
    }

    return result;
}
