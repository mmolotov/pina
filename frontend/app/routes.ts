import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("join/:code", "routes/join-invite.tsx"),
  route("app", "routes/app-layout.tsx", [
    index("routes/app-home.tsx"),
    route("library", "routes/app-library.tsx"),
    route("library/photos/:photoId", "routes/app-photo-detail.tsx"),
    route("search", "routes/app-search.tsx"),
    route("favorites", "routes/app-favorites.tsx"),
    route("spaces", "routes/app-spaces.tsx"),
    route("spaces/:spaceId", "routes/app-space-detail.tsx"),
    route(
      "spaces/:spaceId/albums/:albumId/photos/:photoId",
      "routes/app-space-photo-detail.tsx",
    ),
    route("settings", "routes/app-settings.tsx"),
  ]),
  route("*", "routes/catch-all.tsx"),
] satisfies RouteConfig;
