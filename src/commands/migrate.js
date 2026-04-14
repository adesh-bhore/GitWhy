import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import * as jsonStore from '../storage/graphStore.js';
import * as pgStore from '../storage/graphStore.postgres.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function migrateCommand() {
  const cmd = new Command('migrate');
  cmd.description('Migrate data between storage backends');
  
  cmd.command('to-postgres')
    .description('Migrate from JSON to PostgreSQL')
    .action(async () => {
      await migrateToPostgres();
    });
  
  cmd.command('to-json')
    .description('Export from PostgreSQL to JSON')
    .action(async () => {
      await migrateToJson();
    });
  
  cmd.command('init-db')
    .description('Initialize PostgreSQL database schema')
    .action(async () => {
      await initDatabase();
    });
  
  cmd.command('stats')
    .description('Show storage statistics')
    .action(async () => {
      await showStats();
    });
  
  return cmd;
}

async function initDatabase() {
  const spinner = ora('Initializing PostgreSQL database...').start();
  
  try {
    if (!process.env.DATABASE_URL) {
      spinner.fail('DATABASE_URL environment variable not set');
      console.log(chalk.yellow('\nSet DATABASE_URL in your .env file:'));
      console.log(chalk.cyan('DATABASE_URL=postgresql://user:password@localhost:5432/gitwhy\n'));
      process.exit(1);
    }
    
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    
    // Read and execute migration SQL
    const migrationPath = path.join(__dirname, '../../migrations/001_create_graph_tables.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(sql);
    await pool.end();
    
    spinner.succeed('Database initialized successfully');
    console.log(chalk.gray('  Tables created: commits, dependencies, contexts, embeddings'));
    console.log(chalk.gray('  Indexes created for fast BFS traversal'));
    
  } catch (err) {
    spinner.fail('Database initialization failed');
    console.error(chalk.red(err.message));
    process.exit(1);
  }
}

async function migrateToPostgres() {
  const spinner = ora('Migrating from JSON to PostgreSQL...').start();
  
  try {
    if (!process.env.DATABASE_URL) {
      spinner.fail('DATABASE_URL environment variable not set');
      process.exit(1);
    }
    
    // Load data from JSON
    spinner.text = 'Loading data from JSON files...';
    const graph = jsonStore.loadGraph();
    
    if (graph.nodes.length === 0) {
      spinner.info('No data to migrate - graph is empty');
      return;
    }
    
    spinner.text = `Migrating ${graph.nodes.length} nodes and ${graph.edges.length} edges...`;
    
    // Initialize PostgreSQL pool
    pgStore.initPool();
    
    // Save to PostgreSQL
    await pgStore.saveGraph(graph);
    
    spinner.succeed(`Migration complete: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
    
    console.log(chalk.green('\n✓ Data migrated successfully'));
    console.log(chalk.gray('  To use PostgreSQL, set: GITWHY_USE_POSTGRES=true'));
    console.log(chalk.gray('  JSON files are preserved as backup\n'));
    
    await pgStore.closePool();
    
  } catch (err) {
    spinner.fail('Migration failed');
    console.error(chalk.red(err.message));
    process.exit(1);
  }
}

async function migrateToJson() {
  const spinner = ora('Exporting from PostgreSQL to JSON...').start();
  
  try {
    if (!process.env.DATABASE_URL) {
      spinner.fail('DATABASE_URL environment variable not set');
      process.exit(1);
    }
    
    // Load from PostgreSQL
    spinner.text = 'Loading data from PostgreSQL...';
    pgStore.initPool();
    const graph = await pgStore.loadGraph();
    
    if (graph.nodes.length === 0) {
      spinner.info('No data to export - database is empty');
      return;
    }
    
    spinner.text = `Exporting ${graph.nodes.length} nodes and ${graph.edges.length} edges...`;
    
    // Save to JSON
    jsonStore.saveGraph(graph);
    
    spinner.succeed(`Export complete: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
    console.log(chalk.green('\n✓ Data exported to JSON files\n'));
    
    await pgStore.closePool();
    
  } catch (err) {
    spinner.fail('Export failed');
    console.error(chalk.red(err.message));
    process.exit(1);
  }
}

async function showStats() {
  console.log(chalk.bold('\nStorage Statistics\n'));
  
  // Check which backend is active
  const usePostgres = process.env.GITWHY_USE_POSTGRES === 'true';
  console.log(chalk.gray('Active backend:'), chalk.cyan(usePostgres ? 'PostgreSQL' : 'JSON'));
  
  // JSON stats
  try {
    const graph = jsonStore.loadGraph();
    const jsonSize = fs.statSync(path.join(process.cwd(), '.gitwhy', 'dependency-graph.json')).size;
    
    console.log(chalk.bold('\nJSON Storage:'));
    console.log(chalk.gray('  Nodes:'), graph.nodes.length);
    console.log(chalk.gray('  Edges:'), graph.edges.length);
    console.log(chalk.gray('  File size:'), (jsonSize / 1024).toFixed(2), 'KB');
    
    if (graph.nodes.length > 0) {
      const avgFiles = graph.nodes.reduce((sum, n) => sum + n.files.length, 0) / graph.nodes.length;
      console.log(chalk.gray('  Avg files/commit:'), avgFiles.toFixed(2));
    }
  } catch (err) {
    console.log(chalk.yellow('  JSON storage not available'));
  }
  
  // PostgreSQL stats
  if (process.env.DATABASE_URL) {
    try {
      pgStore.initPool();
      const stats = await pgStore.getGraphStats();
      
      console.log(chalk.bold('\nPostgreSQL Storage:'));
      console.log(chalk.gray('  Nodes:'), stats.node_count);
      console.log(chalk.gray('  Edges:'), stats.edge_count);
      console.log(chalk.gray('  Avg files/commit:'), parseFloat(stats.avg_files_per_commit).toFixed(2));
      console.log(chalk.gray('  Commits table size:'), stats.commits_size);
      console.log(chalk.gray('  Dependencies table size:'), stats.dependencies_size);
      
      await pgStore.closePool();
    } catch (err) {
      console.log(chalk.yellow('\n  PostgreSQL not available:', err.message));
    }
  } else {
    console.log(chalk.yellow('\n  PostgreSQL not configured (set DATABASE_URL)'));
  }
  
  console.log('');
}
