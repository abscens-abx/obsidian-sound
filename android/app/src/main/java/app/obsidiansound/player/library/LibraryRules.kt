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

    /** JSON numbers may be Integer, Long or Double at the Capacitor boundary. */
    fun cursor(value: Any?): Long {
        if (value == null) return 0L
        require(value is Number) { "Invalid MediaStore cursor" }
        val number = value.toDouble()
        require(number.isFinite() && number >= 0 && number <= 9007199254740991.0 && number % 1.0 == 0.0) {
            "Invalid MediaStore cursor"
        }
        return value.toLong()
    }

    fun trackParts(value: Long?): Pair<Long?, Long?> = when {
        value == null || value <= 0 -> null to null
        value >= 1000 -> (value % 1000).takeIf { it > 0 } to value / 1000
        else -> value to null
    }
}