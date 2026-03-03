export default function PostList({ posts, selectedPostId, onSelectPost }) {
  return (
    <aside className="post-list">
      <h2>Posts</h2>
      {posts.map((post) => (
        <button
          key={post.id}
          type="button"
          className={post.id === selectedPostId ? 'post-item active' : 'post-item'}
          onClick={() => onSelectPost(post.id)}
        >
          <span className="title">{post.title}</span>
          <span className="meta">{post.author} · {post.publishedAt}</span>
        </button>
      ))}
    </aside>
  );
}
