package app.obsidiansound.player.library

import org.junit.Assert.*
import org.junit.Test

class LibraryRulesTest {
    @Test fun acceptsSmallAndLargeBridgeCursors() {
        assertEquals(42L, LibraryRules.cursor(42))
        assertEquals(4294967296L, LibraryRules.cursor(4294967296L))
        assertEquals(42L, LibraryRules.cursor(42.0))
        assertEquals(0L, LibraryRules.cursor(null))
        for (invalid in listOf(-1, 1.5, "42", Double.NaN, 9007199254740992.0)) {
            try { LibraryRules.cursor(invalid); fail("Accepted invalid cursor") }
            catch (_: IllegalArgumentException) { }
        }
    }
    @Test fun decodesDiscBeforeEmbeddedTrackEnrichment() {
        assertEquals(3L to 1L, LibraryRules.trackParts(1003))
        assertEquals(7L to null, LibraryRules.trackParts(7))
        assertEquals(null to null, LibraryRules.trackParts(0))
    }
    @Test fun audioPermissionUsesApi33Boundary() {
        assertEquals("legacyAudio", LibraryRules.permissionAlias(24))
        assertEquals("legacyAudio", LibraryRules.permissionAlias(32))
        assertEquals("audio", LibraryRules.permissionAlias(33))
        assertEquals("audio", LibraryRules.permissionAlias(36))
    }
    @Test fun acceptsOnlyOpaqueContentReferences() {
        assertTrue(LibraryRules.isContentUri("content://provider/tree/music%3A/document/track%2F1"))
        assertFalse(LibraryRules.isContentUri("file:///sdcard/music.mp3"))
        assertFalse(LibraryRules.isContentUri("https://example.com/music.mp3"))
        assertFalse(LibraryRules.isContentUri("content://provider/has space"))
    }
    @Test fun audioFilteringAndBatchBounds() {
        assertTrue(LibraryRules.isAudio("audio/flac", "track"))
        assertTrue(LibraryRules.isAudio(null, "TRACK.MP3"))
        assertFalse(LibraryRules.isAudio("video/mp4", "video.mp3"))
        assertEquals(1, LibraryRules.pageSize(0))
        assertEquals(500, LibraryRules.pageSize(1000))
    }
}