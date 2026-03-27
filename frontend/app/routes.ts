import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("*", "routes/catch-all.tsx"),
] satisfies RouteConfig;
