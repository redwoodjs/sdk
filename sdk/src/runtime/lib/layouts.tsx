import { RequestInfo } from "../requestInfo/types";
import { LayoutProps } from "./router";
import { isClientReference } from "./clientReferences";
import { RouteComponent } from "./router";
import { getPublicRequestInfo } from "../requestInfo/publicRequestInfo";

const composeLayouts = (
  requestInfo: RequestInfo,
  layouts: React.FC<LayoutProps>[],
) => {
  return layouts.reduceRight((WrappedComponent, Layout) => {
    const LayoutWrappedComponent = (props: LayoutProps) => {
      return (
        <Layout
          {...props}
          {...(isClientReference(Layout) ? { requestInfo } : {})}
          children={<WrappedComponent {...props} />}
        />
      );
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

  const CompositeLayout = composeLayouts(requestInfo, layouts);

  // context(justinvdm, 21 aug 2025): React type defs here aren't aware of RSC
  // components being able to return promises
  const CastComponent = Component as React.FC<any>;

  const LayoutWrappedComponent = (propsWithRequestInfo: RequestInfo) => {
    console.log("propsWithRequestInfo", propsWithRequestInfo);
    const componentProps = isRouteClientComponent
      ? getPublicRequestInfo(propsWithRequestInfo)
      : propsWithRequestInfo;

    return <CompositeLayout children={<CastComponent {...componentProps} />} />;
  };

  return LayoutWrappedComponent;
};
