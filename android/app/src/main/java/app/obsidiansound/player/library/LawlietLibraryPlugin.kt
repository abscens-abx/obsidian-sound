package app.obsidiansound.player.library

import android.Manifest
import android.app.Activity
import android.content.ContentUris
import android.content.Intent
import android.database.Cursor
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.provider.DocumentsContract
import android.provider.MediaStore
import android.provider.OpenableColumns
import android.provider.Settings
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONObject
import java.util.ArrayDeque
import java.util.concurrent.Executors

@CapacitorPlugin(
    name = "LawlietLibrary",
    permissions = [
        Permission(alias = "audio", strings = [Manifest.permission.READ_MEDIA_AUDIO]),
        Permission(alias = "legacyAudio", strings = [Manifest.permission.READ_EXTERNAL_STORAGE])
    ]
)
class LawlietLibraryPlugin : Plugin() {
    private val worker = Executors.newSingleThreadExecutor()
    private val audioUri: Uri get() = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI

    private fun obj(vararg fields: Pair<String, Any?>): JSObject = JSObject().apply {
        fields.forEach { (key, value) -> put(key, value ?: JSONObject.NULL) }
    }

    private fun background(call: PluginCall, work: () -> JSObject) {
        worker.execute {
            try {
                call.resolve(work())
            } catch (e: SecurityException) {
                call.reject("Read access was denied or revoked. Choose the folder again or grant music access.", "ACCESS_DENIED", e)
            } catch (e: Exception) {
                call.reject("The audio provider could not complete this operation. ${e.message ?: "Try again."}", "PROVIDER_ERROR", e)
            }
        }
    }

    override fun handleOnDestroy() {
        worker.shutdownNow()
        super.handleOnDestroy()
    }

    private fun permissionResult(): JSObject {
        val state = when (getPermissionState(LibraryRules.permissionAlias(Build.VERSION.SDK_INT))) {
            PermissionState.GRANTED -> "granted"
            PermissionState.DENIED -> "denied"
            PermissionState.PROMPT_WITH_RATIONALE -> "prompt-with-rationale"
            else -> "prompt"
        }
        return obj("state" to state)
    }

    @PluginMethod
    fun checkAudioPermission(call: PluginCall) = call.resolve(permissionResult())

    @PluginMethod
    fun requestAudioPermission(call: PluginCall) {
        if (getPermissionState(LibraryRules.permissionAlias(Build.VERSION.SDK_INT)) == PermissionState.GRANTED) {
            call.resolve(permissionResult())
        } else {
            requestPermissionForAlias(LibraryRules.permissionAlias(Build.VERSION.SDK_INT), call, "audioPermissionResult")
        }
    }

    @PermissionCallback
    private fun audioPermissionResult(call: PluginCall) = call.resolve(permissionResult())

    @PluginMethod
    fun openAppSettings(call: PluginCall) {
        try {
            activity.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")))
            call.resolve()
        } catch (e: Exception) {
            call.reject("App settings could not be opened.", "SETTINGS_UNAVAILABLE", e)
        }
    }

    private fun requireAudioAccess() {
        if (getPermissionState(LibraryRules.permissionAlias(Build.VERSION.SDK_INT)) != PermissionState.GRANTED) {
            throw SecurityException("Music access is not granted")
        }
    }

    @PluginMethod
    fun countMediaStore(call: PluginCall) = background(call) {
        requireAudioAccess()
        val cursor = context.contentResolver.query(audioUri, arrayOf(MediaStore.Audio.Media._ID),
            "${MediaStore.Audio.Media.IS_MUSIC} != 0", null, null)
            ?: throw IllegalStateException("MediaStore did not return a cursor")
        cursor.use { obj("count" to it.count) }
    }

    @PluginMethod
    fun queryMediaStore(call: PluginCall) = background(call) {
        requireAudioAccess()
        val after = call.getLong("afterId") ?: 0L
        require(after >= 0) { "Invalid MediaStore cursor" }
        val limit = LibraryRules.pageSize(call.getInt("limit") ?: 250)
        val projection = arrayOf(MediaStore.Audio.Media._ID, MediaStore.Audio.Media.DISPLAY_NAME,
            MediaStore.Audio.Media.TITLE, MediaStore.Audio.Media.ARTIST, MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.ALBUM_ID, MediaStore.Audio.Media.TRACK, MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.YEAR, MediaStore.Audio.Media.MIME_TYPE, MediaStore.Audio.Media.SIZE,
            MediaStore.Audio.Media.DATE_MODIFIED)
        // Keyset pagination, never offsets or filesystem paths. Read one extra row for exhaustion.
        val cursor = context.contentResolver.query(audioUri, projection,
            "${MediaStore.Audio.Media.IS_MUSIC} != 0 AND ${MediaStore.Audio.Media._ID} > ?",
            arrayOf(after.toString()), "${MediaStore.Audio.Media._ID} ASC")
            ?: throw IllegalStateException("MediaStore did not return a cursor")
        val items = JSArray()
        var last = after
        var done = true
        cursor.use { c ->
            while (c.moveToNext()) {
                if (items.length() >= limit) { done = false; break }
                if (Thread.currentThread().isInterrupted) throw InterruptedException("Scan interrupted")
                val id = c.number(MediaStore.Audio.Media._ID) ?: throw IllegalStateException("Missing audio identity")
                check(id > last) { "MediaStore returned an unordered page" }
                last = id
                val uri = ContentUris.withAppendedId(audioUri, id)
                val item = obj("uri" to uri.toString(), "mediaStoreId" to id,
                    "displayName" to c.text(MediaStore.Audio.Media.DISPLAY_NAME),
                    "title" to c.text(MediaStore.Audio.Media.TITLE), "artist" to c.text(MediaStore.Audio.Media.ARTIST),
                    "album" to c.text(MediaStore.Audio.Media.ALBUM), "track" to c.number(MediaStore.Audio.Media.TRACK),
                    "durationMs" to c.number(MediaStore.Audio.Media.DURATION), "year" to c.number(MediaStore.Audio.Media.YEAR),
                    "mimeType" to c.text(MediaStore.Audio.Media.MIME_TYPE), "sizeBytes" to c.number(MediaStore.Audio.Media.SIZE),
                    "modifiedMs" to c.number(MediaStore.Audio.Media.DATE_MODIFIED)?.times(1000))
                // Read embedded tags. Per-document errors do not abort the page, but TS treats it as partial.
                try { readTags(uri, item) } catch (e: Exception) { item.put("error", e.message ?: "Metadata could not be read") }
                items.put(item)
            }
        }
        obj("items" to items, "lastId" to last, "done" to done)
    }

    @PluginMethod
    fun pickFolder(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or Intent.FLAG_GRANT_PREFIX_URI_PERMISSION)
        }
        try { startActivityForResult(call, intent, "folderPicked") }
        catch (e: Exception) { call.reject("The system folder picker is unavailable.", "PICKER_UNAVAILABLE", e) }
    }

    @ActivityCallback
    private fun folderPicked(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        if (result.resultCode != Activity.RESULT_OK) {
            call.resolve(obj("cancelled" to true)); return
        }
        val uri = result.data?.data
        if (uri == null || uri.scheme != "content" || !DocumentsContract.isTreeUri(uri)) {
            call.reject("The picker did not return an accessible folder.", "INVALID_TREE"); return
        }
        background(call) {
            val flags = (result.data?.flags ?: 0) and Intent.FLAG_GRANT_READ_URI_PERMISSION
            if (flags == 0) throw SecurityException("The folder provider did not grant read access")
            context.contentResolver.takePersistableUriPermission(uri, flags)
            check(hasAccess(uri)) { "Read access to this folder could not be saved" }
            val root = DocumentsContract.buildDocumentUriUsingTree(uri, DocumentsContract.getTreeDocumentId(uri))
            val name = context.contentResolver.query(root, arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null)
                ?.use { if (it.moveToFirst()) it.text(DocumentsContract.Document.COLUMN_DISPLAY_NAME) else null }
            obj("cancelled" to false, "treeUri" to uri.toString(), "displayName" to (name ?: "Folder"))
        }
    }

    private fun contentUri(value: String?): Uri {
        require(value != null && LibraryRules.isContentUri(value)) { "Only content URIs are accepted" }
        return Uri.parse(value)
    }

    private fun treeUri(call: PluginCall): Uri {
        val uri = contentUri(call.getString("treeUri"))
        require(DocumentsContract.isTreeUri(uri)) { "A folder tree URI is required" }
        return uri
    }

    private fun hasAccess(uri: Uri): Boolean = context.contentResolver.persistedUriPermissions.any {
        it.uri == uri && it.isReadPermission
    }

    @PluginMethod
    fun hasFolderAccess(call: PluginCall) = background(call) {
        val uri = treeUri(call)
        if (!hasAccess(uri)) return@background obj("granted" to false)
        val root = DocumentsContract.buildDocumentUriUsingTree(uri, DocumentsContract.getTreeDocumentId(uri))
        val readable = context.contentResolver.query(root, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID), null, null, null)
            ?.use { it.moveToFirst() } ?: false
        obj("granted" to readable)
    }

    @PluginMethod
    fun listFolderAudio(call: PluginCall) = background(call) {
        val tree = treeUri(call)
        if (!hasAccess(tree)) throw SecurityException("Folder access has been revoked")
        val pending = ArrayDeque<String>()
        pending.add(DocumentsContract.getTreeDocumentId(tree))
        val visited = HashSet<String>()
        val items = JSArray()
        var entries = 0
        var truncated = false
        val projection = arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_SIZE, DocumentsContract.Document.COLUMN_LAST_MODIFIED)
        var bounded = false
        while (pending.isNotEmpty() && !bounded) {
            if (Thread.currentThread().isInterrupted) throw InterruptedException("Folder listing interrupted")
            val id = pending.removeFirst()
            if (!visited.add(id)) continue
            val children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, id)
            val cursor = context.contentResolver.query(children, projection, null, null, null)
                ?: throw IllegalStateException("The folder provider did not return its contents")
            cursor.use { c ->
                // Loading flag means the provider returned only a partial listing.
                if (c.extras.getBoolean(DocumentsContract.EXTRA_LOADING, false)) truncated = true
                while (c.moveToNext()) {
                    entries++
                    if (entries > 50000 || items.length() >= 20000) { truncated = true; bounded = true; break }
                    val childId = c.text(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
                        ?: throw IllegalStateException("Missing document identity")
                    val mime = c.text(DocumentsContract.Document.COLUMN_MIME_TYPE)
                    val name = c.text(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
                    if (mime == DocumentsContract.Document.MIME_TYPE_DIR) pending.add(childId)
                    else if (LibraryRules.isAudio(mime, name)) {
                        val uri = DocumentsContract.buildDocumentUriUsingTree(tree, childId)
                        items.put(obj("uri" to uri.toString(), "displayName" to name, "mimeType" to mime,
                            "sizeBytes" to c.number(DocumentsContract.Document.COLUMN_SIZE),
                            "modifiedMs" to c.number(DocumentsContract.Document.COLUMN_LAST_MODIFIED)))
                    }
                }
            }
        }
        obj("items" to items, "truncated" to truncated)
    }

    @PluginMethod
    fun readMetadata(call: PluginCall) = background(call) {
        val uris = call.getArray("uris") ?: throw IllegalArgumentException("Missing audio URIs")
        require(uris.length() <= 500) { "Metadata batches are limited to 500 documents" }
        val items = JSArray()
        for (i in 0 until uris.length()) {
            val value = uris.getString(i)
            val item = obj("uri" to value)
            try {
                val uri = contentUri(value)
                val cursor = context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)
                    ?: throw IllegalStateException("The provider could not read this document")
                cursor.use { c ->
                    check(c.moveToFirst()) { "The document is no longer present" }
                    item.put("displayName", c.text(OpenableColumns.DISPLAY_NAME) ?: JSONObject.NULL)
                    item.put("sizeBytes", c.number(OpenableColumns.SIZE) ?: JSONObject.NULL)
                }
                item.put("mimeType", context.contentResolver.getType(uri) ?: JSONObject.NULL)
                readTags(uri, item)
            } catch (e: Exception) { item.put("error", e.message ?: "Audio metadata could not be read") }
            items.put(item)
        }
        obj("items" to items)
    }

    private fun readTags(uri: Uri, item: JSObject) {
        val reader = MediaMetadataRetriever()
        try {
            reader.setDataSource(context, uri)
            val tags = mapOf("title" to MediaMetadataRetriever.METADATA_KEY_TITLE,
                "artist" to MediaMetadataRetriever.METADATA_KEY_ARTIST, "albumArtist" to MediaMetadataRetriever.METADATA_KEY_ALBUMARTIST,
                "album" to MediaMetadataRetriever.METADATA_KEY_ALBUM, "track" to MediaMetadataRetriever.METADATA_KEY_CD_TRACK_NUMBER,
                "disc" to MediaMetadataRetriever.METADATA_KEY_DISC_NUMBER, "durationMs" to MediaMetadataRetriever.METADATA_KEY_DURATION,
                "year" to MediaMetadataRetriever.METADATA_KEY_YEAR, "genre" to MediaMetadataRetriever.METADATA_KEY_GENRE)
            tags.forEach { (key, tag) -> reader.extractMetadata(tag)?.takeIf { it.isNotBlank() }?.let { item.put(key, it) } }
            // No artwork bytes or audio bytes cross the bridge; tag fields only.
        } finally { reader.release() }
    }

    private fun Cursor.text(column: String): String? {
        val index = getColumnIndex(column)
        return if (index < 0 || isNull(index)) null else getString(index)
    }

    private fun Cursor.number(column: String): Long? {
        val index = getColumnIndex(column)
        return if (index < 0 || isNull(index)) null else getLong(index)
    }
}