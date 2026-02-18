import { Step, Steps as FumaSteps } from "fumadocs-ui/components/steps";
import { Children, isValidElement, type ReactNode } from "react";

export { Step };

export function Steps({ children }: { children?: ReactNode }) {
  // Detect if children is an <ol> with <li> items (from numbered markdown lists)
  // and wrap each <li> content in a fumadocs <Step>
  const childArray = Children.toArray(children);
  const firstChild = childArray[0];

  if (
    isValidElement(firstChild) &&
    (firstChild as React.ReactElement<{ children?: ReactNode }>).type === "ol"
  ) {
    const olChildren = Children.toArray(
      (firstChild as React.ReactElement<{ children?: ReactNode }>).props
        .children,
    );
    return (
      <FumaSteps>
        {olChildren.map((li, i) => {
          if (isValidElement(li)) {
            return (
              <Step key={i}>
                {(li as React.ReactElement<{ children?: ReactNode }>).props
                  .children}
              </Step>
            );
          }
          return null;
        })}
      </FumaSteps>
    );
  }

  return <FumaSteps>{children}</FumaSteps>;
}
