import { RequestInfo } from "../requestInfo/types";
import { LayoutProps } from "./router";
import { isClientReference } from "./clientReferences";
import { RouteComponent } from "./router";
import { getPublicRequestInfo } from "../requestInfo/publicRequestInfo";

const injectRequestInfo =
  (requestInfo: RequestInfo) => (Layout: React.FC<LayoutProps>) => {
    const LayoutWithRequestInfo = (props: LayoutProps) => {
      return (
        <Layout
          {...props}
          requestInfo={
            isClientReference(Layout)
              ? (getPublicRequestInfo(requestInfo) as RequestInfo)
              : requestInfo
          }
        />
      );
    };

    return LayoutWithRequestInfo;
  };

const composeLayouts = (layouts: React.FC<LayoutProps>[]) => {
  return layouts.reduceRight((WrappedComponent, Layout) => {
    const LayoutWrappedComponent = (props: LayoutProps) => {
      return <Layout {...props} children={<WrappedComponent {...props} />} />;
    };

    return LayoutWrappedComponent;
  });
};

export const wrapComponentWithLayouts = (
  requestInfo: RequestInfo,
  Component: RouteComponent,
  layouts: React.FC<LayoutProps>[],
) => {
  if (layouts.length === 0) {
    return Component;
  }

  const isRouteClientComponent = isClientReference(Component);

  const CompositeLayout = composeLayouts(
    layouts.map(injectRequestInfo(requestInfo)),
  );

  // context(justinvdm, 21 aug 2025): React type defs here aren't aware of RSC
  // components being able to return promises
  const CastComponent = Component as React.FC<any>;

  const LayoutWrappedComponent = (props: any) => (
    <CompositeLayout children={<CastComponent {...props} />} />
  );

  if (isRouteClientComponent) {
    LayoutWrappedComponent.__rwsdk__is_client_wrapped_component = true;
  }

  return LayoutWrappedComponent;
};
