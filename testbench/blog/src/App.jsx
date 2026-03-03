import { useMemo, useState } from 'react';
import PostList from './components/PostList';
import PostView from './components/PostView';
import { getAllPosts } from './lib/posts';

export default function App() {
  const posts = useMemo(() => getAllPosts(), []);
  const [selectedPostId, setSelectedPostId] = useState(posts[0]?.id ?? null);

  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? null;

  return (
    <main className="layout">
      <header className="header">
        <h1>Mini Blog Testbench</h1>
        <p>Simple React blog for agent testing.</p>
      </header>

      <div className="content">
        <PostList posts={posts} selectedPostId={selectedPostId} onSelectPost={setSelectedPostId} />
        <PostView post={selectedPost} />
      </div>
    </main>
  );
}
