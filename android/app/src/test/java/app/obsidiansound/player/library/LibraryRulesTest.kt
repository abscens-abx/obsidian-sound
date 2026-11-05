package app.obsidiansound.player.library

import org.junit.Assert.*
import org.junit.Test

class LibraryRulesTest {
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