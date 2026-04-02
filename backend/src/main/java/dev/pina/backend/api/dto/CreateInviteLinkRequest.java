package dev.pina.backend.api.dto;

import dev.pina.backend.domain.SpaceRole;
import java.time.OffsetDateTime;

public record CreateInviteLinkRequest(SpaceRole defaultRole, OffsetDateTime expiration, Integer usageLimit) {
}
