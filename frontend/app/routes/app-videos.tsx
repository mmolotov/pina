import type { Route } from "./+types/app-videos";
import { CollectionPlaceholder } from "~/routes/app-collection-placeholder";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Videos | PINA" }];
}

export default function AppVideosRoute() {
  return <CollectionPlaceholder kind="videos" />;
}
