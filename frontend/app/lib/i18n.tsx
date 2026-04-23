import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

export type Locale = "en" | "ru";

export const LOCALE_STORAGE_KEY = "pina-locale";

export const SUPPORTED_LOCALES = ["en", "ru"] as const;
type TranslationValues = Record<string, number | string>;

const enMessages = {
  "common.notAvailable": "Not available",
  "language.label": "Language",
  "language.english": "English",
  "language.russian": "Russian",
  "language.preferenceHelp": "Language preference updates immediately.",
  "role.owner": "Owner",
  "role.admin": "Admin",
  "role.member": "Member",
  "role.viewer": "Viewer",
  "public.home.phaseEyebrow": "Phase 3 Foundation",
  "public.home.login": "Log in",
  "public.home.createAccount": "Create account",
  "public.home.heroEyebrow": "Private Image Network Archive",
  "public.home.heroTitle":
    "A collaboration-ready media library, starting with auth, photos, albums, and Spaces.",
  "public.home.heroDescription":
    "The backend is already on Phase 2. This frontend foundation starts the real app shell: authentication, personal library access, and Space-aware navigation.",
  "public.home.heroPrimaryCta": "Start with a local account",
  "public.home.heroSecondaryCta": "Open the app",
  "public.home.environmentEyebrow": "Environment",
  "public.home.environmentTitle": "Backend status",
  "public.home.backendConnecting": "Connecting to backend",
  "public.home.backendConnected": "Backend connected",
  "public.home.backendUnavailable": "Backend unavailable",
  "public.home.readyTodayEyebrow": "Ready today",
  "public.home.readyTodayDescription":
    "JWT auth, refresh tokens, Google login, Spaces, invite links, shared albums, favorites.",
  "public.home.nextFrontendEyebrow": "Next in frontend",
  "public.home.nextFrontendDescription":
    "Library browsing, album flows, Space dashboards, and responsive app navigation.",
  "public.login.eyebrow": "Authentication",
  "public.login.title": "Log in to PINA",
  "public.login.description":
    "Use your existing local account to enter the app shell.",
  "public.login.username": "Username",
  "public.login.password": "Password",
  "public.login.submit": "Log in",
  "public.login.submitting": "Logging in...",
  "public.login.sessionTargetEyebrow": "Session target",
  "public.login.redirectDescription":
    "After authentication you will be redirected to {redirectTo}.",
  "public.login.backendDescription":
    "Local username/password auth is already connected to the Phase 2 backend. Google sign-in can be added on top later.",
  "public.login.needAccount": "Need an account?",
  "public.login.createOne": "Create one",
  "public.login.errorFallback": "Login failed. Please try again.",
  "public.register.eyebrow": "Local Account",
  "public.register.title": "Create your first session",
  "public.register.description":
    "Registration already works in the backend. This screen wires it into the new frontend shell.",
  "public.register.name": "Name",
  "public.register.username": "Username",
  "public.register.password": "Password",
  "public.register.submit": "Create account",
  "public.register.submitting": "Creating account...",
  "public.register.nextEyebrow": "What happens next",
  "public.register.nextCreated":
    "Your new account is created in the backend immediately.",
  "public.register.nextRedirect":
    "You are signed in and redirected to {redirectTo}.",
  "public.register.nextScope":
    "Profile editing, Spaces, albums, and favorites are already available in the current frontend phase.",
  "public.register.haveAccount": "Already registered?",
  "public.register.login": "Log in",
  "public.register.errorFallback": "Registration failed. Please try again.",
  "public.joinInvite.eyebrow": "Invite Link",
  "public.joinInvite.title": "Join Space",
  "public.joinInvite.spaceEyebrow": "Space",
  "public.joinInvite.noDescription": "No description",
  "public.joinInvite.defaultRole": "Default role",
  "public.joinInvite.sessionCanJoin":
    "Your current account can accept this invite immediately.",
  "public.joinInvite.loginFirst":
    "Log in first and then return here to join the Space.",
  "public.joinInvite.joinRoleEyebrow": "Join role",
  "public.joinInvite.sessionStateEyebrow": "Session state",
  "public.joinInvite.authenticated": "Authenticated",
  "public.joinInvite.loginRequired": "Login required",
  "public.joinInvite.joining": "Joining...",
  "public.joinInvite.joinSpace": "Join Space",
  "public.joinInvite.loginToJoin": "Log in to join",
  "public.joinInvite.backHome": "Back home",
  "public.joinInvite.loadingPreview": "Loading invite preview...",
  "public.joinInvite.errorFallback": "Failed to join invite.",
  "shell.mobileEyebrow": "Media library",
  "shell.upload": "Upload",
  "shell.menuOpen": "Menu",
  "shell.menuClose": "Close",
  "shell.navigation.open": "Open navigation",
  "shell.navigation.close": "Close navigation",
  "shell.brandEyebrow": "Private Image Network Archive",
  "shell.brandDescription":
    "Photos first, shared spaces second, admin chrome kept compact.",
  "shell.nav.photos": "Photos",
  "shell.nav.photosCaption": "Newest first",
  "shell.nav.map": "Map",
  "shell.nav.mapCaption": "Places",
  "shell.nav.spaces": "Spaces",
  "shell.nav.spacesCaption": "Shared rooms",
  "shell.nav.albums": "Albums",
  "shell.nav.albumsCaption": "Curated sets",
  "shell.nav.favorites": "Favorites",
  "shell.nav.favoritesCaption": "Saved media",
  "shell.nav.videos": "Videos",
  "shell.nav.videosCaption": "Coming next",
  "shell.nav.recent": "Recent",
  "shell.nav.recentCaption": "Fast return",
  "shell.nav.trash": "Trash",
  "shell.nav.trashCaption": "Retention later",
  "shell.nav.admin": "Admin",
  "shell.nav.adminCaption": "Instance control",
  "shell.quick.allPhotosTitle": "All photos",
  "shell.quick.allPhotosDescription":
    "Dense grid ordered from newest to oldest.",
  "shell.quick.timelineTitle": "Timeline",
  "shell.quick.timelineDescription": "Jump by day groups inside the library.",
  "shell.quick.mapTitle": "Map",
  "shell.quick.mapDescription": "Switch into place-based browsing.",
  "shell.quick.albumsTitle": "Albums",
  "shell.quick.albumsDescription": "Open curated personal collections.",
  "shell.quick.favoritesTitle": "Favorites",
  "shell.quick.favoritesDescription": "Only bookmarked media and albums.",
  "shell.quick.spacesTitle": "Spaces",
  "shell.quick.spacesDescription": "Shared collections and memberships.",
  "shell.signedInEyebrow": "Signed in",
  "shell.unknownUser": "Unknown user",
  "shell.noEmailConfigured": "No email configured",
  "shell.manageAccount": "Manage account",
  "shell.systemEyebrow": "System",
  "shell.system.backendLabel": "Backend",
  "shell.system.storageLabel": "Storage",
  "shell.system.versionLabel": "Version",
  "shell.system.checkingBackend": "Checking backend",
  "shell.system.backendConnected": "Backend connected",
  "shell.system.backendUnavailable": "Backend unavailable",
  "shell.system.storageInfoPending": "Storage info pending",
  "shell.system.waitingForBackend": "Waiting for backend",
  "shell.system.usedSuffix": "{value} used",
  "shell.system.availableSuffix": "{value} available",
  "shell.search.label": "Search media library",
  "shell.search.placeholder": "Search photos, places, people, tags",
  "shell.search.submit": "Search",
  "shell.search.openFilters": "Open filters",
  "shell.search.hideFilters": "Hide filters",
  "shell.account": "Account",
  "shell.theme.light": "Light theme",
  "shell.theme.dark": "Dark theme",
  "shell.theme.switchToDark": "Switch to dark theme",
  "shell.theme.switchToLight": "Switch to light theme",
  "shell.logout": "Log out",
  "common.clear": "Clear",
  "common.clearFilter": "Clear filter",
  "common.clearFilters": "Clear filters",
  "common.add": "Add",
  "common.remove": "Remove",
  "common.delete": "Delete",
  "common.favorite": "Favorite",
  "common.unfavorite": "Unfavorite",
  "common.name": "Name",
  "common.description": "Description",
  "common.visibility": "Visibility",
  "common.private": "Private",
  "common.public": "Public",
  "common.enabled": "Enabled",
  "common.disabled": "Disabled",
  "common.loading": "Loading...",
  "common.loadingPreview": "Loading preview...",
  "common.updating": "Updating...",
  "common.deleting": "Deleting...",
  "common.creating": "Creating...",
  "common.saving": "Saving...",
  "unit.photo.one": "photo",
  "unit.photo.few": "photos",
  "unit.photo.many": "photos",
  "unit.photo.other": "photos",
  "unit.album.one": "album",
  "unit.album.few": "albums",
  "unit.album.many": "albums",
  "unit.album.other": "albums",
  "unit.dayGroup.one": "day group",
  "unit.dayGroup.few": "day groups",
  "unit.dayGroup.many": "day groups",
  "unit.dayGroup.other": "day groups",
  "unit.geoPhoto.one": "geo-tagged photo",
  "unit.geoPhoto.few": "geo-tagged photos",
  "unit.geoPhoto.many": "geo-tagged photos",
  "unit.geoPhoto.other": "geo-tagged photos",
  "unit.match.one": "match",
  "unit.match.few": "matches",
  "unit.match.many": "matches",
  "unit.match.other": "matches",
  "unit.savedItem.one": "saved item",
  "unit.savedItem.few": "saved items",
  "unit.savedItem.many": "saved items",
  "unit.savedItem.other": "saved items",
  "unit.space.one": "Space",
  "unit.space.few": "Spaces",
  "unit.space.many": "Spaces",
  "unit.space.other": "Spaces",
  "app.library.actionUnknown": "Unknown library action.",
  "app.library.actionFailed": "Library action failed.",
  "app.library.mapLoadFailed": "Failed to load map photos.",
  "app.library.loadFailed": "Failed to load library.",
  "app.library.uploadTypeError": "Only JPEG and PNG files are supported.",
  "app.library.uploadFileFailed": "{fileName}: Photo upload failed.",
  "app.library.uploadFailed": "Photo upload failed.",
  "app.library.uploadSummarySingle": "Uploaded 1 photo.",
  "app.library.uploadSummaryPlural": "Uploaded {count} photos.",
  "app.library.uploadSummaryPartial":
    "Uploaded {uploadedCount} of {totalCount} photos.",
  "app.library.photoFavoriteFailed": "Failed to update photo favorite.",
  "app.library.albumFavoriteFailed": "Failed to update album favorite.",
  "app.library.eyebrow": "Library",
  "app.library.title": "Photos, places, and albums",
  "app.library.description":
    "Browse your personal media by day, jump to places on the map, or curate albums. Use Spaces when a collection needs members, permissions, and shared activity.",
  "app.library.toolbarTitle": "View and filter",
  "app.library.toolbarDescription":
    "Stay inside a photo-first library, switch between chronology, places, and curated albums, and keep the current filter in the URL.",
  "app.library.view.photos": "Photos",
  "app.library.view.timeline": "Timeline",
  "app.library.view.map": "Map",
  "app.library.view.albums": "Albums",
  "app.library.filterLabel": "Filter library",
  "app.library.filterPlaceholder": "Filter photos, albums, and map markers",
  "app.library.photosEyebrow": "Photos",
  "app.library.photosTitle": "Library by day",
  "app.library.timelineTitle": "Photo timeline",
  "app.library.mapTitle": "Geo map",
  "app.library.mapDescription":
    "Browse geo-tagged personal photos by the current viewport. The map state is restored from the URL for refresh and deep links.",
  "app.library.visiblePhotosByDay":
    "{count} visible photos grouped by capture day, newest first.",
  "app.library.filteringDescription":
    'Filtering the library by "{filter}" across photos, albums, and map markers.',
  "app.library.summaryLine": "{dayGroups} · {geoPhotos}",
  "app.library.clearSelection": "Clear selection",
  "app.library.worldView": "World view",
  "app.library.zoomIn": "Zoom in",
  "app.library.zoomOut": "Zoom out",
  "app.library.uploadPhotos": "Upload photos",
  "app.library.uploadingPhotos": "Uploading...",
  "app.library.mapLegendTitle": "Map legend",
  "app.library.mapLegendDescription":
    "Small markers represent a single photo. Numbered markers represent clusters; zoom in or select the cluster to inspect the assets inside it.",
  "app.library.mapLegendFilter":
    'Current filter applies to map markers too: "{filter}".',
  "app.library.panWest": "Pan west",
  "app.library.panEast": "Pan east",
  "app.library.panNorth": "Pan north",
  "app.library.panSouth": "Pan south",
  "app.library.loadingMarkers": "Loading map markers...",
  "app.library.openClusterAria": "Open map cluster with {count} photos",
  "app.library.openMarkerAria": "Open map marker for {fileName}",
  "app.library.viewportEyebrow": "Viewport",
  "app.library.viewportSouthWest": "South-west",
  "app.library.viewportNorthEast": "North-east",
  "app.library.viewportMarkers": "Markers",
  "app.library.viewportPhotosInView": "Photos in view",
  "app.library.viewportSelection": "Selection",
  "app.library.selectionCluster": "{count} photo cluster",
  "app.library.selectionSinglePhoto": "Single photo",
  "app.library.selectionNone": "Nothing selected",
  "app.library.clusterTitle": "Cluster of {count} photos",
  "app.library.clusterHint": "Zoom in to reveal individual assets",
  "app.library.zoomIntoCluster": "Zoom into cluster",
  "app.library.clusterMore":
    "{count} more photos are still inside this cluster. Zoom in to split it into smaller groups.",
  "app.library.photoSelected": "Photo selected",
  "app.library.latitude": "Latitude",
  "app.library.longitude": "Longitude",
  "app.library.taken": "Taken",
  "app.library.viewportStatus": "Viewport status",
  "app.library.visibleInViewport": "Visible in current map view",
  "app.library.visibleInViewportAndFilter":
    "Visible in current map view and filter",
  "app.library.openPhotoDetail": "Open photo detail",
  "app.library.loadingViewport": "Loading the current viewport.",
  "app.library.selectMarkerHint":
    "Select a marker to inspect the photo and jump to the detail screen.",
  "app.library.resetWorldView": "Reset to world view",
  "app.library.noGeoPhotosTitle": "No geo-tagged photos yet",
  "app.library.noGeoPhotosDescription":
    "Only photos with EXIF GPS coordinates appear on the map. Upload or import photos that contain location metadata to start browsing them here.",
  "app.library.noGeoPhotosMatchTitle":
    "No geo-tagged photos match the current filter",
  "app.library.noGeoPhotosMatchDescription":
    'No geo-tagged photos match "{filter}" in the current viewport. Clear the filter or widen the map.',
  "app.library.noGeoPhotosViewportTitle":
    "No geo-tagged photos in this viewport",
  "app.library.noGeoPhotosViewportDescription":
    "Try widening the viewport or resetting to the world view. Only photos with EXIF GPS coordinates appear on the map.",
  "app.library.dropzoneTitle":
    "Drop JPEG or PNG files here to upload them in a batch.",
  "app.library.dropzoneDescription":
    "The current frontend uploads files sequentially against the Phase 2 photo endpoint and refreshes the library once the queue finishes.",
  "app.library.uploadProgress": "Uploading {current} of {total}{fileSuffix}",
  "app.library.noPhotosTitle": "No photos uploaded",
  "app.library.noPhotosDescription":
    "Upload your first JPEG or PNG. The route now performs a real multipart upload against the backend.",
  "app.library.noPhotosMatchTitle": "No photos match the current filter",
  "app.library.noPhotosMatchDescription":
    "Try a different filename fragment or clear the current filter to see the rest of the library.",
  "app.library.timelineRailEyebrow": "Timeline rail",
  "app.library.timelineRailTitle": "Jump by date",
  "app.library.timelineRailDescription":
    "Move through the visible day groups without leaving the library grid.",
  "app.library.atGlanceEyebrow": "At a glance",
  "app.library.atGlanceVisiblePhotos": "Visible photos",
  "app.library.atGlanceDayGroups": "Day groups",
  "app.library.atGlanceAlbums": "Albums",
  "app.library.openAlbums": "Open albums",
  "app.library.createAlbumEyebrow": "Create album",
  "app.library.createAlbumTitle": "New personal album",
  "app.library.createAlbumDescription":
    "Albums are curated selections inside your library. If you need members, roles, or invite links, create a Space instead.",
  "app.library.createAlbumSubmit": "Create album",
  "app.library.albumsSpacesEyebrow": "Albums and Spaces",
  "app.library.albumsSpacesTitle": "Curate here, collaborate in Spaces",
  "app.library.albumsSpacesDescription":
    "Albums keep a personal set of photos together. Spaces add members, inherited access, invites, and shared albums for team or family workflows.",
  "app.library.openSpaces": "Open Spaces",
  "app.library.albumsEyebrow": "Albums",
  "app.library.albumsTitle": "Curated personal albums",
  "app.library.noAlbums":
    "No personal albums yet. Use the form above to create one.",
  "app.library.noAlbumsMatch": "No albums match the current filter.",
  "app.library.albumEyebrow": "Album",
  "app.library.removeAlbumFavoriteAria": "Remove {albumName} from favorites",
  "app.library.addAlbumFavoriteAria": "Add {albumName} to favorites",
  "app.library.saveAlbum": "Save album",
  "app.library.photoForAlbumAria": "Photo for album {albumName}",
  "app.library.selectPhotoToAdd": "Select photo to add",
  "app.library.allPhotosAssigned":
    "All available photos are already assigned to this album.",
  "app.library.noPhotosInAlbum": "No photos in this album yet.",
  "app.library.photoTileAria": "Open photo {fileName}",
  "app.library.photoPreviewAlt": "{fileName} preview",
  "app.library.photoTileSaved": "Saved",
  "app.library.photoTileLibrary": "Library",
  "app.library.removePhotoFavoriteAria": "Remove {fileName} from favorites",
  "app.library.addPhotoFavoriteAria": "Add {fileName} to favorites",
  "app.albumDetail.actionUnknown": "Unknown album action.",
  "app.albumDetail.actionFailed": "Album action failed.",
  "app.albumDetail.loadFailed": "Failed to load album detail.",
  "app.albumDetail.favoriteFailed": "Failed to update album favorite.",
  "app.albumDetail.uploadTypeError": "Only JPEG and PNG files are supported.",
  "app.albumDetail.uploadFileFailed": "{fileName}: Photo upload failed.",
  "app.albumDetail.uploadSummaryFull": "Added {count} uploaded photos.",
  "app.albumDetail.uploadSummaryPartial":
    "Added {uploadedCount} of {totalCount} uploaded photos.",
  "app.albumDetail.missingId": "Album id is missing.",
  "app.albumDetail.notFoundTitle": "Album not found",
  "app.albumDetail.notFoundDescription":
    "This personal album could not be found or is no longer available.",
  "app.albumDetail.eyebrow": "Album detail",
  "app.albumDetail.description":
    "Browse a single personal album by day, manage its contents, and keep timeline context visible while you move through the collection.",
  "app.albumDetail.backToAlbums": "Back to albums",
  "app.albumDetail.addPhotos": "Add photos",
  "app.albumDetail.editAlbum": "Edit album",
  "app.albumDetail.downloadAlbum": "Download",
  "app.albumDetail.shareAlbum": "Share",
  "app.albumDetail.downloadPending":
    "Album download wiring is delivered in the follow-up action task.",
  "app.albumDetail.sharePending":
    "Public share dialog wiring is delivered in the follow-up action task.",
  "app.albumDetail.coverAlt": "{albumName} cover",
  "app.albumDetail.noCover": "No album cover yet",
  "app.albumDetail.summaryEyebrow": "Album summary",
  "app.albumDetail.noDescription": "No description yet.",
  "app.albumDetail.itemCount": "Items",
  "app.albumDetail.dateRange": "Date range",
  "app.albumDetail.created": "Created",
  "app.albumDetail.updated": "Updated",
  "app.albumDetail.photosStat": "Photos",
  "app.albumDetail.daysStat": "Timeline days",
  "app.albumDetail.favoriteStat": "Favorite status",
  "app.albumDetail.favoriteSaved": "Saved",
  "app.albumDetail.favoriteIdle": "Available",
  "app.albumDetail.editEyebrow": "Edit",
  "app.albumDetail.editTitle": "Update album details",
  "app.albumDetail.saveAlbum": "Save album",
  "app.albumDetail.addPhotosEyebrow": "Add photos",
  "app.albumDetail.addPhotosTitle": "Grow this album",
  "app.albumDetail.addPhotosDescription":
    "Upload new photos straight into this album or pick from existing items in your personal library.",
  "app.albumDetail.uploadEyebrow": "Upload new",
  "app.albumDetail.uploadLabel": "JPEG or PNG files",
  "app.albumDetail.uploadingProgress":
    "Uploading {current} of {total} {fileName}",
  "app.albumDetail.libraryPickerEyebrow": "Pick existing",
  "app.albumDetail.existingPhotoLabel": "Existing personal photo",
  "app.albumDetail.selectPhoto": "Select a photo to add",
  "app.albumDetail.noAvailablePhotos":
    "All available library photos are already part of this album.",
  "app.albumDetail.addSelectedPhoto": "Add selected photo",
  "app.albumDetail.emptyTitle": "No photos in this album yet",
  "app.albumDetail.emptyDescription":
    "Use the add-photos action to upload new images or attach existing library photos to this album.",
  "app.albumDetail.removePhoto": "Remove",
  "app.albumDetail.setAsCover": "Set as cover",
  "app.albumDetail.setCoverPending":
    "Cover selection wiring is delivered in the follow-up action task.",
  "app.albumDetail.dayGroups": "day groups",
  "app.albumPhotoDetail.loadFailed": "Failed to load album photo.",
  "app.albumPhotoDetail.missingId": "Album or photo id is missing.",
  "app.albumPhotoDetail.notFound":
    "The requested album photo could not be found.",
  "app.albumPhotoDetail.eyebrow": "Album photo",
  "app.albumPhotoDetail.description":
    "Preview this album photo while keeping the surrounding album context close by. Album: {albumName}.",
  "app.albumPhotoDetail.previewAlt": "{fileName} preview",
  "app.albumPhotoDetail.backToAlbum": "Back to album",
  "app.albumPhotoDetail.backToAlbums": "Back to albums",
  "app.albumPhotoDetail.contextEyebrow": "Album context",
  "app.albumPhotoDetail.noAlbumDescription": "No album description yet.",
  "app.albumPhotoDetail.metadataEyebrow": "Metadata",
  "app.albumPhotoDetail.mimeType": "Mime type",
  "app.albumPhotoDetail.dimensions": "Dimensions",
  "app.albumPhotoDetail.size": "Size",
  "app.albumPhotoDetail.takenAt": "Taken at",
  "app.albumPhotoDetail.added": "Added",
  "app.albumPhotoDetail.metadataPayloadEyebrow": "EXIF payload",
  "app.albumPhotoDetail.noExif": "No EXIF metadata available",
  "app.photoDetail.loadFailed": "Failed to load photo.",
  "app.photoDetail.deleteFailed": "Failed to delete photo.",
  "app.photoDetail.favoriteFailed": "Failed to update favorite.",
  "app.photoDetail.downloadFailed": "Failed to download the original file.",
  "app.photoDetail.missingId": "Photo id is missing.",
  "app.photoDetail.eyebrow": "Photo viewer",
  "app.photoDetail.loadingTitle": "Loading photo",
  "app.photoDetail.description":
    "Personal library asset with an immersive preview, direct actions, and a structured metadata companion.",
  "app.photoDetail.capturePending": "Capture time pending",
  "app.photoDetail.dimensionsPending": "Dimensions pending",
  "app.photoDetail.backToLibrary": "Back to library",
  "app.photoDetail.removeFavorite": "Remove favorite",
  "app.photoDetail.addFavorite": "Add favorite",
  "app.photoDetail.deletePhoto": "Delete photo",
  "app.photoDetail.openFavorites": "Open favorites",
  "app.photoDetail.downloadOriginal": "Download original",
  "app.photoDetail.previewAlt": "Photo preview",
  "app.photoDetail.photoActionsEyebrow": "Photo actions",
  "app.photoDetail.photoActionsTitle": "Keep browsing",
  "app.photoDetail.photoActionsDescription":
    "Return to the library, save the photo, download the original, or remove it from the current collection.",
  "app.photoDetail.status": "Status",
  "app.photoDetail.statusSaved": "Saved to favorites",
  "app.photoDetail.statusLibrary": "In personal library",
  "app.photoDetail.variants": "Variants",
  "app.photoDetail.originalFileSize": "Original file size",
  "app.photoDetail.metadataEyebrow": "Metadata",
  "app.photoDetail.metadataTitle": "Capture and file details",
  "app.photoDetail.mimeType": "Mime type",
  "app.photoDetail.dimensions": "Dimensions",
  "app.photoDetail.takenAt": "Taken at",
  "app.photoDetail.added": "Added",
  "app.photoDetail.coordinates": "Coordinates",
  "app.photoDetail.metadataPayloadEyebrow": "Metadata payload",
  "app.photoDetail.metadataPayloadTitle": "Asset details",
  "app.photoDetail.noExif": "No EXIF metadata available",
  "app.photoDetail.tagsEyebrow": "Tags and notes",
  "app.photoDetail.tagsTitle": "Ready for richer metadata",
  "app.photoDetail.tagsDescription":
    "Manual tags, ML labels, people, and place chips can live in this area once search indexing and enrichment are connected.",
  "app.photoDetail.badgeSaved": "saved",
  "app.photoDetail.badgeLibrary": "library",
  "app.photoDetail.badgeUnknown": "unknown",
  "app.photoDetail.badgeGeotagged": "geotagged",
  "app.search.eyebrow": "Search",
  "app.search.title": "Discovery",
  "app.search.description":
    "Phase 3 backend search is connected for text results across your library, shared Spaces, and favorites. Face clusters and semantic ML retrieval remain later steps.",
  "app.search.backToLibrary": "Back to library",
  "app.search.browseFavorites": "Browse favorites",
  "app.search.queryLabel": "Search query",
  "app.search.queryPlaceholder": "Search by text, person, place, or tag",
  "app.search.tryExample": "Try {label}",
  "app.search.scope.all": "All scopes",
  "app.search.scope.library": "Library",
  "app.search.scope.spaces": "Spaces",
  "app.search.scope.favorites": "Favorites",
  "app.search.scope.facesLater": "Faces (Later)",
  "app.search.scope.tagsLater": "Tags (Later)",
  "app.search.currentLibrary": "Current library",
  "app.search.accessibleSpaces": "Accessible Spaces",
  "app.search.favorites": "Favorites",
  "app.search.plannedQueryTypes": "Planned query types",
  "app.search.queryType.freeText":
    "Text matching across filenames plus album names and descriptions",
  "app.search.queryType.faces":
    "Face/person search after clustering and identity linking",
  "app.search.queryType.scoped":
    "Scoped search inside personal library, favorites, or a specific Space",
  "app.search.backendRequirements": "Backend requirements",
  "app.search.backendRequirement.indexed":
    "Indexed text and tag search endpoints",
  "app.search.backendRequirement.embedding":
    "Face and embedding-aware retrieval",
  "app.search.backendRequirement.ranking":
    "Paginated result ranking with access-control filtering",
  "app.search.kind.all": "All results",
  "app.search.kind.photo": "Photos",
  "app.search.kind.album": "Albums",
  "app.search.sortLabel": "Sort",
  "app.search.sort.relevance": "Best match",
  "app.search.sort.newest": "Newest",
  "app.search.sort.oldest": "Oldest",
  "app.search.resultsTitle": "Backend results",
  "app.search.resultsDescription":
    "Results now come from the backend contract and keep personal-library or Space navigation context per hit.",
  "app.search.partialResults": "Showing {start}-{end} of {total} matches.",
  "app.search.previousPage": "Previous page",
  "app.search.nextPage": "Next page",
  "app.search.pageIndicator": "Page {page} of {totalPages}",
  "app.search.emptyTitle": "Start with a text query",
  "app.search.emptyDescription":
    "Type a query to load backend results across your library, shared Spaces, and favorites. Face search stays disabled until the dedicated API is ready.",
  "app.search.openTimelineInstead": "Open timeline instead",
  "app.search.loadingDescription": "Loading backend search results...",
  "app.search.errorUnavailable":
    "The backend is unavailable right now. Start the server and try the search again.",
  "app.search.errorBadRequest":
    "The current search parameters are not supported by the backend contract.",
  "app.search.errorGeneric": "Failed to load backend search results.",
  "app.search.noResultsDescription":
    'No backend search results match "{query}" in the current scope.',
  "app.search.personalPhotoContext": "Personal library photo",
  "app.search.spacePhotoContext": "Visible via {spaceName} / {albumName}",
  "app.favorites.eyebrow": "Favorites",
  "app.favorites.title": "Saved media",
  "app.favorites.description":
    "Saved photos and curated albums across your library and the Spaces you can access. Albums stay about curation, while Spaces stay about people, permissions, and collaboration.",
  "app.favorites.savedPhotos": "Saved photos",
  "app.favorites.curatedAlbums": "Curated albums",
  "app.favorites.curatedAlbumsDescription":
    "Personal albums and Space albums you pinned for quick return.",
  "app.favorites.albumsSpacesEyebrow": "Albums and Spaces",
  "app.favorites.albumsSpacesTitle": "Curated sets, not shared workspaces",
  "app.favorites.albumsSpacesDescription":
    "Albums keep selected photos together. Spaces add members, roles, and invite-driven sharing around those albums.",
  "app.favorites.favoritedAlbumsFromSpaces":
    "{count} currently come from Spaces.",
  "app.favorites.browseSpaces": "Browse Spaces",
  "app.favorites.view.all": "All saved",
  "app.favorites.view.photos": "Photos",
  "app.favorites.view.albums": "Albums",
  "app.favorites.filterLabel": "Filter favorites",
  "app.favorites.filterPlaceholder": "Filter favorites by text",
  "app.favorites.toolbarTitle": "Browse saved media",
  "app.favorites.toolbarDescription":
    "Switch between saved photos and albums, then narrow results by filename, album title, or Space name.",
  "app.favorites.emptyTitle": "No favorites yet",
  "app.favorites.emptyDescription":
    "Add favorites from your library or Space flows and they will appear here.",
  "app.favorites.photoFavoritesEyebrow": "Photo favorites",
  "app.favorites.photoFavoritesTitle": "Saved photo picks",
  "app.favorites.savedBadge": "{count} saved",
  "app.favorites.noFavoritePhotos": "No favorite photos yet.",
  "app.favorites.noFavoritePhotosMatch":
    "No favorite photos match the current filter.",
  "app.favorites.photoBadge": "Photo",
  "app.favorites.savedAt": "{size} · saved {date}",
  "app.favorites.openPhoto": "Open photo",
  "app.favorites.albumFavoritesEyebrow": "Album favorites",
  "app.favorites.albumFavoritesTitle": "Curated collections worth revisiting",
  "app.favorites.noFavoriteAlbums": "No favorite albums yet.",
  "app.favorites.noFavoriteAlbumsMatch":
    "No favorite albums match the current filter.",
  "app.favorites.collaborativeAlbum": "{spaceName} collaborative album",
  "app.favorites.personalAlbum": "Personal album",
  "app.favorites.albumBadge": "Album",
  "app.favorites.noDescription": "No description",
  "app.favorites.spaceContext":
    "Open the Space to manage members, sharing, and the full collaborative context.",
  "app.favorites.libraryContext":
    "This album lives inside your personal library for lightweight curation.",
  "app.favorites.savedDate": "Saved {date}",
  "app.favorites.openSpace": "Open {spaceName}",
  "app.favorites.openLibrary": "Open library",
  "app.spaces.createFailed": "Failed to create Space.",
  "app.spaces.eyebrow": "Spaces",
  "app.spaces.title": "Collaborative spaces",
  "app.spaces.description":
    "Spaces are collaborative containers with members, roles, invites, subspaces, and shared albums. Use albums in the Library for personal curation, and use Spaces when media needs access control.",
  "app.spaces.accessibleSpaces": "Accessible Spaces",
  "app.spaces.accessibleSpacesDescription": "All visible Spaces and subspaces.",
  "app.spaces.rootSpaces": "Root Spaces",
  "app.spaces.rootSpacesDescription": "Top-level collaboration areas.",
  "app.spaces.publicSpaces": "Public Spaces",
  "app.spaces.publicSpacesDescription":
    "Currently visible without private-only filtering.",
  "app.spaces.emptyTitle": "No accessible Spaces",
  "app.spaces.emptyDescription":
    "Create a collaborative Space and it will appear here. Shared albums, members, subspaces, and invite links are managed from the Space detail route.",
  "app.spaces.filterLabel": "Filter spaces",
  "app.spaces.filterPlaceholder": "Filter by name or description",
  "app.spaces.visibilityFilterLabel": "Filter visibility",
  "app.spaces.visibilityFilterAll": "All visibility",
  "app.spaces.visibilityFilterPrivate": "Private only",
  "app.spaces.visibilityFilterPublic": "Public only",
  "app.spaces.toolbarTitle": "Browse shared spaces",
  "app.spaces.toolbarDescription":
    "Filter collaborative Spaces by name, description, and visibility.",
  "app.spaces.noMatchTitle": "No Spaces match the current filters",
  "app.spaces.noMatchDescription":
    "Try a different name fragment or reset the visibility filter.",
  "app.spaces.depth": "depth {count}",
  "app.spaces.noDescription": "No description",
  "app.spaces.workspaceDescription":
    "Shared albums, members, and invites live inside this workspace.",
  "app.spaces.inheritance": "Inheritance",
  "app.spaces.created": "Created",
  "app.spaces.openWorkspace": "Open workspace",
  "app.spaces.albumsSpacesEyebrow": "Spaces and albums",
  "app.spaces.albumsSpacesTitle": "Share from a Space, curate in an album",
  "app.spaces.albumsSpacesDescription":
    "A Space is the collaborative wrapper: it owns members, roles, subspaces, invite links, and shared albums. Albums remain the lighter-weight curated collections inside a library or Space.",
  "app.spaces.openPersonalAlbums": "Open personal albums",
  "app.spaces.createEyebrow": "Create Space",
  "app.spaces.createTitle": "New collaborative Space",
  "app.spaces.createDescription":
    "Start a root Space when media needs shared ownership, permissions, or nested collaboration.",
  "app.spaces.createSubmit": "Create Space",
  "app.collection.recent.eyebrow": "Recent",
  "app.collection.recent.title": "Recently touched media",
  "app.collection.recent.description":
    "The library already opens with newest items first. This route is reserved for a tighter activity feed once we can distinguish imports, edits, favorites, and other recent events.",
  "app.collection.recent.action": "Open timeline",
  "app.collection.recent.secondary": "Open photo library",
  "app.collection.recent.status": "Planned activity view",
  "app.collection.recent.currentUse":
    "Use the main library or timeline today to browse your newest media first.",
  "app.collection.videos.eyebrow": "Videos",
  "app.collection.videos.title": "Video collection",
  "app.collection.videos.description":
    "Video-first browsing needs transcoding, duration metadata, and playback-oriented grouping from the backend. The route is visible now so navigation stays stable while that pipeline catches up.",
  "app.collection.videos.action": "Open current library",
  "app.collection.videos.secondary": "Browse timeline",
  "app.collection.videos.status": "Waiting on video pipeline",
  "app.collection.videos.currentUse":
    "Keep browsing uploads from the library until dedicated playback and video filters land.",
  "app.collection.trash.eyebrow": "Trash",
  "app.collection.trash.title": "Retention and recovery",
  "app.collection.trash.description":
    "The current product still deletes items directly. A real trash view needs backend retention semantics, restore operations, and eventual deletion windows before it can become a recovery surface.",
  "app.collection.trash.action": "Return to library",
  "app.collection.trash.secondary": "Open recent media",
  "app.collection.trash.status": "Waiting on retention semantics",
  "app.collection.trash.currentUse":
    "Deletion still bypasses a recovery bin, so use this route as a stable navigation contract rather than an active restore workflow.",
  "app.collection.limitedMode": "Limited mode",
  "app.collection.routeReadyTitle": "Route contract is ready",
  "app.collection.routeReadyDescription":
    "The shell now reserves a stable place for this collection so navigation does not need to change again when the deeper feature work lands.",
  "app.collection.useNowEyebrow": "Use right now",
  "app.collection.useNowTitle": "Stable entry, limited behavior",
  "app.collection.openLibrary": "Open library",
  "app.collection.browseTimeline": "Browse timeline",
};

export type MessageKey = keyof typeof enMessages;
type MessageCatalog = Record<MessageKey, string>;

const ruMessages: Partial<MessageCatalog> = {
  "common.notAvailable": "Недоступно",
  "language.label": "Язык",
  "language.english": "Английский",
  "language.russian": "Русский",
  "role.owner": "Владелец",
  "role.admin": "Администратор",
  "role.member": "Участник",
  "role.viewer": "Наблюдатель",
  "public.home.phaseEyebrow": "Основа Phase 3",
  "public.home.login": "Войти",
  "public.home.createAccount": "Создать аккаунт",
  "public.home.heroEyebrow": "Private Image Network Archive",
  "public.home.heroTitle":
    "Медиатека для совместной работы: с авторизацией, фото, альбомами и Spaces.",
  "public.home.heroDescription":
    "Бэкенд уже на Phase 2. Этот проход по фронтенду запускает реальный app shell: аутентификацию, личную библиотеку и навигацию с учётом Spaces.",
  "public.home.heroPrimaryCta": "Начать с локального аккаунта",
  "public.home.heroSecondaryCta": "Открыть приложение",
  "public.home.environmentEyebrow": "Окружение",
  "public.home.environmentTitle": "Состояние бэкенда",
  "public.home.backendConnecting": "Подключение к бэкенду",
  "public.home.backendConnected": "Бэкенд подключён",
  "public.home.backendUnavailable": "Бэкенд недоступен",
  "public.home.readyTodayEyebrow": "Готово уже сейчас",
  "public.home.readyTodayDescription":
    "JWT auth, refresh tokens, Google login, Spaces, invite links, shared albums, favorites.",
  "public.home.nextFrontendEyebrow": "Следующее на фронтенде",
  "public.home.nextFrontendDescription":
    "Просмотр библиотеки, альбомные сценарии, Space dashboards и адаптивная навигация приложения.",
  "public.login.eyebrow": "Аутентификация",
  "public.login.title": "Вход в PINA",
  "public.login.description":
    "Используйте существующий локальный аккаунт, чтобы войти в приложение.",
  "public.login.username": "Имя пользователя",
  "public.login.password": "Пароль",
  "public.login.submit": "Войти",
  "public.login.submitting": "Выполняется вход...",
  "public.login.sessionTargetEyebrow": "Цель сессии",
  "public.login.redirectDescription":
    "После аутентификации вы будете перенаправлены на {redirectTo}.",
  "public.login.backendDescription":
    "Локальная аутентификация по имени пользователя и паролю уже подключена к бэкенду Phase 2. Google sign-in можно добавить следующим слоем.",
  "public.login.needAccount": "Нужен аккаунт?",
  "public.login.createOne": "Создать",
  "public.login.errorFallback": "Не удалось выполнить вход. Повторите попытку.",
  "public.register.eyebrow": "Локальный аккаунт",
  "public.register.title": "Создайте первую сессию",
  "public.register.description":
    "Регистрация уже работает на бэкенде. Этот экран подключает её к новому frontend shell.",
  "public.register.name": "Имя",
  "public.register.username": "Имя пользователя",
  "public.register.password": "Пароль",
  "public.register.submit": "Создать аккаунт",
  "public.register.submitting": "Создание аккаунта...",
  "public.register.nextEyebrow": "Что произойдёт дальше",
  "public.register.nextCreated": "Новый аккаунт сразу создаётся в бэкенде.",
  "public.register.nextRedirect":
    "Вы входите в систему и перенаправляетесь на {redirectTo}.",
  "public.register.nextScope":
    "Редактирование профиля, Spaces, альбомы и favorites уже доступны в текущей фазе фронтенда.",
  "public.register.haveAccount": "Уже зарегистрированы?",
  "public.register.login": "Войти",
  "public.register.errorFallback":
    "Не удалось завершить регистрацию. Повторите попытку.",
  "public.joinInvite.eyebrow": "Пригласительная ссылка",
  "public.joinInvite.title": "Вступление в Space",
  "public.joinInvite.spaceEyebrow": "Space",
  "public.joinInvite.noDescription": "Описание отсутствует",
  "public.joinInvite.defaultRole": "Роль по умолчанию",
  "public.joinInvite.sessionCanJoin":
    "Текущий аккаунт может принять это приглашение сразу.",
  "public.joinInvite.loginFirst":
    "Сначала войдите, а затем вернитесь сюда, чтобы присоединиться к Space.",
  "public.joinInvite.joinRoleEyebrow": "Роль при вступлении",
  "public.joinInvite.sessionStateEyebrow": "Состояние сессии",
  "public.joinInvite.authenticated": "Аутентифицирован",
  "public.joinInvite.loginRequired": "Требуется вход",
  "public.joinInvite.joining": "Подключение...",
  "public.joinInvite.joinSpace": "Вступить в Space",
  "public.joinInvite.loginToJoin": "Войти для вступления",
  "public.joinInvite.backHome": "На главную",
  "public.joinInvite.loadingPreview": "Загрузка превью приглашения...",
  "public.joinInvite.errorFallback": "Не удалось принять приглашение.",
  "shell.mobileEyebrow": "Медиатека",
  "shell.upload": "Загрузить",
  "shell.menuOpen": "Меню",
  "shell.menuClose": "Закрыть",
  "shell.navigation.open": "Открыть навигацию",
  "shell.navigation.close": "Закрыть навигацию",
  "shell.brandEyebrow": "Private Image Network Archive",
  "shell.brandDescription":
    "Сначала фото, затем shared spaces, а admin chrome остаётся компактным.",
  "shell.nav.photos": "Фото",
  "shell.nav.photosCaption": "Сначала новые",
  "shell.nav.map": "Карта",
  "shell.nav.mapCaption": "Места",
  "shell.nav.spaces": "Spaces",
  "shell.nav.spacesCaption": "Общие комнаты",
  "shell.nav.albums": "Альбомы",
  "shell.nav.albumsCaption": "Курируемые подборки",
  "shell.nav.favorites": "Избранное",
  "shell.nav.favoritesCaption": "Сохранённые медиа",
  "shell.nav.videos": "Видео",
  "shell.nav.videosCaption": "Следующий этап",
  "shell.nav.recent": "Недавнее",
  "shell.nav.recentCaption": "Быстрый возврат",
  "shell.nav.trash": "Корзина",
  "shell.nav.trashCaption": "Retention позже",
  "shell.nav.admin": "Админ",
  "shell.nav.adminCaption": "Управление инстансом",
  "shell.quick.allPhotosTitle": "Все фото",
  "shell.quick.allPhotosDescription":
    "Плотная сетка, отсортированная от новых к старым.",
  "shell.quick.timelineTitle": "Таймлайн",
  "shell.quick.timelineDescription":
    "Переход между группами по дням внутри библиотеки.",
  "shell.quick.mapTitle": "Карта",
  "shell.quick.mapDescription": "Переключение в просмотр по местам.",
  "shell.quick.albumsTitle": "Альбомы",
  "shell.quick.albumsDescription": "Открыть личные курируемые коллекции.",
  "shell.quick.favoritesTitle": "Избранное",
  "shell.quick.favoritesDescription": "Только отмеченные медиа и альбомы.",
  "shell.quick.spacesTitle": "Spaces",
  "shell.quick.spacesDescription": "Общие коллекции и memberships.",
  "shell.signedInEyebrow": "Выполнен вход",
  "shell.unknownUser": "Неизвестный пользователь",
  "shell.noEmailConfigured": "Email не настроен",
  "shell.manageAccount": "Управлять аккаунтом",
  "shell.systemEyebrow": "Система",
  "shell.system.backendLabel": "Бэкенд",
  "shell.system.storageLabel": "Хранилище",
  "shell.system.versionLabel": "Версия",
  "shell.system.checkingBackend": "Проверка бэкенда",
  "shell.system.backendConnected": "Бэкенд подключён",
  "shell.system.backendUnavailable": "Бэкенд недоступен",
  "shell.system.storageInfoPending": "Данные о хранилище ожидаются",
  "shell.system.waitingForBackend": "Ожидание бэкенда",
  "shell.system.usedSuffix": "Использовано {value}",
  "shell.system.availableSuffix": "Доступно {value}",
  "shell.search.label": "Поиск по медиатеке",
  "shell.search.placeholder": "Ищите фото, места, людей, теги",
  "shell.search.submit": "Искать",
  "shell.search.openFilters": "Открыть фильтры",
  "shell.search.hideFilters": "Скрыть фильтры",
  "shell.account": "Аккаунт",
  "shell.theme.light": "Светлая тема",
  "shell.theme.dark": "Тёмная тема",
  "shell.theme.switchToDark": "Переключить на тёмную тему",
  "shell.theme.switchToLight": "Переключить на светлую тему",
  "shell.logout": "Выйти",
  "common.clear": "Очистить",
  "common.clearFilter": "Сбросить фильтр",
  "common.clearFilters": "Сбросить фильтры",
  "common.add": "Добавить",
  "common.remove": "Удалить",
  "common.delete": "Удалить",
  "common.favorite": "В избранное",
  "common.unfavorite": "Убрать из избранного",
  "common.name": "Название",
  "common.description": "Описание",
  "common.visibility": "Видимость",
  "common.private": "Приватный",
  "common.public": "Публичный",
  "common.enabled": "Включено",
  "common.disabled": "Выключено",
  "common.loading": "Загрузка...",
  "common.loadingPreview": "Загрузка превью...",
  "common.updating": "Обновление...",
  "common.deleting": "Удаление...",
  "common.creating": "Создание...",
  "common.saving": "Сохранение...",
  "unit.photo.one": "фото",
  "unit.photo.few": "фото",
  "unit.photo.many": "фото",
  "unit.photo.other": "фото",
  "unit.album.one": "альбом",
  "unit.album.few": "альбома",
  "unit.album.many": "альбомов",
  "unit.album.other": "альбома",
  "unit.dayGroup.one": "группа по дню",
  "unit.dayGroup.few": "группы по дням",
  "unit.dayGroup.many": "групп по дням",
  "unit.dayGroup.other": "группы по дням",
  "unit.geoPhoto.one": "фото с геотегом",
  "unit.geoPhoto.few": "фото с геотегом",
  "unit.geoPhoto.many": "фото с геотегом",
  "unit.geoPhoto.other": "фото с геотегом",
  "unit.match.one": "совпадение",
  "unit.match.few": "совпадения",
  "unit.match.many": "совпадений",
  "unit.match.other": "совпадения",
  "unit.savedItem.one": "сохранённый элемент",
  "unit.savedItem.few": "сохранённых элемента",
  "unit.savedItem.many": "сохранённых элементов",
  "unit.savedItem.other": "сохранённых элемента",
  "unit.space.one": "Space",
  "unit.space.few": "Spaces",
  "unit.space.many": "Spaces",
  "unit.space.other": "Spaces",
  "app.library.actionUnknown": "Неизвестное действие библиотеки.",
  "app.library.actionFailed": "Не удалось выполнить действие в библиотеке.",
  "app.library.mapLoadFailed": "Не удалось загрузить фотографии на карте.",
  "app.library.loadFailed": "Не удалось загрузить библиотеку.",
  "app.library.uploadTypeError": "Поддерживаются только файлы JPEG и PNG.",
  "app.library.uploadFileFailed": "{fileName}: ошибка загрузки фото.",
  "app.library.uploadFailed": "Не удалось загрузить фото.",
  "app.library.uploadSummarySingle": "Загружено 1 фото.",
  "app.library.uploadSummaryPlural": "Загружено {count} фото.",
  "app.library.uploadSummaryPartial":
    "Загружено {uploadedCount} из {totalCount} фото.",
  "app.library.photoFavoriteFailed": "Не удалось обновить избранное для фото.",
  "app.library.albumFavoriteFailed":
    "Не удалось обновить избранное для альбома.",
  "app.library.eyebrow": "Библиотека",
  "app.library.title": "Фото, места и альбомы",
  "app.library.description":
    "Просматривайте личные медиа по дням, переходите к местам на карте или собирайте альбомы. Используйте Spaces, когда коллекции нужны участники, права доступа и совместная активность.",
  "app.library.toolbarTitle": "Вид и фильтр",
  "app.library.toolbarDescription":
    "Оставайтесь в фото-ориентированной библиотеке, переключайтесь между хронологией, местами и альбомами и сохраняйте текущий фильтр в URL.",
  "app.library.view.photos": "Фото",
  "app.library.view.timeline": "Таймлайн",
  "app.library.view.map": "Карта",
  "app.library.view.albums": "Альбомы",
  "app.library.filterLabel": "Фильтр библиотеки",
  "app.library.filterPlaceholder": "Фильтр по фото, альбомам и маркерам карты",
  "app.library.photosEyebrow": "Фото",
  "app.library.photosTitle": "Библиотека по дням",
  "app.library.timelineTitle": "Таймлайн фото",
  "app.library.mapTitle": "Геокарта",
  "app.library.mapDescription":
    "Просматривайте личные фото с геотегами в пределах текущего viewport. Состояние карты восстанавливается из URL для обновления страницы и deeplink-ссылок.",
  "app.library.visiblePhotosByDay":
    "{count} видимых фото, сгруппированных по дню съёмки, сначала новые.",
  "app.library.filteringDescription":
    'Фильтрация библиотеки по "{filter}" среди фото, альбомов и маркеров карты.',
  "app.library.summaryLine": "{dayGroups} · {geoPhotos}",
  "app.library.clearSelection": "Снять выделение",
  "app.library.worldView": "Весь мир",
  "app.library.zoomIn": "Увеличить",
  "app.library.zoomOut": "Уменьшить",
  "app.library.uploadPhotos": "Загрузить фото",
  "app.library.uploadingPhotos": "Загрузка...",
  "app.library.mapLegendTitle": "Легенда карты",
  "app.library.mapLegendDescription":
    "Маленькие маркеры обозначают одно фото. Маркеры с числом обозначают кластеры; увеличьте карту или выберите кластер, чтобы посмотреть вложенные файлы.",
  "app.library.mapLegendFilter":
    'Текущий фильтр также применяется к маркерам карты: "{filter}".',
  "app.library.panWest": "Сдвинуть на запад",
  "app.library.panEast": "Сдвинуть на восток",
  "app.library.panNorth": "Сдвинуть на север",
  "app.library.panSouth": "Сдвинуть на юг",
  "app.library.loadingMarkers": "Загрузка маркеров карты...",
  "app.library.openClusterAria": "Открыть кластер карты с {count} фото",
  "app.library.openMarkerAria": "Открыть маркер карты для {fileName}",
  "app.library.viewportEyebrow": "Viewport",
  "app.library.viewportSouthWest": "Юго-запад",
  "app.library.viewportNorthEast": "Северо-восток",
  "app.library.viewportMarkers": "Маркеры",
  "app.library.viewportPhotosInView": "Фото во viewport",
  "app.library.viewportSelection": "Выделение",
  "app.library.selectionCluster": "Кластер из {count} фото",
  "app.library.selectionSinglePhoto": "Одно фото",
  "app.library.selectionNone": "Ничего не выбрано",
  "app.library.clusterTitle": "Кластер из {count} фото",
  "app.library.clusterHint": "Увеличьте масштаб, чтобы увидеть отдельные файлы",
  "app.library.zoomIntoCluster": "Приблизить кластер",
  "app.library.clusterMore":
    "Внутри этого кластера остаётся ещё {count} фото. Увеличьте масштаб, чтобы разбить его на меньшие группы.",
  "app.library.photoSelected": "Фото выбрано",
  "app.library.latitude": "Широта",
  "app.library.longitude": "Долгота",
  "app.library.taken": "Снято",
  "app.library.viewportStatus": "Статус viewport",
  "app.library.visibleInViewport": "Видно в текущем view карты",
  "app.library.visibleInViewportAndFilter":
    "Видно в текущем view карты и фильтре",
  "app.library.openPhotoDetail": "Открыть детали фото",
  "app.library.loadingViewport": "Загрузка текущего viewport.",
  "app.library.selectMarkerHint":
    "Выберите маркер, чтобы посмотреть фото и перейти на экран деталей.",
  "app.library.resetWorldView": "Сбросить на глобальный вид",
  "app.library.noGeoPhotosTitle": "Пока нет фото с геотегами",
  "app.library.noGeoPhotosDescription":
    "На карте отображаются только фото с EXIF GPS-координатами. Загрузите или импортируйте фото с данными о местоположении, чтобы просматривать их здесь.",
  "app.library.noGeoPhotosMatchTitle":
    "Нет фото с геотегами, подходящих под текущий фильтр",
  "app.library.noGeoPhotosMatchDescription":
    'Во текущем viewport нет фото с геотегами, подходящих под "{filter}". Сбросьте фильтр или расширьте карту.',
  "app.library.noGeoPhotosViewportTitle":
    "В этом viewport нет фото с геотегами",
  "app.library.noGeoPhotosViewportDescription":
    "Попробуйте расширить viewport или сбросить карту на глобальный вид. На карте отображаются только фото с EXIF GPS-координатами.",
  "app.library.dropzoneTitle":
    "Перетащите сюда JPEG или PNG, чтобы загрузить их пакетом.",
  "app.library.dropzoneDescription":
    "Текущий фронтенд загружает файлы последовательно через photo endpoint из Phase 2 и обновляет библиотеку после завершения очереди.",
  "app.library.uploadProgress": "Загрузка {current} из {total}{fileSuffix}",
  "app.library.noPhotosTitle": "Пока нет загруженных фото",
  "app.library.noPhotosDescription":
    "Загрузите первый JPEG или PNG. Маршрут уже выполняет реальную multipart-загрузку в бэкенд.",
  "app.library.noPhotosMatchTitle": "Нет фото, подходящих под текущий фильтр",
  "app.library.noPhotosMatchDescription":
    "Попробуйте другой фрагмент имени файла или сбросьте текущий фильтр, чтобы увидеть остальную библиотеку.",
  "app.library.timelineRailEyebrow": "Шкала времени",
  "app.library.timelineRailTitle": "Переход по дате",
  "app.library.timelineRailDescription":
    "Перемещайтесь между видимыми группами по дням, не выходя из сетки библиотеки.",
  "app.library.atGlanceEyebrow": "Сводка",
  "app.library.atGlanceVisiblePhotos": "Видимые фото",
  "app.library.atGlanceDayGroups": "Группы по дням",
  "app.library.atGlanceAlbums": "Альбомы",
  "app.library.openAlbums": "Открыть альбомы",
  "app.library.createAlbumEyebrow": "Создать альбом",
  "app.library.createAlbumTitle": "Новый личный альбом",
  "app.library.createAlbumDescription":
    "Альбомы это курируемые подборки внутри вашей библиотеки. Если нужны участники, роли или инвайт-ссылки, создайте Space.",
  "app.library.createAlbumSubmit": "Создать альбом",
  "app.library.albumsSpacesEyebrow": "Альбомы и Spaces",
  "app.library.albumsSpacesTitle": "Курируйте здесь, сотрудничайте в Spaces",
  "app.library.albumsSpacesDescription":
    "Альбомы держат вместе личный набор фото. Spaces добавляют участников, наследуемый доступ, инвайты и общие альбомы для командных или семейных сценариев.",
  "app.library.openSpaces": "Открыть Spaces",
  "app.library.albumsEyebrow": "Альбомы",
  "app.library.albumsTitle": "Личные курируемые альбомы",
  "app.library.noAlbums":
    "Пока нет личных альбомов. Используйте форму выше, чтобы создать первый.",
  "app.library.noAlbumsMatch": "Нет альбомов, подходящих под текущий фильтр.",
  "app.library.albumEyebrow": "Альбом",
  "app.library.removeAlbumFavoriteAria": "Убрать {albumName} из избранного",
  "app.library.addAlbumFavoriteAria": "Добавить {albumName} в избранное",
  "app.library.saveAlbum": "Сохранить альбом",
  "app.library.photoForAlbumAria": "Фото для альбома {albumName}",
  "app.library.selectPhotoToAdd": "Выберите фото для добавления",
  "app.library.allPhotosAssigned":
    "Все доступные фото уже добавлены в этот альбом.",
  "app.library.noPhotosInAlbum": "В этом альбоме пока нет фото.",
  "app.library.photoTileAria": "Открыть фото {fileName}",
  "app.library.photoPreviewAlt": "Превью {fileName}",
  "app.library.photoTileSaved": "Сохранено",
  "app.library.photoTileLibrary": "Библиотека",
  "app.library.removePhotoFavoriteAria": "Убрать {fileName} из избранного",
  "app.library.addPhotoFavoriteAria": "Добавить {fileName} в избранное",
  "app.albumDetail.actionUnknown": "Неизвестное действие альбома.",
  "app.albumDetail.actionFailed": "Не удалось выполнить действие альбома.",
  "app.albumDetail.loadFailed": "Не удалось загрузить детали альбома.",
  "app.albumDetail.favoriteFailed":
    "Не удалось обновить избранное для альбома.",
  "app.albumDetail.uploadTypeError":
    "Поддерживаются только файлы JPEG и PNG.",
  "app.albumDetail.uploadFileFailed": "{fileName}: ошибка загрузки фото.",
  "app.albumDetail.uploadSummaryFull": "Добавлено {count} загруженных фото.",
  "app.albumDetail.uploadSummaryPartial":
    "Добавлено {uploadedCount} из {totalCount} загруженных фото.",
  "app.albumDetail.missingId": "Отсутствует идентификатор альбома.",
  "app.albumDetail.notFoundTitle": "Альбом не найден",
  "app.albumDetail.notFoundDescription":
    "Этот личный альбом не найден или больше недоступен.",
  "app.albumDetail.eyebrow": "Детали альбома",
  "app.albumDetail.description":
    "Просматривайте один личный альбом по дням, управляйте его составом и держите таймлайн под рукой во время навигации по коллекции.",
  "app.albumDetail.backToAlbums": "Назад к альбомам",
  "app.albumDetail.addPhotos": "Добавить фото",
  "app.albumDetail.editAlbum": "Редактировать альбом",
  "app.albumDetail.downloadAlbum": "Скачать",
  "app.albumDetail.shareAlbum": "Поделиться",
  "app.albumDetail.downloadPending":
    "Подключение скачивания альбома вынесено в следующую задачу действий.",
  "app.albumDetail.sharePending":
    "Подключение публичного шаринга вынесено в следующую задачу действий.",
  "app.albumDetail.coverAlt": "Обложка альбома {albumName}",
  "app.albumDetail.noCover": "У альбома пока нет обложки",
  "app.albumDetail.summaryEyebrow": "Сводка по альбому",
  "app.albumDetail.noDescription": "Описания пока нет.",
  "app.albumDetail.itemCount": "Элементы",
  "app.albumDetail.dateRange": "Диапазон дат",
  "app.albumDetail.created": "Создан",
  "app.albumDetail.updated": "Обновлён",
  "app.albumDetail.photosStat": "Фото",
  "app.albumDetail.daysStat": "Дни в таймлайне",
  "app.albumDetail.favoriteStat": "Статус избранного",
  "app.albumDetail.favoriteSaved": "Сохранён",
  "app.albumDetail.favoriteIdle": "Доступен",
  "app.albumDetail.editEyebrow": "Редактирование",
  "app.albumDetail.editTitle": "Обновить данные альбома",
  "app.albumDetail.saveAlbum": "Сохранить альбом",
  "app.albumDetail.addPhotosEyebrow": "Добавление фото",
  "app.albumDetail.addPhotosTitle": "Расширьте этот альбом",
  "app.albumDetail.addPhotosDescription":
    "Загружайте новые фото сразу в этот альбом или выбирайте существующие элементы из личной библиотеки.",
  "app.albumDetail.uploadEyebrow": "Загрузить новые",
  "app.albumDetail.uploadLabel": "Файлы JPEG или PNG",
  "app.albumDetail.uploadingProgress":
    "Загрузка {current} из {total} {fileName}",
  "app.albumDetail.libraryPickerEyebrow": "Выбрать из библиотеки",
  "app.albumDetail.existingPhotoLabel": "Существующее личное фото",
  "app.albumDetail.selectPhoto": "Выберите фото для добавления",
  "app.albumDetail.noAvailablePhotos":
    "Все доступные фото из библиотеки уже входят в этот альбом.",
  "app.albumDetail.addSelectedPhoto": "Добавить выбранное фото",
  "app.albumDetail.emptyTitle": "В этом альбоме пока нет фото",
  "app.albumDetail.emptyDescription":
    "Используйте действие добавления фото, чтобы загрузить новые изображения или прикрепить существующие фото из библиотеки.",
  "app.albumDetail.removePhoto": "Удалить",
  "app.albumDetail.setAsCover": "Сделать обложкой",
  "app.albumDetail.setCoverPending":
    "Подключение выбора обложки вынесено в следующую задачу действий.",
  "app.albumDetail.dayGroups": "групп по дням",
  "app.albumPhotoDetail.loadFailed": "Не удалось загрузить фото из альбома.",
  "app.albumPhotoDetail.missingId":
    "Отсутствует идентификатор альбома или фото.",
  "app.albumPhotoDetail.notFound":
    "Запрошенное фото из альбома не найдено.",
  "app.albumPhotoDetail.eyebrow": "Фото альбома",
  "app.albumPhotoDetail.description":
    "Просматривайте фото из альбома, не теряя контекст самой коллекции. Альбом: {albumName}.",
  "app.albumPhotoDetail.previewAlt": "Превью {fileName}",
  "app.albumPhotoDetail.backToAlbum": "Назад к альбому",
  "app.albumPhotoDetail.backToAlbums": "Назад к альбомам",
  "app.albumPhotoDetail.contextEyebrow": "Контекст альбома",
  "app.albumPhotoDetail.noAlbumDescription": "Описания альбома пока нет.",
  "app.albumPhotoDetail.metadataEyebrow": "Метаданные",
  "app.albumPhotoDetail.mimeType": "Mime type",
  "app.albumPhotoDetail.dimensions": "Размеры",
  "app.albumPhotoDetail.size": "Размер",
  "app.albumPhotoDetail.takenAt": "Снято",
  "app.albumPhotoDetail.added": "Добавлено",
  "app.albumPhotoDetail.metadataPayloadEyebrow": "EXIF payload",
  "app.albumPhotoDetail.noExif": "EXIF-метаданные отсутствуют",
  "app.photoDetail.loadFailed": "Не удалось загрузить фото.",
  "app.photoDetail.deleteFailed": "Не удалось удалить фото.",
  "app.photoDetail.favoriteFailed": "Не удалось обновить избранное.",
  "app.photoDetail.downloadFailed": "Не удалось скачать оригинальный файл.",
  "app.photoDetail.missingId": "Отсутствует идентификатор фото.",
  "app.photoDetail.eyebrow": "Просмотр фото",
  "app.photoDetail.loadingTitle": "Загрузка фото",
  "app.photoDetail.description":
    "Файл из личной библиотеки с крупным превью, быстрыми действиями и структурированным блоком метаданных.",
  "app.photoDetail.capturePending": "Время съёмки ожидается",
  "app.photoDetail.dimensionsPending": "Размеры ожидаются",
  "app.photoDetail.backToLibrary": "Назад в библиотеку",
  "app.photoDetail.removeFavorite": "Убрать из избранного",
  "app.photoDetail.addFavorite": "В избранное",
  "app.photoDetail.deletePhoto": "Удалить фото",
  "app.photoDetail.openFavorites": "Открыть избранное",
  "app.photoDetail.downloadOriginal": "Скачать оригинал",
  "app.photoDetail.previewAlt": "Превью фото",
  "app.photoDetail.photoActionsEyebrow": "Действия с фото",
  "app.photoDetail.photoActionsTitle": "Продолжить просмотр",
  "app.photoDetail.photoActionsDescription":
    "Вернитесь в библиотеку, сохраните фото, скачайте оригинал или удалите его из текущей коллекции.",
  "app.photoDetail.status": "Статус",
  "app.photoDetail.statusSaved": "Сохранено в избранное",
  "app.photoDetail.statusLibrary": "В личной библиотеке",
  "app.photoDetail.variants": "Варианты",
  "app.photoDetail.originalFileSize": "Размер оригинала",
  "app.photoDetail.metadataEyebrow": "Метаданные",
  "app.photoDetail.metadataTitle": "Детали файла и съёмки",
  "app.photoDetail.mimeType": "Mime type",
  "app.photoDetail.dimensions": "Размеры",
  "app.photoDetail.takenAt": "Снято",
  "app.photoDetail.added": "Добавлено",
  "app.photoDetail.coordinates": "Координаты",
  "app.photoDetail.metadataPayloadEyebrow": "Payload метаданных",
  "app.photoDetail.metadataPayloadTitle": "Детали ассета",
  "app.photoDetail.noExif": "EXIF-метаданные отсутствуют",
  "app.photoDetail.tagsEyebrow": "Теги и заметки",
  "app.photoDetail.tagsTitle": "Готово к более богатым метаданным",
  "app.photoDetail.tagsDescription":
    "Ручные теги, ML labels, люди и place chips смогут жить в этой области, когда будут подключены search indexing и enrichment.",
  "app.photoDetail.badgeSaved": "сохранено",
  "app.photoDetail.badgeLibrary": "библиотека",
  "app.photoDetail.badgeUnknown": "неизвестно",
  "app.photoDetail.badgeGeotagged": "геотег",
  "app.search.eyebrow": "Поиск",
  "app.search.title": "Обнаружение",
  "app.search.description":
    "Phase 3 backend search уже подключён для текстовых результатов по вашей библиотеке, доступным Spaces и избранному. Кластеры лиц и semantic ML retrieval остаются следующими шагами.",
  "app.search.backToLibrary": "Назад в библиотеку",
  "app.search.browseFavorites": "Открыть избранное",
  "app.search.queryLabel": "Поисковый запрос",
  "app.search.queryPlaceholder": "Ищите по тексту, человеку, месту или тегу",
  "app.search.tryExample": "Попробовать {label}",
  "app.search.scope.all": "Все области",
  "app.search.scope.library": "Библиотека",
  "app.search.scope.spaces": "Spaces",
  "app.search.scope.favorites": "Избранное",
  "app.search.scope.facesLater": "Лица (позже)",
  "app.search.scope.tagsLater": "Теги (позже)",
  "app.search.currentLibrary": "Текущая библиотека",
  "app.search.accessibleSpaces": "Доступные Spaces",
  "app.search.favorites": "Избранное",
  "app.search.plannedQueryTypes": "Планируемые типы запросов",
  "app.search.queryType.freeText":
    "Текстовые совпадения по именам файлов и названиям/описаниям альбомов",
  "app.search.queryType.faces":
    "Поиск лица/человека после кластеризации и связывания идентичностей",
  "app.search.queryType.scoped":
    "Ограниченный поиск внутри личной библиотеки, избранного или конкретного Space",
  "app.search.backendRequirements": "Требования к бэкенду",
  "app.search.backendRequirement.indexed":
    "Эндпоинты индексированного поиска по тексту и тегам",
  "app.search.backendRequirement.embedding":
    "Извлечение с учётом лиц и эмбеддингов",
  "app.search.backendRequirement.ranking":
    "Постраничное ранжирование результатов с фильтрацией по контролю доступа",
  "app.search.kind.all": "Все результаты",
  "app.search.kind.photo": "Фото",
  "app.search.kind.album": "Альбомы",
  "app.search.sortLabel": "Сортировка",
  "app.search.sort.relevance": "Лучшее совпадение",
  "app.search.sort.newest": "Сначала новые",
  "app.search.sort.oldest": "Сначала старые",
  "app.search.resultsTitle": "Результаты бэкенда",
  "app.search.resultsDescription":
    "Теперь результаты приходят из backend contract и сохраняют personal-library или Space navigation context для каждого хита.",
  "app.search.partialResults": "Показано {start}-{end} из {total} совпадений.",
  "app.search.previousPage": "Предыдущая страница",
  "app.search.nextPage": "Следующая страница",
  "app.search.pageIndicator": "Страница {page} из {totalPages}",
  "app.search.emptyTitle": "Начните с текстового запроса",
  "app.search.emptyDescription":
    "Введите запрос, чтобы загрузить backend results по библиотеке, доступным Spaces и избранному. Поиск лиц останется отключённым, пока не появится отдельный API.",
  "app.search.openTimelineInstead": "Открыть таймлайн",
  "app.search.loadingDescription": "Загружаю backend search results...",
  "app.search.errorUnavailable":
    "Бэкенд сейчас недоступен. Поднимите сервер и повторите поиск.",
  "app.search.errorBadRequest":
    "Текущие search parameters не поддерживаются backend contract.",
  "app.search.errorGeneric": "Не удалось загрузить backend search results.",
  "app.search.noResultsDescription":
    'В текущей области нет backend search results для "{query}".',
  "app.search.personalPhotoContext": "Фото из личной библиотеки",
  "app.search.spacePhotoContext": "Доступно через {spaceName} / {albumName}",
  "app.favorites.eyebrow": "Избранное",
  "app.favorites.title": "Сохранённые медиа",
  "app.favorites.description":
    "Сохранённые фото и курируемые альбомы из вашей библиотеки и доступных вам Spaces. Альбомы отвечают за подборку, а Spaces за людей, права доступа и совместную работу.",
  "app.favorites.savedPhotos": "Сохранённые фото",
  "app.favorites.curatedAlbums": "Курируемые альбомы",
  "app.favorites.curatedAlbumsDescription":
    "Личные альбомы и альбомы Spaces, которые вы закрепили для быстрого возврата.",
  "app.favorites.albumsSpacesEyebrow": "Альбомы и Spaces",
  "app.favorites.albumsSpacesTitle":
    "Подборки, а не общие рабочие пространства",
  "app.favorites.albumsSpacesDescription":
    "Альбомы держат выбранные фото вместе. Spaces добавляют участников, роли и sharing по инвайтам вокруг этих альбомов.",
  "app.favorites.favoritedAlbumsFromSpaces":
    "{count} сейчас приходят из Spaces.",
  "app.favorites.browseSpaces": "Открыть Spaces",
  "app.favorites.view.all": "Всё сохранённое",
  "app.favorites.view.photos": "Фото",
  "app.favorites.view.albums": "Альбомы",
  "app.favorites.filterLabel": "Фильтр избранного",
  "app.favorites.filterPlaceholder": "Фильтр избранного по тексту",
  "app.favorites.toolbarTitle": "Просмотр сохранённых медиа",
  "app.favorites.toolbarDescription":
    "Переключайтесь между сохранёнными фото и альбомами, затем сужайте результаты по имени файла, названию альбома или имени Space.",
  "app.favorites.emptyTitle": "Пока нет избранного",
  "app.favorites.emptyDescription":
    "Добавляйте в избранное из библиотеки или сценариев Space, и элементы появятся здесь.",
  "app.favorites.photoFavoritesEyebrow": "Избранные фото",
  "app.favorites.photoFavoritesTitle": "Сохранённые фото-подборки",
  "app.favorites.savedBadge": "{count} сохранено",
  "app.favorites.noFavoritePhotos": "Пока нет избранных фото.",
  "app.favorites.noFavoritePhotosMatch":
    "Нет избранных фото, подходящих под текущий фильтр.",
  "app.favorites.photoBadge": "Фото",
  "app.favorites.savedAt": "{size} · сохранено {date}",
  "app.favorites.openPhoto": "Открыть фото",
  "app.favorites.albumFavoritesEyebrow": "Избранные альбомы",
  "app.favorites.albumFavoritesTitle":
    "Курируемые коллекции, к которым стоит возвращаться",
  "app.favorites.noFavoriteAlbums": "Пока нет избранных альбомов.",
  "app.favorites.noFavoriteAlbumsMatch":
    "Нет избранных альбомов, подходящих под текущий фильтр.",
  "app.favorites.collaborativeAlbum": "Совместный альбом {spaceName}",
  "app.favorites.personalAlbum": "Личный альбом",
  "app.favorites.albumBadge": "Альбом",
  "app.favorites.noDescription": "Описание отсутствует",
  "app.favorites.spaceContext":
    "Откройте Space, чтобы управлять участниками, sharing и полным совместным контекстом.",
  "app.favorites.libraryContext":
    "Этот альбом находится в вашей личной библиотеке для лёгкой ручной подборки.",
  "app.favorites.savedDate": "Сохранено {date}",
  "app.favorites.openSpace": "Открыть {spaceName}",
  "app.favorites.openLibrary": "Открыть библиотеку",
  "app.spaces.createFailed": "Не удалось создать Space.",
  "app.spaces.eyebrow": "Spaces",
  "app.spaces.title": "Пространства для совместной работы",
  "app.spaces.description":
    "Spaces это совместные контейнеры с участниками, ролями, инвайтами, subspaces и общими альбомами. Используйте альбомы в Library для личной подборки, а Spaces когда медиа нужен контроль доступа.",
  "app.spaces.accessibleSpaces": "Доступные Spaces",
  "app.spaces.accessibleSpacesDescription": "Все видимые Spaces и subspaces.",
  "app.spaces.rootSpaces": "Корневые Spaces",
  "app.spaces.rootSpacesDescription": "Верхнеуровневые зоны совместной работы.",
  "app.spaces.publicSpaces": "Публичные Spaces",
  "app.spaces.publicSpacesDescription":
    "Сейчас видимы без фильтра только по приватным.",
  "app.spaces.emptyTitle": "Нет доступных Spaces",
  "app.spaces.emptyDescription":
    "Создайте совместный Space, и он появится здесь. Общие альбомы, участники, subspaces и инвайт-ссылки управляются с detail route Space.",
  "app.spaces.filterLabel": "Фильтр Spaces",
  "app.spaces.filterPlaceholder": "Фильтр по названию или описанию",
  "app.spaces.visibilityFilterLabel": "Фильтр видимости",
  "app.spaces.visibilityFilterAll": "Любая видимость",
  "app.spaces.visibilityFilterPrivate": "Только приватные",
  "app.spaces.visibilityFilterPublic": "Только публичные",
  "app.spaces.toolbarTitle": "Просмотр общих Spaces",
  "app.spaces.toolbarDescription":
    "Фильтруйте collaborative Spaces по названию, описанию и видимости.",
  "app.spaces.noMatchTitle": "Нет Spaces, подходящих под текущие фильтры",
  "app.spaces.noMatchDescription":
    "Попробуйте другой фрагмент названия или сбросьте фильтр видимости.",
  "app.spaces.depth": "уровень {count}",
  "app.spaces.noDescription": "Описание отсутствует",
  "app.spaces.workspaceDescription":
    "Внутри этого workspace живут общие альбомы, участники и инвайты.",
  "app.spaces.inheritance": "Наследование",
  "app.spaces.created": "Создано",
  "app.spaces.openWorkspace": "Открыть workspace",
  "app.spaces.albumsSpacesEyebrow": "Spaces и альбомы",
  "app.spaces.albumsSpacesTitle": "Делитесь через Space, курируйте в альбоме",
  "app.spaces.albumsSpacesDescription":
    "Space это совместная оболочка: он владеет участниками, ролями, subspaces, инвайт-ссылками и общими альбомами. Альбомы остаются более лёгкими курируемыми коллекциями внутри библиотеки или Space.",
  "app.spaces.openPersonalAlbums": "Открыть личные альбомы",
  "app.spaces.createEyebrow": "Создать Space",
  "app.spaces.createTitle": "Новый совместный Space",
  "app.spaces.createDescription":
    "Запускайте корневой Space, когда медиа нужны общая ответственность, права доступа или вложенная совместная работа.",
  "app.spaces.createSubmit": "Создать Space",
  "app.collection.recent.eyebrow": "Недавнее",
  "app.collection.recent.title": "Недавно затронутые медиа",
  "app.collection.recent.description":
    "Библиотека уже открывается с новейших элементов сверху. Этот маршрут зарезервирован под более точную activity feed, когда мы сможем различать импорты, правки, избранное и другие недавние события.",
  "app.collection.recent.action": "Открыть таймлайн",
  "app.collection.recent.secondary": "Открыть фотобиблиотеку",
  "app.collection.recent.status": "Планируемый activity view",
  "app.collection.recent.currentUse":
    "Пока используйте основную библиотеку или таймлайн, чтобы смотреть самые новые медиа первыми.",
  "app.collection.videos.eyebrow": "Видео",
  "app.collection.videos.title": "Коллекция видео",
  "app.collection.videos.description":
    "Video-first просмотр требует transcoding, metadata длительности и playback-oriented группировки на бэкенде. Маршрут уже виден, чтобы навигация оставалась стабильной, пока этот pipeline догоняет.",
  "app.collection.videos.action": "Открыть текущую библиотеку",
  "app.collection.videos.secondary": "Просмотреть таймлайн",
  "app.collection.videos.status": "Ожидает video pipeline",
  "app.collection.videos.currentUse":
    "Пока продолжайте просматривать загрузки из библиотеки, пока не появятся отдельный playback и видео-фильтры.",
  "app.collection.trash.eyebrow": "Корзина",
  "app.collection.trash.title": "Удержание и восстановление",
  "app.collection.trash.description":
    "Текущий продукт всё ещё удаляет элементы напрямую. Реальный trash view требует backend semantics удержания, операций восстановления и окон окончательного удаления, прежде чем он станет поверхностью восстановления.",
  "app.collection.trash.action": "Вернуться в библиотеку",
  "app.collection.trash.secondary": "Открыть недавние медиа",
  "app.collection.trash.status": "Ожидает retention semantics",
  "app.collection.trash.currentUse":
    "Удаление пока обходит recovery bin, поэтому используйте этот маршрут как стабильный навигационный контракт, а не как активный workflow восстановления.",
  "app.collection.limitedMode": "Ограниченный режим",
  "app.collection.routeReadyTitle": "Контракт маршрута готов",
  "app.collection.routeReadyDescription":
    "Shell уже резервирует стабильное место для этой коллекции, чтобы навигацию не пришлось снова менять, когда появится более глубокая функциональность.",
  "app.collection.useNowEyebrow": "Использовать сейчас",
  "app.collection.useNowTitle": "Стабильный вход, ограниченное поведение",
  "app.collection.openLibrary": "Открыть библиотеку",
  "app.collection.browseTimeline": "Просмотреть таймлайн",
};

const messageCatalogs: Record<Locale, Partial<MessageCatalog>> = {
  en: enMessages,
  ru: ruMessages,
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, values?: TranslationValues) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function normalizeLocale(value: string | null | undefined): Locale | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("ru")) {
    return "ru";
  }

  if (normalized.startsWith("en")) {
    return "en";
  }

  return null;
}

export function getStoredLocalePreference(): Locale | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function getSystemLocalePreference(): Locale {
  if (typeof window === "undefined") {
    return "en";
  }

  const languages = Array.isArray(window.navigator.languages)
    ? window.navigator.languages
    : [window.navigator.language];

  for (const language of languages) {
    const locale = normalizeLocale(language);
    if (locale) {
      return locale;
    }
  }

  return "en";
}

export function resolveInitialLocale(): Locale {
  return getStoredLocalePreference() ?? getSystemLocalePreference();
}

export function applyLocale(locale: Locale) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;
}

export function persistLocalePreference(locale: Locale) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore storage write errors and keep the in-memory locale active.
  }
}

export function getActiveLocale(): Locale {
  if (typeof document !== "undefined") {
    const fromDocument = normalizeLocale(document.documentElement.lang);
    if (fromDocument) {
      return fromDocument;
    }
  }

  return resolveInitialLocale();
}

function interpolateMessage(
  template: string,
  values: TranslationValues | undefined,
) {
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const replacement = values[token];
    return replacement == null ? `{${token}}` : String(replacement);
  });
}

export function translateMessage(
  locale: Locale,
  key: MessageKey,
  values?: TranslationValues,
) {
  return interpolateMessage(
    messageCatalogs[locale][key] ?? enMessages[key],
    values,
  );
}

export function I18nProvider({ children }: PropsWithChildren) {
  const [locale, setLocale] = useState<Locale>(() => resolveInitialLocale());

  useEffect(() => {
    applyLocale(locale);
    persistLocalePreference(locale);
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, values) => translateMessage(locale, key, values),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === null) {
    throw new Error("useI18n must be used within I18nProvider.");
  }

  return context;
}

export const localeBootstrapScript = `
  (() => {
    try {
      const normalizeLocale = (value) => {
        const normalized = value?.trim?.().toLowerCase?.();
        if (!normalized) {
          return null;
        }
        if (normalized.startsWith("ru")) {
          return "ru";
        }
        if (normalized.startsWith("en")) {
          return "en";
        }
        return null;
      };
      const storedLocale = normalizeLocale(
        window.localStorage.getItem("${LOCALE_STORAGE_KEY}"),
      );
      const browserLocale =
        Array.isArray(window.navigator.languages) &&
        window.navigator.languages.length > 0
          ? window.navigator.languages
              .map((value) => normalizeLocale(value))
              .find(Boolean)
          : normalizeLocale(window.navigator.language);
      const locale = storedLocale ?? browserLocale ?? "en";
      document.documentElement.lang = locale;
      document.documentElement.dataset.locale = locale;
    } catch {
      document.documentElement.lang = "en";
      document.documentElement.dataset.locale = "en";
    }
  })();
`;
