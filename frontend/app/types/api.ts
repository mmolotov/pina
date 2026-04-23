export interface ApiErrorPayload {
  error?: string;
  message?: string;
}

export interface UserDto {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  instanceRole: "USER" | "ADMIN";
  active: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserDto;
}

export interface SessionSnapshot extends AuthResponse {
  receivedAt: number;
}

export interface HealthResponse {
  status: string;
  storage: {
    type: string;
    usedBytes: number;
    availableBytes: number;
  };
}

export type RegistrationMode = "OPEN" | "INVITE_ONLY" | "CLOSED";
export type CompressionFormat = "jpeg" | "jpg" | "png";

export interface PhotoVariantDto {
  type: string;
  format: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface PhotoDto {
  id: string;
  uploaderId: string;
  originalFilename: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  personalLibraryId: string;
  exifData: string | null;
  takenAt: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  variants: PhotoVariantDto[];
}

export interface PhotoGeoBounds {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

export interface PhotoGeoSearchParams extends PhotoGeoBounds {
  page?: number;
  size?: number;
  needsTotal?: boolean;
}

export interface PhotoNearbySearchParams {
  lat: number;
  lng: number;
  radiusKm: number;
  page?: number;
  size?: number;
  needsTotal?: boolean;
}

export interface AlbumDto {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  personalLibraryId: string | null;
  spaceId: string | null;
  createdAt: string;
  updatedAt: string;
  coverPhotoId: string | null;
  coverVariants: PhotoVariantDto[];
  photoCount: number;
  mediaRangeStart: string | null;
  mediaRangeEnd: string | null;
  latestPhotoAddedAt: string | null;
}

export interface SpaceDto {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  visibility: "PRIVATE" | "PUBLIC";
  parentId: string | null;
  depth: number;
  inheritMembers: boolean;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
}

export type SpaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
export type SpaceVisibility = "PRIVATE" | "PUBLIC";

export interface SpaceMemberDto {
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  role: SpaceRole;
  joinedAt: string;
}

export interface InviteLinkDto {
  id: string;
  code: string;
  defaultRole: SpaceRole;
  expiration: string | null;
  usageLimit: number | null;
  usageCount: number;
  active: boolean;
  createdById: string | null;
  createdAt: string;
}

export interface InviteLinkInfoDto {
  spaceName: string;
  spaceDescription: string | null;
  defaultRole: SpaceRole;
}

export type FavoriteTargetType = "PHOTO" | "ALBUM" | "VIDEO";

export interface FavoriteDto {
  id: string;
  userId: string;
  targetType: FavoriteTargetType;
  targetId: string;
  createdAt: string;
}

export interface FavoriteStatusDto {
  favorited: boolean;
}

export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  hasNext: boolean;
  totalItems: number | null;
  totalPages: number | null;
}

export type SearchScope = "all" | "library" | "spaces" | "favorites";
export type SearchKind = "all" | "photo" | "album";
export type SearchSort = "relevance" | "newest" | "oldest";
export type SearchResultKind = "PHOTO" | "ALBUM";
export type SearchEntryScope = "LIBRARY" | "SPACES";

export interface SearchPhotoHitDto {
  photo: PhotoDto;
  albumId: string | null;
  albumName: string | null;
  spaceId: string | null;
  spaceName: string | null;
}

export interface SearchAlbumHitDto {
  album: AlbumDto;
  spaceId: string | null;
  spaceName: string | null;
}

export interface SearchHitDto {
  kind: SearchResultKind;
  entryScope: SearchEntryScope;
  favorited: boolean;
  photo: SearchPhotoHitDto | null;
  album: SearchAlbumHitDto | null;
}

export interface SearchMediaParams {
  q: string;
  scope?: SearchScope;
  kind?: SearchKind;
  sort?: SearchSort;
  page?: number;
  size?: number;
  needsTotal?: boolean;
}

export interface AdminUserDto {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  instanceRole: "USER" | "ADMIN";
  active: boolean;
  createdAt: string;
  updatedAt: string;
  providers: string[];
  photoCount: number;
  storageBytesUsed: number;
}

export interface AdminSpaceDto {
  id: string;
  name: string;
  description: string | null;
  visibility: SpaceVisibility;
  parentId: string | null;
  depth: number;
  creatorId: string;
  creatorName: string;
  memberCount: number;
  albumCount: number;
  photoCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminInviteLinkDto {
  id: string;
  code: string;
  spaceId: string;
  spaceName: string;
  defaultRole: SpaceRole;
  expiration: string | null;
  usageLimit: number | null;
  usageCount: number;
  active: boolean;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface AdminHealthDto {
  status: string;
  version: string;
  database: {
    connected: boolean;
    version: string | null;
  };
  storage: {
    provider: string;
    usedBytes: number;
    availableBytes: number;
  };
  jvm: {
    heapUsedBytes: number;
    heapMaxBytes: number;
    nonHeapUsedBytes: number;
    availableProcessors: number;
  };
}

export interface AdminStorageSummaryDto {
  storageProvider: string;
  totalPhotos: number;
  totalVariants: number;
  totalStorageBytes: number;
  filesystemUsedBytes: number;
  filesystemAvailableBytes: number;
}

export interface AdminUserStorageDto {
  userId: string;
  userName: string;
  photoCount: number;
  variantCount: number;
  storageBytesUsed: number;
}

export interface AdminSpaceStorageDto {
  spaceId: string;
  spaceName: string;
  albumCount: number;
  photoCount: number;
}

export interface AdminSettingsDto {
  registrationMode: RegistrationMode;
  compressionFormat: CompressionFormat;
  compressionQuality: number;
  compressionMaxResolution: number;
}
