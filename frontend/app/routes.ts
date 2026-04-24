import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("join/:code", "routes/join-invite.tsx"),
  route("s/album/:token", "routes/public-album.tsx"),
  route("app", "routes/app-layout.tsx", [
    index("routes/app-index.tsx"),
    route("overview", "routes/app-home.tsx"),
    route("admin", "routes/app-admin-layout.tsx", [
      index("routes/app-admin-index.tsx"),
      route("users", "routes/app-admin-users.tsx"),
      route("spaces", "routes/app-admin-spaces.tsx"),
      route("invites", "routes/app-admin-invites.tsx"),
      route("storage", "routes/app-admin-storage.tsx"),
      route("health", "routes/app-admin-health.tsx"),
      route("settings", "routes/app-admin-settings.tsx"),
    ]),
    route("library", "routes/app-library.tsx"),
    route("library/albums/:albumId", "routes/app-album-detail.tsx"),
    route(
      "library/albums/:albumId/photos/:photoId",
      "routes/app-album-photo-detail.tsx",
    ),
    route("library/photos/:photoId", "routes/app-photo-detail.tsx"),
    route("search", "routes/app-search.tsx"),
    route("favorites", "routes/app-favorites.tsx"),
    route("recent", "routes/app-recent.tsx"),
    route("videos", "routes/app-videos.tsx"),
    route("trash", "routes/app-trash.tsx"),
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
