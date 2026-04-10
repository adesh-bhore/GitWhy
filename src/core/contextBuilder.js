import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { parseDiff, buildChangeSummary, truncateDiff } from './diffAnalyser.js';
import { generateSummary } from '../ai/diffSummariser.js';
import { generateEmbedding } from '../ai/embeddings.js';


/**
 * Interactive capture — asks the developer the two questions directly.
 * This is the primary path when the developer is engaged.
*/

export async function captureContext(provisionalKey , rawDiff){

     const parsed = parseDiff(rawDiff);
     const summary = buildChangeSummary(parsed);

    console.log(`\n${chalk.bold.green('GitWhy')} — ${chalk.gray(summary)}`);
    console.log(chalk.gray('  Capture the WHY before it evaporates:\n'));

    // Check if we're in an interactive terminal
    if (!process.stdin.isTTY) {
        console.log(chalk.yellow('  Non-interactive terminal detected, falling back to AI...'));
        return captureContextAI(provisionalKey, rawDiff);
    }

    let answers;
    try {
        answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'problem',
            message: chalk.cyan('What problem does this solve?'),
            validate: (v) => {
            if (v.trim().length === 0) return 'Please answer, or Ctrl+C to let AI handle it';
            if (v.trim().length < 10) return 'Be specific — at least one sentence';
            return true;
            }
        },
        {
            type: 'input',
            name: 'alternatives',
            message: chalk.cyan('What did you decide against?'),
            default: 'Nothing else considered'
        }
        ]);
    } catch (e) {
        // Developer pressed Ctrl+C — fall through to AI enrichment
        console.log(chalk.yellow('\n  Falling back to AI enrichment...'));
        return captureContextAI(provisionalKey, rawDiff);
    }

    const contextText = buildContextText(answers.problem, answers.alternatives, parsed.files);
    const embedding = await generateEmbeddingQuietly(contextText);


     return {
    commitHash: provisionalKey,  // Will be updated to real hash by post-commit
    timestamp: new Date().toISOString(),
    files: parsed.files,
    additions: parsed.additions,
    deletions: parsed.deletions,
    problem: answers.problem.trim(),
    alternatives: answers.alternatives.trim(),
    aiGenerated: false,
    embedding
  };

}

/**
 * AI-assisted capture — Claude reads the diff and generates a probable intent.
 * Developer confirms or edits. One keypress in the happy path.
 */

export async function captureContextAI(provisionalKey, rawDiff) {
  const parsed = parseDiff(rawDiff);
  const spinner = ora('Analyzing diff with AI...').start();

  let summary;
  try {
    summary = await generateSummary(rawDiff);
    spinner.succeed('AI analysis complete');
    } catch (err) {
        spinner.fail(`AI enrichment failed: ${err.message}`);
        console.error(chalk.red(`Full error: ${err.stack}`));
        // Return a minimal entry rather than blocking the commit
        return {
        commitHash: provisionalKey,  // Will be updated to real hash by post-commit
        timestamp: new Date().toISOString(),
        files: parsed.files,
        additions: parsed.additions,
        deletions: parsed.deletions,
        problem: 'Context not captured - AI failed',
        alternatives: 'Context not captured - AI failed',
        aiGenerated: true,
        aiError: err.message,
        embedding: null
        };  
    }


    console.log(`\n  ${chalk.italic.gray('AI summary:')}`);
    console.log(`  ${chalk.white(summary.problem)}`);
    console.log(`  ${chalk.gray('Against: ' + summary.alternatives)}\n`);

    // Auto-accept if GITWHY_AUTO_ENRICH is true
    if (process.env.GITWHY_AUTO_ENRICH === 'true') {
        console.log(chalk.green('✓ AI context auto-accepted'));
        const contextText = buildContextText(summary.problem, summary.alternatives, parsed.files);
        const embedding = await generateEmbeddingQuietly(contextText);

        return {
            commitHash: provisionalKey,  // Will be updated to real hash by post-commit
            timestamp: new Date().toISOString(),
            files: parsed.files,
            additions: parsed.additions,
            deletions: parsed.deletions,
            problem: summary.problem,
            alternatives: summary.alternatives,
            aiGenerated: true,
            embedding
        };
    }

     const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'This AI-generated context:',
        choices: [
        { name: 'Looks good — use it', value: 'accept' },
        { name: 'Edit it', value: 'edit' },
        { name: 'Skip context entirely', value: 'skip' }
        ],
        default: 'accept'
    }]);

    if (action === 'skip') {
        return null;
    }

    let finalProblem = summary.problem;
    let finalAlternatives = summary.alternatives;


    if (action === 'edit') {
        const edits = await inquirer.prompt([
        {
            type: 'input',
            name: 'problem',
            message: 'Problem this solves:',
            default: summary.problem
        },
        {
            type: 'input',
            name: 'alternatives',
            message: 'What was decided against:',
            default: summary.alternatives
        }
        ]);
        finalProblem = edits.problem;
        finalAlternatives = edits.alternatives;
    }

    const contextText = buildContextText(finalProblem, finalAlternatives, parsed.files);
    const embedding = await generateEmbeddingQuietly(contextText);

    return {
        commitHash: provisionalKey,  // Will be updated to real hash by post-commit
        timestamp: new Date().toISOString(),
        files: parsed.files,
        additions: parsed.additions,
        deletions: parsed.deletions,
        problem: finalProblem,
        alternatives: finalAlternatives,
        aiGenerated: action === 'accept',
        embedding
    };
}


function buildContextText(problem, alternatives, files = []) {
  const fileContext = files.length > 0 ? `\nFiles: ${files.join(', ')}` : '';
  return `Problem: ${problem}\nAlternatives considered: ${alternatives}${fileContext}`;
}

async function generateEmbeddingQuietly(text) {
  try {
    return await generateEmbedding(text);
  } catch {
    return null; // Embedding failure should never block a commit
  }
}



