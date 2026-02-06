import {
  Server,
  Globe,
  Cog,
  Code,
  Package,
  GitBranch,
  FileCode,
  Lightbulb,
  FolderTree,
  AlertTriangle,
  Smartphone,
  Monitor,
  GitPullRequest,
  Bug,
  Sparkles,
  Target
} from 'lucide-react';

// Service type icon mapping
export const serviceTypeIcons: Record<string, React.ElementType> = {
  backend: Server,
  frontend: Globe,
  worker: Cog,
  scraper: Code,
  library: Package,
  proxy: GitBranch,
  mobile: Smartphone,
  desktop: Monitor,
  unknown: FileCode
};

// Service type color mapping
export const serviceTypeColors: Record<string, string> = {
  backend: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  frontend: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  worker: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  scraper: 'bg-green-500/10 text-green-400 border-green-500/30',
  library: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  proxy: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  mobile: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  desktop: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  unknown: 'bg-muted text-muted-foreground border-muted'
};

// Memory type icon mapping
export const memoryTypeIcons: Record<string, React.ElementType> = {
  session_insight: Lightbulb,
  codebase_discovery: FolderTree,
  codebase_map: FolderTree,
  pattern: Code,
  gotcha: AlertTriangle,
  task_outcome: Target,
  qa_result: Target,
  historical_context: Lightbulb,
  pr_review: GitPullRequest,
  pr_finding: Bug,
  pr_pattern: Sparkles,
  pr_gotcha: AlertTriangle
};

// Memory type colors for badges and styling
export const memoryTypeColors: Record<string, string> = {
  session_insight: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  codebase_discovery: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  codebase_map: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  pattern: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  gotcha: 'bg-red-500/10 text-red-400 border-red-500/30',
  task_outcome: 'bg-green-500/10 text-green-400 border-green-500/30',
  qa_result: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
  historical_context: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  pr_review: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  pr_finding: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  pr_pattern: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  pr_gotcha: 'bg-red-500/10 text-red-400 border-red-500/30'
};

// Filter category keys (labels resolved via i18n: context:memory.filters.*)
export const MEMORY_FILTER_KEYS = ['all', 'pr', 'sessions', 'codebase', 'patterns', 'gotchas'] as const;

// Filter categories for grouping memory types (types only, labels via i18n)
export const memoryFilterTypes: Record<string, string[]> = {
  all: [],
  pr: ['pr_review', 'pr_finding', 'pr_pattern', 'pr_gotcha'],
  sessions: ['session_insight', 'task_outcome', 'qa_result', 'historical_context'],
  codebase: ['codebase_discovery', 'codebase_map'],
  patterns: ['pattern', 'pr_pattern'],
  gotchas: ['gotcha', 'pr_gotcha']
};
