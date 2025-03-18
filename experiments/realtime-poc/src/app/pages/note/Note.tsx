import { Editor } from "./Editor";
import { getContent } from "./functions";
import { RouteContext } from "redwoodsdk/router";

const Note = async (ctx: RouteContext) => {
  const key = ctx.params.key;
  const content = await getContent(key, ctx);
  console.log("### content", content);
  return <Editor props={{ initialContent: content, key }} />;
};

export default Note;
