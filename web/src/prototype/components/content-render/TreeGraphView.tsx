'use client';

/**
 * Interactive collapsible ASCII/Markdown tree graph viewer for ContentRenderPanel.
 */

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, GitFork } from 'lucide-react';
import { countTreeNodes, parseTree, type TreeNode } from '../../chat/content-render';
import { copy } from '../../i18n';
import { useOptionalApp } from '../../context/AppContext';

const collectBranchIds = (nodes: TreeNode[]): string[] => {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.children.length > 0) {
      ids.push(node.id);
      ids.push(...collectBranchIds(node.children));
    }
  }
  return ids;
};

const TreeNodeItem: React.FC<{
  node: TreeNode;
  depth: number;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
}> = ({ node, depth, collapsed, onToggle }) => {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.id);

  return (
    <li className="relative">
      <div className="flex items-center gap-1.5 py-1">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            aria-expanded={!isCollapsed}
            aria-label={node.label}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border bg-surface text-ink-muted transition hover:border-brass hover:text-ink"
          >
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            )}
          </button>
        ) : (
          <span
            aria-hidden="true"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-brass/70" />
          </span>
        )}
        <span className="rounded-md border border-border/80 bg-surface px-2 py-0.5 font-mono text-xs text-ink">
          {node.label}
        </span>
        {node.meta && (
          <span className="rounded-full bg-brass/10 px-2 py-0.5 text-[11px] font-medium text-brass">
            {node.meta}
          </span>
        )}
      </div>
      {hasChildren && !isCollapsed && (
        <ul className="ml-3 border-l border-border/80 pl-3.5">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              collapsed={collapsed}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export const TreeGraphView: React.FC<{
  raw: string;
  nodes?: TreeNode[];
  compact?: boolean;
}> = ({ raw, nodes: preParsed, compact = false }) => {
  const app = useOptionalApp();
  const t = app?.t ?? copy.en;
  const nodes = useMemo(() => preParsed ?? parseTree(raw), [preParsed, raw]);
  const branchIds = useMemo(() => collectBranchIds(nodes), [nodes]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const totalCount = useMemo(() => countTreeNodes(nodes), [nodes]);

  const toggleNode = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (nodes.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface-2/60 px-3 py-2 text-xs text-ink-muted">
        {t.contentPanelNoTree}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background/85">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-2/80 px-3 py-1.5 text-[11px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5 font-medium text-ink">
          <GitFork className="h-3.5 w-3.5 text-brass" aria-hidden="true" />
          {t.contentPanelTreeCount.replace('{count}', String(totalCount))}
        </span>
        {branchIds.length > 0 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCollapsed(new Set())}
              className="min-h-7 rounded px-2 py-0.5 transition hover:bg-brass/10 hover:text-ink"
            >
              {t.contentPanelExpandAll}
            </button>
            <button
              type="button"
              onClick={() => setCollapsed(new Set(branchIds))}
              className="min-h-7 rounded px-2 py-0.5 transition hover:bg-brass/10 hover:text-ink"
            >
              {t.contentPanelCollapseAll}
            </button>
          </div>
        )}
      </div>
      <div className={`overflow-x-auto p-3 ${compact ? 'max-h-72' : 'max-h-[32rem]'}`}>
        <ul className="space-y-0.5">
          {nodes.map((node) => (
            <TreeNodeItem
              key={node.id}
              node={node}
              depth={0}
              collapsed={collapsed}
              onToggle={toggleNode}
            />
          ))}
        </ul>
      </div>
    </div>
  );
};
