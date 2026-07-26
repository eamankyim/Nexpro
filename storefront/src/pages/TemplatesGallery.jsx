import { Link } from 'react-router-dom';
import { ArrowRight, LayoutTemplate } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { STORE_TEMPLATES, getTemplateTheme } from '../templates/registry';
import { ABS_APP_URL, TEMPLATES_GALLERY_HOST } from '../config';

const absUseTemplateUrl = (templateId) => {
  const path = `/online-store?template=${encodeURIComponent(templateId)}`;
  return `${ABS_APP_URL}${path}`;
};

/**
 * Public Online Store template gallery (templates.absghana.com or /templates).
 */
export default function TemplatesGallery() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dcfce733,transparent_40%),linear-gradient(180deg,#f8fafc,#eef2ff)] text-slate-950">
      <header className="border-b border-slate-200 bg-white/90">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800">
              <LayoutTemplate className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">ABS Online Store</p>
              <h1 className="text-lg font-bold">Template gallery</h1>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Host: <span className="font-mono text-slate-900">{TEMPLATES_GALLERY_HOST}</span>
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Choose a storefront layout</h2>
          <p className="mt-3 text-base leading-7 text-slate-600">
            Preview five single-shop layouts for your Online Store. Each template is a merchant-owned shop with your branding.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {STORE_TEMPLATES.map((template) => {
            const theme = getTemplateTheme(template.id);
            return (
              <article
                key={template.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <div
                  className={`relative h-36 overflow-hidden border-b border-slate-200 ${theme.shellClass}`}
                  style={{ '--store-accent': template.previewAccent }}
                >
                  <div className={`absolute inset-4 ${theme.heroClass}`} style={{ backgroundColor: `${template.previewAccent}22` }}>
                    <div className="flex h-full flex-col justify-end p-3">
                      <div className="h-2 w-16 rounded-full" style={{ backgroundColor: template.previewAccent }} />
                      <div className="mt-2 h-2 w-24 rounded-full bg-slate-300/80" />
                      <div className={`mt-3 ${theme.dense ? 'grid grid-cols-4 gap-1' : 'grid grid-cols-3 gap-1.5'}`}>
                        {[0, 1, 2, 3].slice(0, theme.dense ? 4 : 3).map((i) => (
                          <div key={i} className={`bg-white/80 ${theme.productCardClass} h-8`} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex flex-wrap gap-1.5">
                    {template.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="rounded-full border-slate-200 bg-slate-50 text-slate-700">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <h3 className="mt-3 text-xl font-semibold">{template.name}</h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{template.tagline}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button variant="outline" asChild>
                      <Link to={`/templates/${encodeURIComponent(template.id)}/preview`}>Preview</Link>
                    </Button>
                    <Button className="bg-emerald-700 hover:bg-emerald-800" asChild>
                      <a href={absUseTemplateUrl(template.id)}>
                        Use this template
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}
