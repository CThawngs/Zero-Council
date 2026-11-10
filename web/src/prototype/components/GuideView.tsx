import React from 'react';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { GUIDE } from '../data/guide';

export const GuideView: React.FC = () => {
  const { setCurrentView, language, t } = useApp();
  const sections = GUIDE[language];

  const back = () => {
    setCurrentView('empty-chamber');
    window.scrollTo(0, 0);
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 py-4 sm:py-8">
      <header>
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-brass">
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          {t.guideEyebrow}
        </p>
        <h1 className="mt-3 font-serif text-3xl text-ink sm:text-4xl">{t.guideTitle}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted sm:text-base">{t.guideIntro}</p>
      </header>

      {sections.map((section) => (
        <section key={section.title} className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="font-serif text-xl text-ink">{section.title}</h2>
          {section.body?.map((paragraph) => (
            <p key={paragraph} className="mt-3 text-sm leading-relaxed text-ink-muted">
              {paragraph}
            </p>
          ))}
          {section.items && (
            <ul className="mt-4 space-y-3">
              {section.items.map((item) => (
                <li key={item.label} className="flex gap-3 text-sm leading-relaxed">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" aria-hidden="true" />
                  <span className="min-w-0 text-ink-muted">
                    <span className="font-semibold text-ink">{item.label}.</span> {item.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <div className="flex justify-end">
        <button type="button" onClick={back} className="button-primary min-h-11 w-full justify-center sm:w-auto">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t.guideBack}
        </button>
      </div>
    </div>
  );
};
