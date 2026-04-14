import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getDownstream } from '../core/dependencyGraph.js';
import { getContext } from '../storage/contextStore.js';


export function revertRiskCommand() {
    const cmd = new Command('revert-risk');
    cmd.description('Show what downstream commits depend on a given commit');
    cmd.argument('<hash>', 'Commit hash to analyse (short or full)');
    cmd.option('--json', 'Output as JSON');


    cmd.action(async (hash, opts) => {
        const spinner = ora('Tracing dependency graph...').start();

        try {
            const downstream = await getDownstream(hash);
            spinner.stop();


            if (downstream.length === 0) {
                console.log(chalk.green(`✓ No downstream dependencies found for ${hash.slice(0, 7)}`));
                console.log(chalk.gray('  Safe to revert.'));
                return;
            }

            if (opts.json) {
                const enriched = downstream.map(d => ({
                    ...d,
                    context: getContext(d.hash)
                }));
                console.log(JSON.stringify(enriched, null, 2));
                return;
            }

            console.log(`\n${chalk.bold.red('Revert risk:')} ${chalk.yellow(hash.slice(0, 7))}`);
            console.log(chalk.gray(`  ${downstream.length} downstream commit(s) may break\n`));
            console.log(chalk.gray('─'.repeat(60)));

            for (const dep of downstream) {
                const ctx = getContext(dep.hash);
                const shortHash = dep.hash.slice(0, 7);

                console.log(`\n  ${chalk.yellow(shortHash)}`);
                console.log(`  ${chalk.gray('Via files:')} ${dep.via.join(', ')}`);

                if (ctx) {
                    console.log(`  ${chalk.bold('Problem:')}  ${ctx.problem}`);
                    console.log(`  ${chalk.gray('Against:')} ${ctx.alternatives}`);
                } else {
                    console.log(`  ${chalk.gray('(no context captured for this commit)')}`);
                }
            }

            console.log(`\n${chalk.gray('─'.repeat(60))}`);
            console.log(chalk.gray(`  Run: git revert ${hash} --no-commit to stage the revert first`));


        } catch (error) {
            spinner.fail(`Revert risk analysis failed: ${error.message}`);
            process.exit(1);
        }
    });

    return cmd;
}