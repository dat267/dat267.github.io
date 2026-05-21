import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

export const onRequest = defineRouteMiddleware((context) => {
  const { sidebar } = context.locals.starlightRoute;
  const toTitleCase = (str: string) =>
    str
      .split(/[-_]+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  function updateLabels(entries: any[]) {
    for (const entry of entries) {
      if (entry.type === 'group') {
        entry.label = toTitleCase(entry.label);
        if (entry.entries) {
          updateLabels(entry.entries);
        }
      }
    }
  }
  updateLabels(sidebar);
});
