'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { COUNCIL_FIXTURE } from '@/lib/council-fixture';

type Language = 'en' | 'vi';

const fixtureByLanguage = {
  en: {
    label: 'CONTENT REFERENCE',
    title: 'Council content reference',
    description: 'The shape of a council: the question, the advisor viewpoints, and the synthesis the Chair returns.',
    open: 'Open the workspace',
    intro: 'The shape of a council: the question, the advisor viewpoints, and the synthesis the Chair returns.',
    lenses: 'Viewpoint lenses',
    fixed: 'reference text',
    output: 'Council output',
    synthesis: 'Council synthesis',
    language: 'Language',
  },
  vi: {
    label: 'THAM CHIẾU NỘI DUNG',
    title: 'Nội dung hội đồng dùng chung',
    description: 'Hình dạng của một hội đồng: câu hỏi, các góc nhìn của cố vấn, và bản tổng hợp Ghế chủ tọa trả về.',
    open: 'Mở không gian làm việc',
    intro: 'Hình dạng của một hội đồng: câu hỏi, các góc nhìn của cố vấn, và bản tổng hợp Ghế chủ tọa trả về.',
    lenses: 'Các góc nhìn',
    fixed: 'văn bản tham chiếu',
    output: 'Kết quả hội đồng',
    synthesis: 'Tổng hợp hội đồng',
    language: 'Ngôn ngữ',
  },
} as const;

const translatedFixture = {
  en: COUNCIL_FIXTURE,
  vi: {
    question: 'Câu hỏi tham chiếu dùng để minh họa định dạng kết quả hội đồng.',
    advisors: [
      {
        name: 'Góc nhìn A',
        text: 'Văn bản tham chiếu nêu giả định, tiêu chí xem lại và bằng chứng còn thiếu.',
      },
      {
        name: 'Góc nhìn B',
        text: 'Văn bản tham chiếu mở ra một góc nhìn khác, với đánh đổi và phụ thuộc riêng.',
      },
      {
        name: 'Góc nhìn C',
        text: 'Văn bản tham chiếu hỏi bằng chứng nào sẽ thay đổi việc xem lại, và khi nào cần dừng lại.',
      },
    ],
    synthesis: 'Đây là tham chiếu để xem hình dạng một khuyến nghị của hội đồng. Bản thật do các cố vấn tạo ra trong phiên làm việc.',
  },
} as const;

export default function FixturePage() {
  const [language, setLanguage] = useState<Language>('en');
  const copy = fixtureByLanguage[language];
  const fixture = translatedFixture[language];

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === 'vi' ? 'Zero Council — Tham chiếu nội dung' : 'Zero Council — Content reference';
    document.querySelector('meta[name="description"]')?.setAttribute('content', fixtureByLanguage[language].description);
  }, [language]);

  return (
    <main lang={language} className="mx-auto w-full max-w-5xl space-y-8 px-5 py-10 sm:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-sm font-semibold tracking-widest text-brass">ZERO COUNCIL · {copy.label}</p>
          <h1 className="mt-2 font-serif text-3xl text-ink">{copy.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-border p-1" role="group" aria-label={copy.language}>
            {(['en', 'vi'] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={`min-h-11 rounded-full px-3 text-sm transition ${language === item ? 'bg-brass text-white' : 'text-ink-muted hover:bg-background hover:text-ink'}`}
                aria-pressed={language === item}
                onClick={() => setLanguage(item)}
              >
                {item === 'en' ? 'English' : 'Tiếng Việt'}
              </button>
            ))}
          </div>
          <Link href="/" className="inline-flex min-h-11 items-center rounded-full border border-border px-4 py-2 text-sm text-ink transition hover:border-brass/50">
            {copy.open}
          </Link>
        </div>
      </header>

      <p className="max-w-3xl text-lg leading-relaxed text-ink-muted">{copy.intro}</p>

      <section className="grid gap-6 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <aside className="space-y-4 rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-serif text-xl text-ink">{copy.lenses}</h2>
          <ul className="space-y-3 text-sm text-ink-muted">
            {fixture.advisors.map((advisor) => (
              <li key={advisor.name}>{advisor.name} <span>· {copy.fixed}</span></li>
            ))}
          </ul>
        </aside>

        <section className="space-y-5" aria-labelledby="fixture-heading">
          <h2 id="fixture-heading" className="font-serif text-xl text-ink">{copy.output}</h2>
          <blockquote className="rounded-2xl border border-border bg-surface p-6 text-ink">
            {fixture.question}
          </blockquote>
          {fixture.advisors.map((advisor) => (
            <article key={advisor.name} className="rounded-2xl border border-border bg-surface p-5">
              <h3 className="font-semibold text-ink">{advisor.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{advisor.text}</p>
            </article>
          ))}
          <article className="rounded-2xl border-2 border-brass p-5">
            <h3 className="font-semibold text-ink">{copy.synthesis}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{fixture.synthesis}</p>
          </article>
        </section>
      </section>
    </main>
  );
}
