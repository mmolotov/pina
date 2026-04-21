import {
  clearSession,
  getSessionSnapshot,
  persistSession,
} from "~/lib/session";
import type {
  AlbumDto,
  AdminInviteLinkDto,
  AdminHealthDto,
  AdminSettingsDto,
  AdminSpaceDto,
  AdminSpaceStorageDto,
  AdminStorageSummaryDto,
  AdminUserDto,
  AdminUserStorageDto,
  ApiErrorPayload,
  AuthResponse,
  CompressionFormat,
  FavoriteDto,
  FavoriteStatusDto,
  FavoriteTargetType,
  HealthResponse,
  InviteLinkDto,
  InviteLinkInfoDto,
  PageResponse,
  PhotoGeoSearchParams,
  PhotoNearbySearchParams,
  PhotoDto,
  RegistrationMode,
  SearchHitDto,
  SearchMediaParams,
  SpaceDto,
  SpaceMemberDto,
  SpaceRole,
  SpaceVisibility,
  UserDto,
} from "~/types/api";

interface RequestOptions extends Omit<RequestInit, "body"> {
  auth?: boolean;
  body?: BodyInit | object | null;
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function isBackendUnavailableError(error: unknown) {
  if (error instanceof ApiError) {
    return (
      error.code === "backend_unavailable" ||
      error.status === 502 ||
      error.status === 503 ||
      error.status === 504 ||
      (error.status === 500 && error.code === "request_failed")
    );
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("load failed") ||
    message.includes("networkerror")
  );
}

let refreshPromise: Promise<AuthResponse | null> | null = null;

async function parseJson<T>(response: Response) {
  return (await response.json()) as T;
}

function isFiniteOrNull(value: unknown) {
  return value == null || (typeof value === "number" && Number.isFinite(value));
}

function validatePhotoDto(value: unknown): value is PhotoDto {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.uploaderId === "string" &&
    typeof candidate.originalFilename === "string" &&
    typeof candidate.mimeType === "string" &&
    isFiniteOrNull(candidate.width) &&
    isFiniteOrNull(candidate.height) &&
    typeof candidate.sizeBytes === "number" &&
    typeof candidate.personalLibraryId === "string" &&
    (candidate.exifData == null || typeof candidate.exifData === "string") &&
    (candidate.takenAt == null || typeof candidate.takenAt === "string") &&
    isFiniteOrNull(candidate.latitude) &&
    isFiniteOrNull(candidate.longitude) &&
    typeof candidate.createdAt === "string" &&
    Array.isArray(candidate.variants)
  );
}

function validatePhotoPageResponse(
  value: unknown,
): value is PageResponse<PhotoDto> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    Array.isArray(candidate.items) &&
    candidate.items.every(validatePhotoDto) &&
    typeof candidate.page === "number" &&
    typeof candidate.size === "number" &&
    typeof candidate.hasNext === "boolean"
  );
}

function buildQuery(
  params: Record<string, string | number | boolean | null | undefined>,
) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value == null) {
      continue;
    }
    searchParams.set(key, String(value));
  }

  return searchParams.toString();
}

function buildHeaders(options: RequestOptions, accessToken?: string) {
  const headers = new Headers(options.headers);

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  retried = false,
): Promise<T> {
  const session = getSessionSnapshot();
  let response: Response;

  try {
    response = await fetch(`/api/v1${path}`, {
      ...options,
      headers: buildHeaders(
        options,
        options.auth ? session?.accessToken : undefined,
      ),
      body:
        options.body &&
        !(options.body instanceof FormData) &&
        typeof options.body !== "string"
          ? JSON.stringify(options.body)
          : (options.body ?? undefined),
    });
  } catch {
    throw new ApiError(
      503,
      "backend_unavailable",
      "Backend is unavailable. Check that the server is running and try again.",
    );
  }

  if (response.status === 401 && options.auth && !retried) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return request<T>(path, options, true);
    }
  }

  if (!response.ok) {
    let payload: ApiErrorPayload | null = null;

    try {
      payload = await parseJson<ApiErrorPayload>(response);
    } catch {
      payload = null;
    }

    throw new ApiError(
      response.status,
      payload?.error ?? "request_failed",
      payload?.message ?? `Request failed with status ${response.status}`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return parseJson<T>(response);
}

async function requestBlob(
  path: string,
  options: RequestOptions = {},
  retried = false,
) {
  const session = getSessionSnapshot();
  let response: Response;

  try {
    response = await fetch(`/api/v1${path}`, {
      ...options,
      headers: buildHeaders(
        options,
        options.auth ? session?.accessToken : undefined,
      ),
      body:
        options.body &&
        !(options.body instanceof FormData) &&
        typeof options.body !== "string"
          ? JSON.stringify(options.body)
          : (options.body ?? undefined),
    });
  } catch {
    throw new ApiError(
      503,
      "backend_unavailable",
      "Backend is unavailable. Check that the server is running and try again.",
    );
  }

  if (response.status === 401 && options.auth && !retried) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return requestBlob(path, options, true);
    }
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      "file_download_failed",
      "Failed to load file.",
    );
  }

  return response.blob();
}

async function refreshSession() {
  const session = getSessionSnapshot();
  if (!session?.refreshToken) {
    clearSession();
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = request<AuthResponse>("/auth/refresh", {
      method: "POST",
      body: { refreshToken: session.refreshToken },
    })
      .then((authResponse) => {
        persistSession(authResponse);
        return authResponse;
      })
      .catch(() => {
        clearSession();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export function getHealth() {
  return request<HealthResponse>("/health");
}

export function register(input: {
  username: string;
  password: string;
  name: string;
}) {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: input,
  });
}

export function login(input: { username: string; password: string }) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: input,
  });
}

export function logout() {
  const session = getSessionSnapshot();
  if (!session?.refreshToken) {
    clearSession();
    return Promise.resolve();
  }

  return request<void>("/auth/logout", {
    method: "POST",
    body: { refreshToken: session.refreshToken },
  }).finally(() => {
    clearSession();
  });
}

export function getCurrentUser() {
  return request<UserDto>("/auth/me", { auth: true });
}

export function listAdminUsers(params: {
  page?: number;
  size?: number;
  needsTotal?: boolean;
  search?: string;
}) {
  return request<PageResponse<AdminUserDto>>(
    `/admin/users?${buildQuery({
      page: params.page ?? 0,
      size: params.size ?? 20,
      needsTotal: params.needsTotal ?? true,
      search: params.search?.trim() || null,
    })}`,
    { auth: true },
  );
}

export function getAdminUser(userId: string) {
  return request<AdminUserDto>(`/admin/users/${userId}`, { auth: true });
}

export function updateAdminUser(
  userId: string,
  input: { instanceRole?: "USER" | "ADMIN" | null; active?: boolean | null },
) {
  return request<AdminUserDto>(`/admin/users/${userId}`, {
    auth: true,
    method: "PUT",
    body: input,
  });
}

export function listAdminSpaces(params: {
  page?: number;
  size?: number;
  needsTotal?: boolean;
  search?: string;
}) {
  return request<PageResponse<AdminSpaceDto>>(
    `/admin/spaces?${buildQuery({
      page: params.page ?? 0,
      size: params.size ?? 20,
      needsTotal: params.needsTotal ?? true,
      search: params.search?.trim() || null,
    })}`,
    { auth: true },
  );
}

export function getAdminSpace(spaceId: string) {
  return request<AdminSpaceDto>(`/admin/spaces/${spaceId}`, { auth: true });
}

export function deleteAdminSpace(spaceId: string) {
  return request<void>(`/admin/spaces/${spaceId}`, {
    auth: true,
    method: "DELETE",
  });
}

export function listAdminInvites(params: {
  page?: number;
  size?: number;
  needsTotal?: boolean;
  spaceId?: string | null;
  active?: boolean | null;
}) {
  return request<PageResponse<AdminInviteLinkDto>>(
    `/admin/invites?${buildQuery({
      page: params.page ?? 0,
      size: params.size ?? 20,
      needsTotal: params.needsTotal ?? true,
      spaceId: params.spaceId?.trim() || null,
      active: params.active ?? null,
    })}`,
    { auth: true },
  );
}

export function revokeAdminInvite(inviteId: string) {
  return request<void>(`/admin/invites/${inviteId}`, {
    auth: true,
    method: "DELETE",
  });
}

export function getAdminHealth() {
  return request<AdminHealthDto>("/admin/health", { auth: true });
}

export function getAdminSettings() {
  return request<AdminSettingsDto>("/admin/settings", { auth: true });
}

export function updateAdminSettings(input: {
  registrationMode: RegistrationMode;
  compressionFormat: CompressionFormat;
  compressionQuality: number;
  compressionMaxResolution: number;
}) {
  return request<AdminSettingsDto>("/admin/settings", {
    auth: true,
    method: "PUT",
    body: input,
  });
}

export function getAdminStorageSummary() {
  return request<AdminStorageSummaryDto>("/admin/storage", { auth: true });
}

export function listAdminStorageUsers(params: {
  page?: number;
  size?: number;
  needsTotal?: boolean;
}) {
  return request<PageResponse<AdminUserStorageDto>>(
    `/admin/storage/users?${buildQuery({
      page: params.page ?? 0,
      size: params.size ?? 10,
      needsTotal: params.needsTotal ?? true,
    })}`,
    { auth: true },
  );
}

export function listAdminStorageSpaces(params: {
  page?: number;
  size?: number;
  needsTotal?: boolean;
}) {
  return request<PageResponse<AdminSpaceStorageDto>>(
    `/admin/storage/spaces?${buildQuery({
      page: params.page ?? 0,
      size: params.size ?? 10,
      needsTotal: params.needsTotal ?? true,
    })}`,
    { auth: true },
  );
}

export function updateCurrentUser(input: {
  name: string;
  email: string | null;
}) {
  return request<UserDto>("/auth/me", {
    auth: true,
    method: "PUT",
    body: input,
  });
}

export function listPhotos(page = 0, size = 24) {
  return request<PageResponse<PhotoDto>>(
    `/photos?page=${page}&size=${size}&needsTotal=true`,
    {
      auth: true,
    },
  );
}

async function listAllPages<T>(
  fetchPage: (page: number, size: number) => Promise<PageResponse<T>>,
  size = 100,
) {
  const items: T[] = [];
  let page = 0;

  while (true) {
    const response = await fetchPage(page, size);
    items.push(...response.items);

    if (!response.hasNext || response.items.length === 0) {
      return items;
    }

    page += 1;
  }
}

export async function listAllPhotos(size = 100) {
  return listAllPages(listPhotos, size);
}

export async function listGeoPhotos(params: PhotoGeoSearchParams) {
  const payload = await request<unknown>(
    `/photos/geo?${buildQuery({
      swLat: params.swLat,
      swLng: params.swLng,
      neLat: params.neLat,
      neLng: params.neLng,
      page: params.page ?? 0,
      size: params.size ?? 100,
      needsTotal: params.needsTotal ?? true,
    })}`,
    { auth: true },
  );

  if (!validatePhotoPageResponse(payload)) {
    throw new ApiError(
      500,
      "invalid_response",
      "Geo photo response is not valid.",
    );
  }

  return payload;
}

export async function listNearbyGeoPhotos(params: PhotoNearbySearchParams) {
  const payload = await request<unknown>(
    `/photos/geo/nearby?${buildQuery({
      lat: params.lat,
      lng: params.lng,
      radiusKm: params.radiusKm,
      page: params.page ?? 0,
      size: params.size ?? 100,
      needsTotal: params.needsTotal ?? true,
    })}`,
    { auth: true },
  );

  if (!validatePhotoPageResponse(payload)) {
    throw new ApiError(
      500,
      "invalid_response",
      "Nearby geo photo response is not valid.",
    );
  }

  return payload;
}

export function getPhoto(photoId: string) {
  return request<PhotoDto>(`/photos/${photoId}`, { auth: true });
}

export async function getPhotoBlob(photoId: string, variant = "COMPRESSED") {
  return requestBlob(`/photos/${photoId}/file?variant=${variant}`, {
    auth: true,
  });
}

export async function getSpaceAlbumPhotoBlob(
  spaceId: string,
  albumId: string,
  photoId: string,
  variant = "COMPRESSED",
) {
  return requestBlob(
    `/spaces/${spaceId}/albums/${albumId}/photos/${photoId}/file?variant=${variant}`,
    {
      auth: true,
    },
  );
}

function listAlbumsPage(page = 0, size = 100) {
  return request<PageResponse<AlbumDto>>(
    `/albums?page=${page}&size=${size}&needsTotal=true`,
    { auth: true },
  );
}

export function listAlbums(size = 100) {
  return listAllPages(listAlbumsPage, size);
}

export function listSpaces() {
  return request<SpaceDto[]>("/spaces", { auth: true });
}

export function getSpace(spaceId: string) {
  return request<SpaceDto>(`/spaces/${spaceId}`, { auth: true });
}

export function createSpace(input: {
  name: string;
  description: string;
  visibility: SpaceVisibility;
}) {
  return request<SpaceDto>("/spaces", {
    auth: true,
    method: "POST",
    body: input,
  });
}

function listSpaceMembersPage(spaceId: string, page = 0, size = 100) {
  return request<PageResponse<SpaceMemberDto>>(
    `/spaces/${spaceId}/members?page=${page}&size=${size}&needsTotal=true`,
    {
      auth: true,
    },
  );
}

export function listSpaceMembers(spaceId: string, size = 100) {
  return listAllPages(
    (page, pageSize) => listSpaceMembersPage(spaceId, page, pageSize),
    size,
  );
}

export function addSpaceMember(
  spaceId: string,
  input: { userId: string; role: SpaceRole },
) {
  return request<void>(`/spaces/${spaceId}/members`, {
    auth: true,
    method: "POST",
    body: input,
  });
}

export function changeSpaceMemberRole(
  spaceId: string,
  userId: string,
  role: SpaceRole,
) {
  return request<SpaceMemberDto>(`/spaces/${spaceId}/members/${userId}`, {
    auth: true,
    method: "PUT",
    body: { role },
  });
}

export function removeSpaceMember(spaceId: string, userId: string) {
  return request<void>(`/spaces/${spaceId}/members/${userId}`, {
    auth: true,
    method: "DELETE",
  });
}

export function listSubspaces(spaceId: string) {
  return request<SpaceDto[]>(`/spaces/${spaceId}/subspaces`, { auth: true });
}

export function createSubspace(
  spaceId: string,
  input: { name: string; description: string; visibility: SpaceVisibility },
) {
  return request<SpaceDto>(`/spaces/${spaceId}/subspaces`, {
    auth: true,
    method: "POST",
    body: input,
  });
}

function listSpaceAlbumsPage(spaceId: string, page = 0, size = 100) {
  return request<PageResponse<AlbumDto>>(
    `/spaces/${spaceId}/albums?page=${page}&size=${size}&needsTotal=true`,
    { auth: true },
  );
}

export function listSpaceAlbums(spaceId: string, size = 100) {
  return listAllPages(
    (page, pageSize) => listSpaceAlbumsPage(spaceId, page, pageSize),
    size,
  );
}

export function createSpaceAlbum(
  spaceId: string,
  input: { name: string; description: string },
) {
  return request<AlbumDto>(`/spaces/${spaceId}/albums`, {
    auth: true,
    method: "POST",
    body: input,
  });
}

export function updateSpaceAlbum(
  spaceId: string,
  albumId: string,
  input: { name: string; description: string },
) {
  return request<AlbumDto>(`/spaces/${spaceId}/albums/${albumId}`, {
    auth: true,
    method: "PUT",
    body: input,
  });
}

export function deleteSpaceAlbum(spaceId: string, albumId: string) {
  return request<void>(`/spaces/${spaceId}/albums/${albumId}`, {
    auth: true,
    method: "DELETE",
  });
}

export function listSpaceAlbumPhotos(
  spaceId: string,
  albumId: string,
  page = 0,
  size = 100,
) {
  return request<PageResponse<PhotoDto>>(
    `/spaces/${spaceId}/albums/${albumId}/photos?page=${page}&size=${size}&needsTotal=true`,
    {
      auth: true,
    },
  );
}

export async function listAllSpaceAlbumPhotos(
  spaceId: string,
  albumId: string,
  size = 100,
) {
  return listAllPages(
    (page, pageSize) => listSpaceAlbumPhotos(spaceId, albumId, page, pageSize),
    size,
  );
}

export function addPhotoToSpaceAlbum(
  spaceId: string,
  albumId: string,
  photoId: string,
) {
  return request<void>(
    `/spaces/${spaceId}/albums/${albumId}/photos/${photoId}`,
    {
      auth: true,
      method: "POST",
    },
  );
}

export function removePhotoFromSpaceAlbum(
  spaceId: string,
  albumId: string,
  photoId: string,
) {
  return request<void>(
    `/spaces/${spaceId}/albums/${albumId}/photos/${photoId}`,
    {
      auth: true,
      method: "DELETE",
    },
  );
}

function listSpaceInvitesPage(spaceId: string, page = 0, size = 100) {
  return request<PageResponse<InviteLinkDto>>(
    `/spaces/${spaceId}/invites?page=${page}&size=${size}&needsTotal=true`,
    { auth: true },
  );
}

export function listSpaceInvites(spaceId: string, size = 100) {
  return listAllPages(
    (page, pageSize) => listSpaceInvitesPage(spaceId, page, pageSize),
    size,
  );
}

export function createSpaceInvite(
  spaceId: string,
  input: {
    defaultRole: SpaceRole;
    expiration: string | null;
    usageLimit: number | null;
  },
) {
  return request<InviteLinkDto>(`/spaces/${spaceId}/invites`, {
    auth: true,
    method: "POST",
    body: input,
  });
}

export function revokeSpaceInvite(spaceId: string, inviteId: string) {
  return request<void>(`/spaces/${spaceId}/invites/${inviteId}`, {
    auth: true,
    method: "DELETE",
  });
}

export function previewInvite(code: string) {
  return request<InviteLinkInfoDto>(`/invites/${code}`);
}

export function joinInvite(code: string) {
  return request<void>(`/invites/${code}/join`, {
    auth: true,
    method: "POST",
  });
}

export function uploadPhoto(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return request<PhotoDto>("/photos", {
    auth: true,
    method: "POST",
    body: formData,
  });
}

export function deletePhoto(photoId: string) {
  return request<void>(`/photos/${photoId}`, {
    auth: true,
    method: "DELETE",
  });
}

export function createAlbum(input: { name: string; description: string }) {
  return request<AlbumDto>("/albums", {
    auth: true,
    method: "POST",
    body: input,
  });
}

export function updateAlbum(
  albumId: string,
  input: { name: string; description: string },
) {
  return request<AlbumDto>(`/albums/${albumId}`, {
    auth: true,
    method: "PUT",
    body: input,
  });
}

export function deleteAlbum(albumId: string) {
  return request<void>(`/albums/${albumId}`, {
    auth: true,
    method: "DELETE",
  });
}

export function listAlbumPhotos(albumId: string, page = 0, size = 100) {
  return request<PageResponse<PhotoDto>>(
    `/albums/${albumId}/photos?page=${page}&size=${size}&needsTotal=true`,
    {
      auth: true,
    },
  );
}

export async function listAllAlbumPhotos(albumId: string, size = 100) {
  return listAllPages(
    (page, pageSize) => listAlbumPhotos(albumId, page, pageSize),
    size,
  );
}

export function addPhotoToAlbum(albumId: string, photoId: string) {
  return request<void>(`/albums/${albumId}/photos/${photoId}`, {
    auth: true,
    method: "POST",
  });
}

export function removePhotoFromAlbum(albumId: string, photoId: string) {
  return request<void>(`/albums/${albumId}/photos/${photoId}`, {
    auth: true,
    method: "DELETE",
  });
}

export function addFavorite(targetType: FavoriteTargetType, targetId: string) {
  return request<void>("/favorites", {
    auth: true,
    method: "POST",
    body: { targetType, targetId },
  });
}

export function removeFavorite(favoriteId: string) {
  return request<void>(`/favorites/${favoriteId}`, {
    auth: true,
    method: "DELETE",
  });
}

function listFavoritesPage(
  targetType?: FavoriteTargetType,
  page = 0,
  size = 100,
) {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    needsTotal: "true",
  });

  if (targetType) {
    params.set("type", targetType);
  }

  return request<PageResponse<FavoriteDto>>(`/favorites?${params.toString()}`, {
    auth: true,
  });
}

export function listFavorites(targetType?: FavoriteTargetType, size = 100) {
  return listAllPages(
    (page, pageSize) => listFavoritesPage(targetType, page, pageSize),
    size,
  );
}

export function checkFavorite(
  targetType: FavoriteTargetType,
  targetId: string,
) {
  return request<FavoriteStatusDto>(
    `/favorites/check?targetType=${targetType}&targetId=${targetId}`,
    { auth: true },
  );
}

export function searchMedia(params: SearchMediaParams) {
  return request<PageResponse<SearchHitDto>>(
    `/search?${buildQuery({
      q: params.q,
      scope: params.scope,
      kind: params.kind,
      sort: params.sort,
      page: params.page ?? 0,
      size: params.size ?? 24,
      needsTotal: params.needsTotal ?? true,
    })}`,
    { auth: true },
  );
}
