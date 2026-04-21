package dev.pina.backend.service;

import dev.pina.backend.domain.Album;
import dev.pina.backend.domain.AlbumPhoto;
import dev.pina.backend.domain.Favorite;
import dev.pina.backend.domain.FavoriteTargetType;
import dev.pina.backend.domain.Photo;
import dev.pina.backend.domain.User;
import dev.pina.backend.pagination.PageRequest;
import dev.pina.backend.pagination.PageResult;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@ApplicationScoped
public class SearchService {

	private static final int MAX_PAGE_SIZE = 100;
	private static final char LIKE_ESCAPE_CHAR = '!';

	@Inject
	EntityManager em;

	@Inject
	SpaceService spaceService;

	public PageResult<SearchHit> search(User user, SearchRequest request) {
		int effectiveSize = request.pageRequest().effectiveSize(MAX_PAGE_SIZE);
		String normalizedQuery = normalizeQuery(request.query());
		if (normalizedQuery.isBlank()) {
			return new PageResult<>(List.of(), request.pageRequest().page(), effectiveSize, false,
					request.pageRequest().needsTotal() ? 0L : null, request.pageRequest().needsTotal() ? 0L : null);
		}

		String likePattern = toContainsLikePattern(normalizedQuery);
		Set<UUID> accessibleSpaceIds = spaceService.listAccessibleSpaceIds(user.id);
		Set<UUID> favoritePhotoIds = loadFavoriteTargetIds(user.id, FavoriteTargetType.PHOTO);
		Set<UUID> favoriteAlbumIds = loadFavoriteTargetIds(user.id, FavoriteTargetType.ALBUM);

		Map<String, SearchAccumulator> hits = new LinkedHashMap<>();
		switch (request.scope()) {
			case ALL -> {
				addLibraryHits(user.id, normalizedQuery, likePattern, request.kind(), favoritePhotoIds,
						favoriteAlbumIds, hits);
				addSpaceHits(normalizedQuery, likePattern, request.kind(), accessibleSpaceIds, favoritePhotoIds,
						favoriteAlbumIds, hits);
			}
			case LIBRARY -> addLibraryHits(user.id, normalizedQuery, likePattern, request.kind(), favoritePhotoIds,
					favoriteAlbumIds, hits);
			case SPACES -> addSpaceHits(normalizedQuery, likePattern, request.kind(), accessibleSpaceIds,
					favoritePhotoIds, favoriteAlbumIds, hits);
			case FAVORITES -> {
				addLibraryHits(user.id, normalizedQuery, likePattern, request.kind(), favoritePhotoIds,
						favoriteAlbumIds, hits);
				addSpaceHits(normalizedQuery, likePattern, request.kind(), accessibleSpaceIds, favoritePhotoIds,
						favoriteAlbumIds, hits);
				hits.entrySet().removeIf(entry -> !entry.getValue().favorited);
			}
		}

		List<SearchHit> orderedHits = hits.values().stream().sorted(comparatorFor(request.sort()))
				.map(candidate -> candidate.toSearchHit(user.id, request.scope())).toList();
		int offset = request.pageRequest().offset(MAX_PAGE_SIZE);
		if (offset >= orderedHits.size()) {
			Long totalItems = request.pageRequest().needsTotal() ? (long) orderedHits.size() : null;
			Long totalPages = totalItems != null ? PageResult.totalPages(totalItems, effectiveSize) : null;
			return new PageResult<>(List.of(), request.pageRequest().page(), effectiveSize, false, totalItems,
					totalPages);
		}

		int lookaheadEnd = Math.min(orderedHits.size(), offset + effectiveSize + 1);
		List<SearchHit> lookahead = orderedHits.subList(offset, lookaheadEnd);
		boolean hasNext = lookahead.size() > effectiveSize;
		List<SearchHit> items = hasNext ? lookahead.subList(0, effectiveSize) : lookahead;
		Long totalItems = request.pageRequest().needsTotal() ? (long) orderedHits.size() : null;
		Long totalPages = totalItems != null ? PageResult.totalPages(totalItems, effectiveSize) : null;
		return new PageResult<>(items, request.pageRequest().page(), effectiveSize, hasNext, totalItems, totalPages);
	}

	public enum SearchScope {
		ALL, LIBRARY, SPACES, FAVORITES;

		public static SearchScope parse(String raw) {
			if (raw == null || raw.isBlank()) {
				return ALL;
			}
			try {
				return SearchScope.valueOf(raw.strip().toUpperCase(Locale.ROOT));
			} catch (IllegalArgumentException _) {
				throw new IllegalArgumentException("Invalid search scope: " + raw);
			}
		}
	}

	public enum SearchKind {
		ALL, PHOTO, ALBUM;

		public static SearchKind parse(String raw) {
			if (raw == null || raw.isBlank()) {
				return ALL;
			}
			try {
				return SearchKind.valueOf(raw.strip().toUpperCase(Locale.ROOT));
			} catch (IllegalArgumentException _) {
				throw new IllegalArgumentException("Invalid search kind: " + raw);
			}
		}
	}

	public enum SearchSort {
		RELEVANCE, NEWEST, OLDEST;

		public static SearchSort parse(String raw) {
			if (raw == null || raw.isBlank()) {
				return RELEVANCE;
			}
			try {
				return SearchSort.valueOf(raw.strip().toUpperCase(Locale.ROOT));
			} catch (IllegalArgumentException _) {
				throw new IllegalArgumentException("Invalid search sort: " + raw);
			}
		}
	}

	public enum SearchEntryScope {
		LIBRARY, SPACES
	}

	public enum SearchResultKind {
		PHOTO, ALBUM
	}

	public record SearchRequest(String query, SearchScope scope, SearchKind kind, SearchSort sort,
			PageRequest pageRequest) {
	}

	public record SearchHit(SearchResultKind kind, SearchEntryScope entryScope, boolean favorited, Photo photo,
			Album album, UUID albumId, String albumName, UUID spaceId, String spaceName) {
	}

	private void addLibraryHits(UUID userId, String normalizedQuery, String likePattern, SearchKind kind,
			Set<UUID> favoritePhotoIds, Set<UUID> favoriteAlbumIds, Map<String, SearchAccumulator> hits) {
		if (kind == SearchKind.ALL || kind == SearchKind.PHOTO) {
			for (Photo photo : loadLibraryPhotoMatches(userId, likePattern)) {
				mergePhotoHit(hits, photo, null, null, null, null, favoritePhotoIds.contains(photo.id),
						computePhotoScore(photo, normalizedQuery));
			}
		}
		if (kind == SearchKind.ALL || kind == SearchKind.ALBUM) {
			for (Album album : loadLibraryAlbumMatches(userId, likePattern)) {
				mergeAlbumHit(hits, album, null, null, favoriteAlbumIds.contains(album.id),
						computeAlbumScore(album, normalizedQuery));
			}
		}
	}

	private void addSpaceHits(String normalizedQuery, String likePattern, SearchKind kind, Set<UUID> accessibleSpaceIds,
			Set<UUID> favoritePhotoIds, Set<UUID> favoriteAlbumIds, Map<String, SearchAccumulator> hits) {
		if (accessibleSpaceIds.isEmpty()) {
			return;
		}
		if (kind == SearchKind.ALL || kind == SearchKind.PHOTO) {
			for (AlbumPhoto albumPhoto : loadSpacePhotoMatches(accessibleSpaceIds, likePattern)) {
				mergePhotoHit(hits, albumPhoto.photo, albumPhoto.album.id, albumPhoto.album.name,
						albumPhoto.album.space.id, albumPhoto.album.space.name,
						favoritePhotoIds.contains(albumPhoto.photo.id),
						computePhotoScore(albumPhoto.photo, normalizedQuery));
			}
		}
		if (kind == SearchKind.ALL || kind == SearchKind.ALBUM) {
			for (Album album : loadSpaceAlbumMatches(accessibleSpaceIds, likePattern)) {
				mergeAlbumHit(hits, album, album.space.id, album.space.name, favoriteAlbumIds.contains(album.id),
						computeAlbumScore(album, normalizedQuery));
			}
		}
	}

	private void mergePhotoHit(Map<String, SearchAccumulator> hits, Photo photo, UUID albumId, String albumName,
			UUID spaceId, String spaceName, boolean favorited, int relevanceScore) {
		String key = SearchResultKind.PHOTO.name() + ":" + photo.id;
		SearchAccumulator accumulator = hits.computeIfAbsent(key, _ -> new SearchAccumulator(SearchResultKind.PHOTO,
				photo.id, photo.createdAt != null ? photo.createdAt : OffsetDateTime.MIN));
		if (accumulator.photo == null) {
			accumulator.photo = photo;
			accumulator.sortTimestamp = photo.takenAt != null ? photo.takenAt : photo.createdAt;
		}
		accumulator.relevanceScore = Math.max(accumulator.relevanceScore, relevanceScore);
		accumulator.favorited = accumulator.favorited || favorited;
		if (spaceId != null && shouldReplaceSpaceContext(accumulator, spaceName, albumName, albumId)) {
			accumulator.spaceId = spaceId;
			accumulator.spaceName = spaceName;
			accumulator.albumId = albumId;
			accumulator.albumName = albumName;
		}
	}

	private void mergeAlbumHit(Map<String, SearchAccumulator> hits, Album album, UUID spaceId, String spaceName,
			boolean favorited, int relevanceScore) {
		String key = SearchResultKind.ALBUM.name() + ":" + album.id;
		SearchAccumulator accumulator = hits.computeIfAbsent(key, _ -> new SearchAccumulator(SearchResultKind.ALBUM,
				album.id, album.updatedAt != null ? album.updatedAt : album.createdAt));
		if (accumulator.album == null) {
			accumulator.album = album;
			accumulator.sortTimestamp = album.updatedAt != null ? album.updatedAt : album.createdAt;
		}
		accumulator.relevanceScore = Math.max(accumulator.relevanceScore, relevanceScore);
		accumulator.favorited = accumulator.favorited || favorited;
		if (spaceId != null && shouldReplaceSpaceContext(accumulator, spaceName, album.name, album.id)) {
			accumulator.spaceId = spaceId;
			accumulator.spaceName = spaceName;
		}
	}

	private boolean shouldReplaceSpaceContext(SearchAccumulator accumulator, String spaceName, String albumName,
			UUID albumId) {
		if (accumulator.spaceId == null) {
			return true;
		}
		String currentSpaceName = accumulator.spaceName != null ? accumulator.spaceName : "";
		String nextSpaceName = spaceName != null ? spaceName : "";
		int spaceComparison = nextSpaceName.compareToIgnoreCase(currentSpaceName);
		if (spaceComparison != 0) {
			return spaceComparison < 0;
		}
		String currentAlbumName = accumulator.albumName != null ? accumulator.albumName : "";
		String nextAlbumName = albumName != null ? albumName : "";
		int albumComparison = nextAlbumName.compareToIgnoreCase(currentAlbumName);
		if (albumComparison != 0) {
			return albumComparison < 0;
		}
		return albumId != null && accumulator.albumId != null
				&& albumId.toString().compareTo(accumulator.albumId.toString()) < 0;
	}

	private List<Photo> loadLibraryPhotoMatches(UUID userId, String likePattern) {
		return em.createQuery("""
				SELECT DISTINCT p
				FROM Photo p
				LEFT JOIN FETCH p.variants
				LEFT JOIN FETCH p.uploader
				LEFT JOIN FETCH p.personalLibrary
				WHERE p.uploader.id = :userId
				  AND LOWER(COALESCE(p.originalFilename, '')) LIKE :pattern ESCAPE '!'
				""", Photo.class).setParameter("userId", userId).setParameter("pattern", likePattern).getResultList();
	}

	private List<AlbumPhoto> loadSpacePhotoMatches(Set<UUID> accessibleSpaceIds, String likePattern) {
		return em.createQuery("""
				SELECT DISTINCT ap
				FROM AlbumPhoto ap
				JOIN FETCH ap.photo p
				LEFT JOIN FETCH p.variants
				JOIN FETCH p.uploader
				JOIN FETCH p.personalLibrary
				JOIN FETCH ap.album a
				JOIN FETCH a.space s
				WHERE s.id IN :spaceIds
				  AND LOWER(COALESCE(p.originalFilename, '')) LIKE :pattern ESCAPE '!'
				""", AlbumPhoto.class).setParameter("spaceIds", accessibleSpaceIds).setParameter("pattern", likePattern)
				.getResultList();
	}

	private List<Album> loadLibraryAlbumMatches(UUID userId, String likePattern) {
		return em.createQuery("""
				SELECT a
				FROM Album a
				LEFT JOIN FETCH a.owner
				LEFT JOIN FETCH a.personalLibrary
				WHERE a.owner.id = :userId
				  AND a.space IS NULL
				  AND (
				      LOWER(COALESCE(a.name, '')) LIKE :pattern ESCAPE '!'
				      OR LOWER(COALESCE(a.description, '')) LIKE :pattern ESCAPE '!'
				  )
				""", Album.class).setParameter("userId", userId).setParameter("pattern", likePattern).getResultList();
	}

	private List<Album> loadSpaceAlbumMatches(Set<UUID> accessibleSpaceIds, String likePattern) {
		return em.createQuery("""
				SELECT a
				FROM Album a
				LEFT JOIN FETCH a.owner
				JOIN FETCH a.space s
				WHERE s.id IN :spaceIds
				  AND (
				      LOWER(COALESCE(a.name, '')) LIKE :pattern ESCAPE '!'
				      OR LOWER(COALESCE(a.description, '')) LIKE :pattern ESCAPE '!'
				  )
				""", Album.class).setParameter("spaceIds", accessibleSpaceIds).setParameter("pattern", likePattern)
				.getResultList();
	}

	private Set<UUID> loadFavoriteTargetIds(UUID userId, FavoriteTargetType targetType) {
		return Favorite.<Favorite>list("user.id = ?1 and targetType = ?2", userId, targetType).stream()
				.map(favorite -> favorite.targetId).collect(Collectors.toSet());
	}

	private String normalizeQuery(String query) {
		return query == null ? "" : query.strip().toLowerCase(Locale.ROOT);
	}

	private String toContainsLikePattern(String normalizedQuery) {
		String escape = String.valueOf(LIKE_ESCAPE_CHAR);
		String escapedQuery = normalizedQuery.replace(escape, escape + escape).replace("%", escape + "%").replace("_",
				escape + "_");
		return "%" + escapedQuery + "%";
	}

	private int computePhotoScore(Photo photo, String normalizedQuery) {
		int score = 0;
		String filename = normalizeQuery(photo.originalFilename);
		if (filename.equals(normalizedQuery)) {
			score += 120;
		} else if (filename.startsWith(normalizedQuery)) {
			score += 90;
		} else if (filename.contains(normalizedQuery)) {
			score += 60;
		}
		return score;
	}

	private int computeAlbumScore(Album album, String normalizedQuery) {
		int score = 0;
		String name = normalizeQuery(album.name);
		String description = normalizeQuery(album.description);
		if (name.equals(normalizedQuery)) {
			score += 120;
		} else if (name.startsWith(normalizedQuery)) {
			score += 90;
		} else if (name.contains(normalizedQuery)) {
			score += 60;
		}
		if (!description.isBlank() && description.contains(normalizedQuery)) {
			score += 20;
		}
		return score;
	}

	private Comparator<SearchAccumulator> comparatorFor(SearchSort sort) {
		Comparator<SearchAccumulator> byTimestampDesc = Comparator
				.comparing((SearchAccumulator candidate) -> candidate.sortTimestamp,
						Comparator.nullsLast(Comparator.naturalOrder()))
				.reversed();
		Comparator<SearchAccumulator> byTimestampAsc = Comparator.comparing(
				(SearchAccumulator candidate) -> candidate.sortTimestamp,
				Comparator.nullsLast(Comparator.naturalOrder()));
		Comparator<SearchAccumulator> byId = Comparator.comparing(candidate -> candidate.id.toString());
		return switch (sort) {
			case RELEVANCE -> Comparator.comparingInt((SearchAccumulator candidate) -> candidate.relevanceScore)
					.reversed().thenComparing(byTimestampDesc).thenComparing(byId);
			case NEWEST -> byTimestampDesc.thenComparing(byId);
			case OLDEST -> byTimestampAsc.thenComparing(byId);
		};
	}

	private static final class SearchAccumulator {

		private final SearchResultKind kind;
		private final UUID id;
		private OffsetDateTime sortTimestamp;
		private int relevanceScore;
		private boolean favorited;
		private Photo photo;
		private Album album;
		private UUID albumId;
		private String albumName;
		private UUID spaceId;
		private String spaceName;

		private SearchAccumulator(SearchResultKind kind, UUID id, OffsetDateTime sortTimestamp) {
			this.kind = kind;
			this.id = id;
			this.sortTimestamp = sortTimestamp;
		}

		private SearchHit toSearchHit(UUID userId, SearchScope requestedScope) {
			return new SearchHit(kind, entryScopeFor(userId, requestedScope), favorited, photo, album, albumId,
					albumName, spaceId, spaceName);
		}

		private SearchEntryScope entryScopeFor(UUID userId, SearchScope requestedScope) {
			if (kind == SearchResultKind.ALBUM) {
				return album.space != null ? SearchEntryScope.SPACES : SearchEntryScope.LIBRARY;
			}
			return switch (requestedScope) {
				case SPACES -> spaceId != null ? SearchEntryScope.SPACES : SearchEntryScope.LIBRARY;
				case FAVORITES -> spaceId != null ? SearchEntryScope.SPACES : SearchEntryScope.LIBRARY;
				case ALL, LIBRARY ->
					photo.uploader.id.equals(userId) ? SearchEntryScope.LIBRARY : SearchEntryScope.SPACES;
			};
		}
	}
}
