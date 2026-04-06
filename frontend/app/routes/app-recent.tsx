import type { Route } from "./+types/app-recent";
import { CollectionPlaceholder } from "~/routes/app-collection-placeholder";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Recent | PINA" }];
}

export default function AppRecentRoute() {
  return <CollectionPlaceholder kind="recent" />;
}
