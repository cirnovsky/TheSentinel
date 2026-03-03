export default function PostView({ post }) {
  if (!post) {
    return (
      <section className="post-view empty">
        <p>Select a post to read.</p>
      </section>
    );
  }

  return (
    <section className="post-view">
      <h2>{post.title}</h2>
      <p className="meta">{post.author} · {post.publishedAt}</p>
      {post.tags?.length ? <p className="tags">Tags: {post.tags.join(', ')}</p> : null}
      <article>
        {post.content.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </article>
    </section>
  );
}
