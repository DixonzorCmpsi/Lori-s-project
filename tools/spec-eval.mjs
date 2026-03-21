#!/usr/bin/env node
/**
 * spec-eval.mjs — Determinism evaluation harness for Digital Call Board specs
 *
 * This is the "prepare.py" equivalent. IMMUTABLE. The autoresearch agent CANNOT modify this file.
 *
 * Usage:
 *   node tools/spec-eval.mjs                          # Evaluate all specs
 *   node tools/spec-eval.mjs spec/SPEC-002-auth.md    # Evaluate one spec
 *
 * Output: TSV to stdout (spec, composite_score, weasel, ambiguity, constraint_density, error_coverage, missing_schemas, uncovered_behaviors)
 * Lower composite_score is better (like val_bpb).
 */

import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

// ============================================================
// METRIC 1: Weasel Word Count (lower is better)
// Words that introduce subjectivity or ambiguity
// ============================================================
const WEASEL_WORDS = [
  'should', 'could', 'may', 'might', 'typically', 'usually',
  'probably', 'generally', 'often', 'sometimes', 'perhaps',
  'ideally', 'arguably', 'likely', 'roughly', 'approximately',
  'etc\\.', 'and so on', 'and more', 'among others',
  'as needed', 'if needed', 'if necessary', 'if applicable',
  'consider', 'you might want', 'it would be nice',
];

function countWeaselWords(content) {
  // Strip code blocks (SQL, pseudocode, YAML, etc.) — weasel words in code are fine
  const stripped = content.replace(/```[\s\S]*?```/g, '');
  // Strip inline code
  const noInline = stripped.replace(/`[^`]+`/g, '');
  // Strip quoted strings (error messages, dialog text)
  const noQuotes = noInline.replace(/"[^"]*"/g, '').replace(/'[^']*'/g, '');
  // Strip the Goals/Non-Goals/Immutable Constraints sections (locked, can't change)
  const noLocked = noQuotes.replace(/## Goals \(Immutable\)[\s\S]*?(?=\n---)/g, '')
                           .replace(/## Non-Goals[\s\S]*?(?=\n## )/g, '')
                           .replace(/## Immutable Constraints[\s\S]*?(?=\n---)/g, '');

  let count = 0;
  const matches = [];
  for (const word of WEASEL_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const found = noLocked.match(regex);
    if (found) {
      count += found.length;
      matches.push(`${word}(${found.length})`);
    }
  }
  return { count, matches };
}

// ============================================================
// METRIC 2: Ambiguity Patterns (lower is better)
// Patterns that suggest multiple valid implementations
// ============================================================
const AMBIGUITY_PATTERNS = [
  { pattern: /\b(\w+)\s+or\s+(\w+)\b(?!\s*\))/gi, name: 'X-or-Y choice' },
  { pattern: /\b(some|various|different|multiple|several)\s+(ways?|methods?|approaches?|options?)/gi, name: 'vague-plural' },
  { pattern: /\b(for example|e\.g\.|such as)\b/gi, name: 'example-not-exhaustive' },
  { pattern: /\b(optionally|optional)\b/gi, name: 'optional-behavior' },
  { pattern: /\b(up to|at least|around|about)\s+\d/gi, name: 'approximate-number' },
  { pattern: /\b(similar to|like|analogous)\b/gi, name: 'comparison-not-spec' },
  { pattern: /\b(TBD|TODO|TBC|to be determined|to be decided)\b/gi, name: 'unresolved' },
];

function countAmbiguities(content) {
  // Strip code blocks and locked sections
  const stripped = content.replace(/```[\s\S]*?```/g, '')
                          .replace(/## Goals \(Immutable\)[\s\S]*?(?=\n---)/g, '')
                          .replace(/## Non-Goals[\s\S]*?(?=\n## )/g, '')
                          .replace(/## Immutable Constraints[\s\S]*?(?=\n---)/g, '');
  // Strip table header separator rows (---|---|---)
  const noTableSep = stripped.replace(/^\|[-:|]+\|$/gm, '');

  let count = 0;
  const matches = [];
  for (const { pattern, name } of AMBIGUITY_PATTERNS) {
    const found = noTableSep.match(pattern);
    if (found) {
      // Filter out false positives in "X or Y"
      const filtered = found.filter(m => {
        const lower = m.toLowerCase();
        // Allow "or" in SQL constraints, role enums, type unions
        if (/check|in \(|role|type|'.*or.*'/.test(lower)) return false;
        // Allow "or" in error messages and behavioral outcomes
        if (/error|message|returns?|rejected|invalid|expired|deleted/i.test(lower)) return false;
        // Allow "or" in auth-related phrases (password or OAuth, login or register)
        if (/password|oauth|login|register|email|verified|cookie|session/i.test(lower)) return false;
        // Allow "or" in deployment alternatives (prod or dev, supabase or local)
        if (/prod|dev|local|supabase|vercel|docker|self-hosted/i.test(lower)) return false;
        // Allow "or" in exact/logical disjunctions (is_deleted or is_cancelled)
        if (/is_|\.|\bif\b|\bwhen\b/i.test(lower)) return false;
        return true;
      });
      count += filtered.length;
      if (filtered.length > 0) matches.push(`${name}(${filtered.length})`);
    }
  }
  return { count, matches };
}

// ============================================================
// METRIC 3: Constraint Density (higher is better)
// Ratio of MUST/MUST NOT statements to total prose lines
// ============================================================
function measureConstraintDensity(content) {
  const lines = content.split('\n').filter(l => l.trim().length > 0 && !l.startsWith('```') && !l.startsWith('|'));
  const mustLines = lines.filter(l => /\bMUST\b/.test(l) || /\bMUST NOT\b/.test(l));
  return lines.length > 0 ? mustLines.length / lines.length : 0;
}

// ============================================================
// METRIC 4: Error Coverage (higher is better)
// Ratio of HTTP status codes to behavioral statements
// ============================================================
function measureErrorCoverage(content) {
  const stripped = content.replace(/```[\s\S]*?```/g, '');

  // Count behavioral verbs (things that produce a response)
  const behaviors = stripped.match(/\b(returns?|responds?|redirects?|rejects?|blocks?|fails?|denied|forbidden|unauthorized)\b/gi);
  const behaviorCount = behaviors ? behaviors.length : 0;

  // Count HTTP status codes
  const statusCodes = stripped.match(/\b[1-5]\d{2}\b/g);
  const codeCount = statusCodes ? statusCodes.length : 0;

  // Count specific error code strings
  const errorStrings = stripped.match(/\b(VALIDATION_ERROR|UNAUTHORIZED|FORBIDDEN|NOT_FOUND|CONFLICT|PAYLOAD_TOO_LARGE|RATE_LIMITED|INTERNAL_ERROR)\b/g);
  const errorStringCount = errorStrings ? errorStrings.length : 0;

  const totalErrorSignals = codeCount + errorStringCount;
  return behaviorCount > 0 ? Math.min(totalErrorSignals / behaviorCount, 1.0) : 0;
}

// ============================================================
// METRIC 5: Schema Completeness (lower missing count is better)
// Tables mentioned in prose that lack a CREATE TABLE definition
// ============================================================
function checkSchemaCompleteness(content) {
  // Find all table names mentioned in prose (backtick-wrapped + "table")
  const tableMentions = new Set();
  const mentionRegex = /`(\w+)`\s+table/gi;
  let match;
  while ((match = mentionRegex.exec(content)) !== null) {
    tableMentions.add(match[1].toLowerCase());
  }

  // Also find table names in FROM/JOIN/INTO/REFERENCES clauses within SQL blocks only
  const sqlBlocks = content.match(/```sql[\s\S]*?```/g) || [];
  for (const block of sqlBlocks) {
    const sqlRefs = /(?:FROM|JOIN|INTO|REFERENCES)\s+(\w+)/gi;
    while ((match = sqlRefs.exec(block)) !== null) {
      const name = match[1].toLowerCase();
      // Filter out SQL keywords and common false positives
      const ignore = ['select', 'set', 'where', 'and', 'or', 'not', 'null', 'true', 'false',
                       'begin', 'commit', 'end', 'new', 'now', 'interval', 'expired', 'id',
                       'cascade', 'unique', 'check', 'default', 'index', 'on', 'function',
                       'trigger', 'before', 'update', 'each', 'row', 'execute', 'returns',
                       'language', 'plpgsql', 'boolean', 'text', 'uuid', 'timestamptz',
                       'integer', 'date', 'time', 'primary', 'key', 'a', 'the', 'as'];
      if (!ignore.includes(name) && name.length > 2) {
        tableMentions.add(name);
      }
    }
  }

  // Find all CREATE TABLE definitions
  const createTables = new Set();
  const createRegex = /CREATE TABLE (\w+)/gi;
  while ((match = createRegex.exec(content)) !== null) {
    createTables.add(match[1].toLowerCase());
  }

  // Tables mentioned but not defined (in THIS spec — cross-spec refs are OK)
  const missing = [...tableMentions].filter(t => !createTables.has(t));

  return { mentioned: [...tableMentions], defined: [...createTables], missing };
}

// ============================================================
// METRIC 6: Uncovered Behaviors (lower is better)
// Behavioral statements without a test scenario ID nearby
// ============================================================
function countUncoveredBehaviors(content) {
  // Find all test scenario IDs defined in the spec
  const testIds = new Set();
  const idRegex = /\b([A-Z]+-\d{2})\b/g;
  let match;
  while ((match = idRegex.exec(content)) !== null) {
    testIds.add(match[1]);
  }

  // Count behavioral requirements that don't reference a test ID
  const lines = content.split('\n');
  let uncovered = 0;
  for (const line of lines) {
    if (/\bMUST\b/.test(line) && !line.startsWith('#') && !line.startsWith('|')) {
      // Check if this line or nearby lines reference a test ID
      const hasTestRef = /\b[A-Z]+-\d{2}\b/.test(line);
      if (!hasTestRef) uncovered++;
    }
  }

  return { testIds: testIds.size, uncoveredMusts: uncovered };
}

// ============================================================
// COMPOSITE SCORE (lower is better)
// ============================================================
function computeCompositeScore(metrics) {
  const {
    weaselCount,
    ambiguityCount,
    constraintDensity,
    errorCoverage,
    missingSchemaCount,
    uncoveredBehaviors,
  } = metrics;

  // Weights calibrated so a perfect spec scores ~0 and a bad spec scores ~200+
  return (
    (weaselCount * 8) +           // Each weasel word costs 8 points
    (ambiguityCount * 5) +         // Each ambiguity costs 5 points
    (missingSchemaCount * 15) +    // Each missing schema costs 15 points
    (uncoveredBehaviors * 2) -     // Each uncovered MUST costs 2 points
    (constraintDensity * 200) -    // High constraint density is rewarded
    (errorCoverage * 80)           // High error coverage is rewarded
  );
}

// ============================================================
// MAIN
// ============================================================
function evaluateSpec(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const name = basename(filePath);

  const weasel = countWeaselWords(content);
  const ambiguity = countAmbiguities(content);
  const constraintDensity = measureConstraintDensity(content);
  const errorCoverage = measureErrorCoverage(content);
  const schema = checkSchemaCompleteness(content);
  const behaviors = countUncoveredBehaviors(content);

  const composite = computeCompositeScore({
    weaselCount: weasel.count,
    ambiguityCount: ambiguity.count,
    constraintDensity,
    errorCoverage,
    missingSchemaCount: schema.missing.length,
    uncoveredBehaviors: behaviors.uncoveredMusts,
  });

  return {
    name,
    composite: Math.round(composite * 100) / 100,
    weaselCount: weasel.count,
    weaselMatches: weasel.matches,
    ambiguityCount: ambiguity.count,
    ambiguityMatches: ambiguity.matches,
    constraintDensity: Math.round(constraintDensity * 1000) / 1000,
    errorCoverage: Math.round(errorCoverage * 1000) / 1000,
    missingSchemas: schema.missing,
    testIds: behaviors.testIds,
    uncoveredMusts: behaviors.uncoveredMusts,
  };
}

// Run
const specDir = join(process.cwd(), 'spec');
const args = process.argv.slice(2);

let files;
if (args.length > 0) {
  files = args;
} else {
  files = readdirSync(specDir)
    .filter(f => f.startsWith('SPEC-') && f.endsWith('.md'))
    .sort()
    .map(f => join(specDir, f));
}

console.log('spec\tcomposite\tweasel\tambiguity\tconstraint_density\terror_coverage\tmissing_schemas\tuncovered_musts');

let totalComposite = 0;
for (const file of files) {
  const result = evaluateSpec(file);
  totalComposite += result.composite;

  console.log([
    result.name,
    result.composite,
    result.weaselCount,
    result.ambiguityCount,
    result.constraintDensity,
    result.errorCoverage,
    result.missingSchemas.length,
    result.uncoveredMusts,
  ].join('\t'));

  // Print details to stderr for debugging
  if (result.weaselMatches.length > 0) {
    console.error(`  ${result.name} weasels: ${result.weaselMatches.join(', ')}`);
  }
  if (result.ambiguityMatches.length > 0) {
    console.error(`  ${result.name} ambiguities: ${result.ambiguityMatches.join(', ')}`);
  }
  if (result.missingSchemas.length > 0) {
    console.error(`  ${result.name} missing schemas: ${result.missingSchemas.join(', ')}`);
  }
}

console.error(`\nTotal composite: ${Math.round(totalComposite * 100) / 100} (lower is better)`);
console.error(`Average composite: ${Math.round((totalComposite / files.length) * 100) / 100}`);
