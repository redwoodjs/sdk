import { allPosts } from "content-collections";

export const Home = () => {
  const post = allPosts[0];
  return (
    <div>
      <h1>{post.title}</h1>
      <p>{post.summary}</p>
      <div dangerouslySetInnerHTML={{ __html: post.body }} />
    </div>
  );
};
