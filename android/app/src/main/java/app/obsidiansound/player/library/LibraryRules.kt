package app.obsidiansound.player.library

/** Pure policy; no Android dependencies so these rules can be unit tested. */
internal object LibraryRules {
    fun permissionAlias(api: Int): String = if (api >= 33) "audio" else "legacyAudio"

    fun isContentUri(value: String): Boolean =
        Regex("^content://[^/\\s?#]+/[^\\s?#]+$").matches(value)

    fun isAudio(mime: String?, name: String?): Boolean {
        if (mime?.startsWith("audio/", ignoreCase = true) == true) return true
        // Extension fallback only for providers without a useful MIME type.
        if (!mime.isNullOrBlank() && mime != "application/octet-stream" && mime != "application/ogg") return false
        return name?.substringAfterLast('.', "")?.lowercase() in
            setOf("mp3", "m4a", "aac", "flac", "wav", "ogg", "opus", "aif", "aiff", "wma", "amr")
    }

    fun pageSize(requested: Int): Int = requested.coerceIn(1, 500)
}