import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

export function initCommand(){
    const cmd = new Command('init');
    cmd.description('Initialize GitWhy in the current repository');

    cmd.action(async () =>{
        const cwd = process.cwd();
        const gitDir = path.join(cwd, '.git');
        const gitwhyDir = path.join(cwd, '.gitwhy');
        const hooksDir = path.join(gitDir, 'hooks');
        const hookPath = path.join(hooksDir, 'prepare-commit-msg');

        if (!fs.existsSync('.git')) {
            console.log(chalk.red('Error: This is not a Git repository. Run `git init` first.'));
            process.exit(1);
        }

        fs.mkdirSync(gitwhyDir, { recursive: true });   

        const stores = {
            'contexts.json': '[]',
            'embeddings.json': '[]',
            'config.json': JSON.stringify({
                autoEnrich: false,
                model: 'gemini-pro',
                embeddingModel: 'nomic-embed-text',
                embeddingDims: 768,
                ollamaHost: process.env.OLLAMA_HOST || 'http://localhost:11434',
                maxDiffChars: 3000
            }, null, 2)
        };

        for (const [filename, content] of Object.entries(stores)) {
            const fp = path.join(gitwhyDir, filename);
            if (!fs.existsSync(fp)) {
                fs.writeFileSync(fp, content + '\n');
            }
        }

    // Git hook with TTY support for interactive prompts
    const hookContent = `#!/bin/sh
# GitWhy — context capture hook
# Installed by: gitwhy init

COMMIT_MSG_FILE=$1
COMMIT_SOURCE=$2
SHA=$3

# Skip for merge commits and squash
if [ "$COMMIT_SOURCE" = "merge" ] || [ "$COMMIT_SOURCE" = "squash" ]; then
  exit 0
fi

# Redirect input from terminal for interactive prompts
exec < /dev/tty
gitwhy capture "$COMMIT_MSG_FILE" "$COMMIT_SOURCE" "$SHA"
`;

    // Post-commit hook to update provisional hash with real commit hash
    const postCommitHook = `#!/bin/sh
# GitWhy — finalize commit hash
# Updates provisional hash with real commit hash after commit completes

gitwhy finalize
`;

    fs.mkdirSync(hooksDir, { recursive: true });
    fs.writeFileSync(hookPath, hookContent);
    fs.chmodSync(hookPath, '755');
    
    const postCommitPath = path.join(hooksDir, 'post-commit');
    fs.writeFileSync(postCommitPath, postCommitHook);
    fs.chmodSync(postCommitPath, '755');

    console.log(chalk.green('✓ GitWhy initialized'));
    console.log(chalk.gray('  Hook:    .git/hooks/prepare-commit-msg'));
    console.log(chalk.gray('  Storage: .gitwhy/'));
    console.log('');
    console.log(chalk.bold('Next steps:'));
    console.log('  1. Add .gitwhy/ to git: ' + chalk.cyan('git add .gitwhy/'));
    console.log('  2. Make a commit - GitWhy will prompt you for context');
  });

  return cmd;
}
