import stylesUrl from "./style.css?url";

export const Head: React.FC = () => <>
  <title>Billable: Billing Made Simple. Period.</title>
  <link rel="stylesheet" href={stylesUrl} />
</>;
