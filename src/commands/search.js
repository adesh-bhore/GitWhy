import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { semanticSearch } from '../core/searchEngine.js';


export function searchCommand() {
    const cmd = new Command('search');
    cmd.description('Semantic search across your captured decision history');
    cmd.argument('<query>', 'Natural language query — describe what you\'re looking for');
    cmd.option('-k, --top <n>', 'Number of results to return', '5');
    cmd.option('-s, --min-score <n>', 'Minimum similarity score (0-1)', '0.1');
    cmd.option('--json', 'Output results as JSON');

    cmd.action(async (query , opts) =>{

        const spinner = ora('Searching decision history...').start();

        try {
            const { results, message } = await semanticSearch(
                query,
                parseInt(opts.top),
                parseFloat(opts.minScore)
            );

            spinner.stop();

            if (results.length === 0) {
                console.log(chalk.yellow(message || 'No results found for that query.'));
                return;
            }

            if (opts.json) {
                console.log(JSON.stringify(results, null, 2));
                return;
            }

            console.log(`\n${chalk.bold('Results for:')} ${chalk.cyan('"' + query + '"')}\n`);
            console.log(chalk.gray('─'.repeat(60)));

            results.forEach((r,i) =>{

                const scorePercent = Math.round(r.score * 100);
                const hash = r.commitHash.slice(0, 7);
                const date = new Date(r.timestamp).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric'
                });
                const aiTag = r.aiGenerated ? chalk.gray(' [AI]') : '';
                const scoreColor = scorePercent > 80 ? chalk.green : scorePercent > 60 ? chalk.yellow : chalk.gray;

                console.log(
                `${chalk.bold(`${i + 1}.`)} ${chalk.yellow(hash)}${aiTag}` +
                `  ${scoreColor(scorePercent + '% match')}` +
                `  ${chalk.gray(date)}`
                );
                console.log(`   ${chalk.bold('Problem:')}  ${r.problem}`);
                console.log(`   ${chalk.gray('Against:')}  ${r.alternatives}`);

                if (r.files && r.files.length > 0) {
                const fileList = r.files.slice(0, 3).join(', ');
                const moreFiles = r.files.length > 3 ? ` +${r.files.length - 3} more` : '';
                console.log(`   ${chalk.gray('Files:')}    ${chalk.gray(fileList + moreFiles)}`);
                }

                console.log('');


            });


            console.log(chalk.gray('─'.repeat(60)));
            console.log(chalk.gray(`  ${results.length} result(s) · gitwhy log to see all entries`));


        } catch (error) {
             spinner.fail(`Search failed: ${error.message}`);
            if (process.env.DEBUG) console.error(error);
            process.exit(1);
        }
    });
    return cmd;

}