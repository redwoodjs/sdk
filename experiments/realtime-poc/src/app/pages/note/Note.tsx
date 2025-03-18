import { Editor } from "./Editor";
import { getContent } from "./functions";
import { RouteContext } from "redwoodsdk/router";

const Note = async (ctx: RouteContext) => {
  const key = ctx.params.key;
  const content = await getContent(key, ctx);
  return <Editor initialContent={content} key={key} />;
};

export default Note;
