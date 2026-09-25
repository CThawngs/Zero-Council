import React from 'react';
import { useApp } from '../context/AppContext';
import { DecisionFramework } from '../types';
import { Check, GitBranch, Layers, Sliders } from 'lucide-react';
import { Modal } from './Modal';

export const FrameworkModal: React.FC = () => {
  const { isFrameworkModalOpen, closeFrameworkModal, currentSession, setCurrentFramework, t } = useApp();
  const frameworks = [
    { id: 'Good / Normal / Bad Scenarios' as const, title: t.scenarioTitle, body: t.scenarioBody, tag: t.scenarioTag, icon: GitBranch },
    { id: 'Six Thinking Hats' as const, title: t.hatsTitle, body: t.hatsBody, tag: t.hatsTag, icon: Layers },
    { id: 'Decision Matrix' as const, title: t.matrixTitle, body: t.matrixBody, tag: t.matrixTag, icon: Sliders },
  ];
  const select = (id: DecisionFramework) => { setCurrentFramework(id); closeFrameworkModal(); };

  return (
    <Modal
      isOpen={isFrameworkModalOpen}
      onClose={closeFrameworkModal}
      title={t.frameworkSelectTitle}
      description={t.frameworkSelectBody}
      closeLabel={t.close}
      footer={<button type="button" onClick={closeFrameworkModal} className="button-secondary min-h-11">{t.close}</button>}
    >
      <div className="grid gap-3">
        {frameworks.map(({ id, title, body, tag, icon: Icon }) => {
          const selected = currentSession.framework === id;
          return <button key={id} type="button" onClick={() => select(id)} aria-pressed={selected} className={`option-card text-left ${selected ? 'option-card-selected' : ''}`}><div className="flex items-start gap-3"><span className="icon-tile shrink-0"><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><h3 className="min-w-0 break-words font-medium text-ink">{title}</h3>{selected && <span className="badge-success shrink-0"><Check className="h-3 w-3" />{t.selected}</span>}</div><p className="mt-2 text-xs leading-relaxed text-ink-muted">{body}</p><span className="badge-neutral mt-3 inline-flex">{tag}</span></div></div></button>;
        })}
      </div>
    </Modal>
  );
};
