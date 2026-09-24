import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Scroll, Search, Trash2, PlusCircle, Calendar } from 'lucide-react';

export const SessionsListView: React.FC = () => {
  const { sessions, setCurrentSessionId, setCurrentView, purgeSessions } = useApp();
  const [search, setSearch] = useState('');

  const filteredSessions = sessions.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.referenceCode.toLowerCase().includes(search.toLowerCase()) ||
      s.framework.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenSession = (id: string) => {
    setCurrentSessionId(id);
    setCurrentView('session-concluded');
  };

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brass" />
            <span className="text-xs font-mono text-brass font-medium">Mock Session Archive</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl text-ink font-normal mt-1">
            Archived Council Sessions
          </h1>
          <p className="text-xs text-ink-muted">
            Sample session list held in transient browser state; reload resets it.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentView('empty-chamber')}
            type="button"
            className="px-4 py-2 rounded-md bg-brass text-background font-medium text-xs hover:bg-brass/90 transition-colors shadow-xs flex items-center gap-2"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Mock Session</span>
          </button>
        </div>
      </div>

      {/* Search & Stats Bar */}
      <div className="p-4 rounded-lg bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <label htmlFor="session-search" className="sr-only">
            Search sample sessions
          </label>
          <input
            id="session-search"
            name="session-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by dilemma, code (D-882), or framework..."
            className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-md text-xs text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-brass transition-colors"
          />
        </div>

        <div className="flex items-center gap-4 text-xs text-ink-muted">
          <span>{filteredSessions.length} sample sessions in memory</span>
          {sessions.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Reset all in-memory sample sessions?')) {
                  purgeSessions();
                }
              }}
              type="button"
              className="text-terracotta hover:underline flex items-center gap-1 text-[11px]"
            >
              <Trash2 className="w-3 h-3" />
              <span>Reset Sample Vault</span>
            </button>
          )}
        </div>
      </div>

      {/* Sessions Grid */}
      {filteredSessions.length === 0 ? (
        <div className="p-12 text-center rounded-lg bg-surface border border-border space-y-3">
          <Scroll className="w-8 h-8 text-ink-muted mx-auto" />
          <h3 className="font-serif text-lg text-ink font-normal">No Deliberations Found</h3>
          <p className="text-xs text-ink-muted max-w-sm mx-auto">
            No sample deliberations match your search criteria. Start a new mock session to explore the flow.
          </p>
          <button
            onClick={() => setCurrentView('empty-chamber')}
            type="button"
            className="px-4 py-2 rounded-md bg-brass text-background text-xs font-medium hover:bg-brass/90 transition-colors inline-block mt-2"
          >
            Start New Session
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => handleOpenSession(session.id)}
              className="w-full text-left p-5 rounded-lg bg-surface border border-border hover:border-brass/50 transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-brass font-medium px-2 py-0.5 rounded-md bg-background border border-border">
                    {session.referenceCode}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-background text-ink-muted border border-border">
                    {session.framework}
                  </span>
                  <span className="text-[11px] text-ink-muted flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {session.relativeTime}
                  </span>
                </div>

                <h3 className="font-serif text-base text-ink font-normal group-hover:text-brass transition-colors leading-snug truncate">
                  {session.title}
                </h3>

                <p className="text-xs text-ink-muted line-clamp-1">
                  {session.summary}
                </p>
              </div>

              {/* Right Side: Advisors pills & open button */}
              <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                <div className="flex -space-x-1.5 overflow-hidden">
                  <div className="w-5 h-5 rounded-full bg-persona-sage border-2 border-surface" title="The Pragmatist" />
                  <div className="w-5 h-5 rounded-full bg-persona-rose border-2 border-surface" title="The Dreamer" />
                  <div className="w-5 h-5 rounded-full bg-persona-slate border-2 border-surface" title="The Skeptic" />
                </div>
                <span className="text-xs px-2.5 py-1 rounded-md bg-background text-ink border border-border group-hover:bg-brass group-hover:text-background font-medium transition-colors">
                  Review
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
