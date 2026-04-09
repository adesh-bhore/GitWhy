import simpleGit from 'simple-git';


/**
 * Returns the staged diff (changes that will be committed).
 * This is what `git diff --cached` shows.
 */

export async function getStagedDiff() {
  const git = simpleGit();
  const diff = await git.diff(['--cached']);
  const stats = await git.diff(['--cached', '--stat']);
  return { diff, stats };
}


/**
 * Returns the diff for a specific commit hash.
 * Used when retroactively adding context to old commits.
 */
export async function getDiffForCommit(commitHash) {
  const git = simpleGit();
  return await git.show([commitHash]);
}


/**
 * Parses a raw diff string into structured metadata.
 */
export function parseDiff(rawDiff) {
  const files = [];
  const fileRegex = /diff --git a\/(.*?) b\/(.*?)$/gm;
  let match;

  while ((match = fileRegex.exec(rawDiff)) !== null) {
    files.push(match[1]);
  }

  // Count added and removed lines (exclude diff header lines starting with +++ or ---)
  const additions = (rawDiff.match(/^\+(?!\+\+)/gm) || []).length;
  const deletions = (rawDiff.match(/^-(?!--)/gm) || []).length;

  return { files, additions, deletions, raw: rawDiff };
}


/**
 * Truncates large diffs to stay within Claude's token limits.
 * Prioritizes showing the beginning of each file's diff.
 */
export function truncateDiff(diff, maxChars = 3000) {
  if (diff.length <= maxChars) return diff;

  const truncated = diff.slice(0, maxChars);
  const omitted = diff.length - maxChars;
  return `${truncated}\n\n[...diff truncated — ${omitted} characters omitted for API limits]`;
}

/**
 * Extracts a human-readable summary of what changed for display in the terminal.
 */
export function buildChangeSummary(parsed) {
  const { files, additions, deletions } = parsed;
  const fileList = files.slice(0, 5).join(', ');
  const moreFiles = files.length > 5 ? ` (+${files.length - 5} more)` : '';
  return `${files.length} file(s) changed: ${fileList}${moreFiles} [+${additions} -${deletions}]`;
}


