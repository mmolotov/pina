import type { Route } from "./+types/app-trash";
import { CollectionPlaceholder } from "~/routes/app-collection-placeholder";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Trash | PINA" }];
}

export default function AppTrashRoute() {
  return <CollectionPlaceholder kind="trash" />;
}
