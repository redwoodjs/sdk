import { Step, Steps as FumaSteps } from "fumadocs-ui/components/steps";
import { Children, isValidElement, type ReactNode, type ReactElement } from "react";

export { Step };

interface ElementWithChildren {
  children?: ReactNode;
}

function getChildren(element: ReactElement): ReactNode {
  return (element.props as ElementWithChildren).children;
}

export function Steps({ children }: { children?: ReactNode }) {
  // Detect if children is an <ol> with <li> items (from numbered markdown lists)
  // and wrap each <li> content in a fumadocs <Step>
  const childArray = Children.toArray(children);
  const firstChild = childArray[0];

  if (isValidElement(firstChild) && firstChild.type === "ol") {
    const olChildren = Children.toArray(getChildren(firstChild));
    return (
      <FumaSteps>
        {olChildren.map((li, i) => {
          if (isValidElement(li)) {
            return <Step key={i}>{getChildren(li)}</Step>;
          }
          return null;
        })}
      </FumaSteps>
    );
  }

  return <FumaSteps>{children}</FumaSteps>;
}
