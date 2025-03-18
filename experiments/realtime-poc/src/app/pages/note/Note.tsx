import { Editor } from "./Editor";
import { getContent } from "./functions";
import { RouteContext } from "redwoodsdk/router";

const Note = async (ctx: RouteContext) => {
  console.log("######### Note", ctx.params.key);
  const key = ctx.params.key;
  const content = await getContent(key, ctx);
  console.log("## giving key", key);
  return <Editor props={{ initialContent: content, key }} />;
};

export default Note;
