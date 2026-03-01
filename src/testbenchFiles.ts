const rawFiles = import.meta.glob('../testbench/blog/**/*.{md,js,jsx,ts,tsx,css,html,json,sh,py,txt}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

export const TESTBENCH_BLOG_FILES: Record<string, string> = Object.fromEntries(
  Object.entries(rawFiles).map(([path, content]) => [path.replace(/^\.\.\//, ''), content]),
);

export const DEFAULT_BLOG_FILE = 'testbench/blog/README.md';
