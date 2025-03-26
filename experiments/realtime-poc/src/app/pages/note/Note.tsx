import { Editor } from "./Editor";
import { getContent } from "./functions";
import { RouteOptions } from "@redwoodjs/sdk/router";

const Note = async (opts: RouteOptions) => {
  const { params } = opts;
  const key = params.key;
  const content = await getContent(key, opts);
  return <Editor props={{ initialContent: content, key }} />;
};

export default Note;
