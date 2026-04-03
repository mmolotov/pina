export interface ApiErrorPayload {
  error?: string;
  message?: string;
}

export interface UserDto {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
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
