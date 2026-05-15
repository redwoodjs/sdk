export { File, Folder } from "fumadocs-ui/components/files";

export function FileTree({ children }: { children?: React.ReactNode }) {
  return <div className="fd-files">{children}</div>;
}
