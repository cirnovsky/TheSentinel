function parseFrontMatter(raw, fallbackId) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  const metadataBlock = match ? match[1] : '';
  const contentStart = match ? match[0].length : 0;
  const metadata = {};

  metadataBlock.split('\n').forEach((line) => {
    const [key, ...rest] = line.split(':');
    if (!key || rest.length === 0) return;
    metadata[key.trim()] = rest.join(':').trim();
  });

  const body = raw.slice(contentStart).trim();
  const paragraphs = body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, ' ').trim())
    .filter(Boolean);

  return {
    id: metadata.id || fallbackId,
    title: metadata.title || fallbackId,
    author: metadata.author || 'Unknown',
    publishedAt: metadata.publishedAt || '1970-01-01',
    tags: (metadata.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean),
    content: paragraphs,
  };
}

export function getAllPosts() {
  const modules = import.meta.glob('../../database/posts/*.md', {
    eager: true,
    query: '?raw',
    import: 'default',
  });

  return Object.entries(modules)
    .map(([path, raw]) => {
      const fallbackId = path.split('/').pop().replace('.md', '');
      return parseFrontMatter(raw, fallbackId);
    })
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}
