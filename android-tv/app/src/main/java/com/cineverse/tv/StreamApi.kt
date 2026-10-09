package com.cineverse.tv

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import java.util.Locale

public data class SubtitleTrack(public val language: String, public val url: String, public val mimeType: String? = null,
    public val headers: Map<String, String> = emptyMap(), public val label: String? = null)

public data class StreamOption(
    public val url: String,
    public val headers: Map<String, String>,
    public val quality: String,
    public val subtitles: List<SubtitleTrack>,
    public val source: String,
    public val expiresAt: Long,
    public val mimeType: String? = null,
) {
    public fun json(): String = JSONObject()
        .put("url", url)
        .put("headers", JSONObject(headers))
        .put("quality", quality)
        .put("subtitles", JSONArray(subtitles.map { JSONObject().put("lang", it.language).put("url", it.url)
            .put("mimeType", it.mimeType).put("headers", JSONObject(it.headers)).put("label", it.label) }))
        .put("source", source)
        .put("expiresAt", expiresAt)
        .put("mimeType", mimeType)
        .toString()

    public companion object {
        public fun from(json: JSONObject, nowMs: Long = System.currentTimeMillis()): StreamOption {
            val url = json.getString("url")
            check(url.toHttpUrlOrNull()?.isHttps == true) { "Stream URL must use HTTPS" }
            val expiresAt = json.optLong("expiresAt", 0)
            check(expiresAt == 0L || expiresAt > nowMs) { "Stream URL has expired" }
            val headers = parseHeaders(json.optJSONObject("headers"))
            val subtitles = json.optJSONArray("subtitles")?.objects().orEmpty().mapNotNull { item ->
                val subtitleUrl = item.optString("url")
                val mimeType = normalizeSubtitleMimeType(item.optString("mimeType")) ?: normalizeSubtitleMimeType(item.optString("format"))
                if (subtitleUrl.toHttpUrlOrNull()?.isHttps == true) SubtitleTrack(item.optString("lang", item.optString("language", "und")), subtitleUrl,
                    mimeType, parseHeaders(item.optJSONObject("headers")), item.optString("label").takeIf { it.isNotBlank() && it != "null" }) else null
            }
            val mimeType = normalizeMimeType(json.optString("mimeType")) ?: normalizeMimeType(json.optString("type"))
            return StreamOption(url, headers, json.optString("quality", "Auto"), subtitles,
                json.optString("source", "Source"), expiresAt, mimeType)
        }

        private fun normalizeMimeType(value: String): String? = when (value.substringBefore(';').trim().lowercase(Locale.ROOT)) {
            "hls", "m3u8", "application/x-mpegurl", "application/vnd.apple.mpegurl", "audio/mpegurl", "audio/x-mpegurl" -> "application/x-mpegURL"
            "mp4", "video/mp4" -> "video/mp4"
            else -> null
        }

        private fun normalizeSubtitleMimeType(value: String): String? = when (value.substringBefore(';').trim().lowercase(Locale.ROOT)) {
            "vtt", "webvtt", "text/vtt" -> "text/vtt"
            "srt", "subrip", "application/x-subrip", "application/srt" -> "application/x-subrip"
            "ass", "ssa", "text/x-ssa" -> "text/x-ssa"
            "ttml", "application/ttml+xml" -> "application/ttml+xml"
            else -> null
        }

        private fun parseHeaders(headerObject: JSONObject?): Map<String, String> {
            if (headerObject == null) return emptyMap()
            val headers = linkedMapOf<String, String>()
            headerObject.keys().asSequence().forEach { name ->
                val canonical = ALLOWED_HEADERS[name.lowercase(Locale.ROOT)] ?: return@forEach
                val value = headerObject.opt(name) as? String ?: return@forEach
                check(value.length <= 8192 && '\r' !in value && '\n' !in value && '\u0000' !in value) { "Invalid $canonical playback header" }
                headers[canonical] = value
            }
            return headers
        }

        private val ALLOWED_HEADERS: Map<String, String> = mapOf(
            "referer" to "Referer", "origin" to "Origin", "user-agent" to "User-Agent", "cookie" to "Cookie",
            "authorization" to "Authorization", "accept" to "Accept", "accept-language" to "Accept-Language",
        )
    }
}

public data class ServiceStatus(
    public val serviceVersion: String,
    public val adapters: Map<String, String>,
    public val brokenSources: Set<String>,
)

internal fun parseServiceStatus(json: JSONObject): ServiceStatus {
    val adaptersObject = json.optJSONObject("adapters") ?: JSONObject()
    val adapters = adaptersObject.keys().asSequence().associateWith { name ->
        val value = adaptersObject.optString(name, "broken").trim().lowercase(Locale.ROOT)
        if (value == "ok") "configured" else value
    }
    val broken = json.optJSONArray("broken_sources")?.let { array ->
        (0 until array.length()).map { array.optString(it) }.filter { it.isNotBlank() }.toSet()
    } ?: adapters.filterValues { it == "broken" }.keys
    return ServiceStatus(json.optString("serviceVersion", json.optString("version", "unknown")), adapters, broken)
}

internal data class ParsedStreams(val streams: List<StreamOption>, val warnings: List<String>)

/** Keeps partial provider failures visible while allowing other valid sources to play. */
internal fun parseStreams(body: JSONObject, nowMs: Long = System.currentTimeMillis()): ParsedStreams {
    val rows = when {
        body.has("streams") -> body.optJSONArray("streams") ?: throw IOException("Streaming service returned an invalid streams array")
        body.has("url") -> JSONArray().put(body)
        body.has("error") -> throw IOException(body.optString("error", "Streaming service returned an error"))
        else -> throw IOException("Streaming service returned no stream records")
    }
    val streams = mutableListOf<StreamOption>()
    val warnings = mutableListOf<String>()
    for (index in 0 until rows.length()) {
        try {
            val record = rows.optJSONObject(index) ?: throw IOException("Expected a stream object")
            streams.add(StreamOption.from(record, nowMs))
        } catch (error: Exception) {
            warnings.add("Stream ${index + 1}: ${error.message ?: "Invalid stream record"}")
        }
    }
    if (streams.isEmpty() && warnings.isNotEmpty()) throw IOException("No usable stream records. ${warnings.joinToString("; ")}")
    return ParsedStreams(streams.distinctBy { it.url to it.headers }, warnings)
}

internal data class StreamCacheKey(
    val backend: String,
    val mediaKey: String,
    val season: Int,
    val episode: Int,
    val excluded: Set<String>,
) {
    fun filename(): String {
        val identity = JSONObject().put("backend", backend).put("media", mediaKey)
            .put("season", season).put("episode", episode).put("exclude", JSONArray(excluded.sorted())).toString()
        return MessageDigest.getInstance("SHA-256").digest(identity.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it.toInt() and 0xff) } + ".json"
    }
}

/** Device-private disk cache; never stores failures, empty results or expired URLs. */
internal class StreamDiskCache(private val directory: File) {
    @Synchronized fun read(key: StreamCacheKey, nowMs: Long): List<StreamOption>? {
        val file = File(directory, key.filename())
        if (!file.isFile) return null
        return try {
            val body = JSONObject(file.readText())
            val cachedAt = body.optLong("cachedAt", -1)
            if (cachedAt < 0 || nowMs < cachedAt || nowMs - cachedAt >= TTL_MS) {
                file.delete()
                null
            } else {
                val streams = parseStreams(body, nowMs).streams.filterNot { it.source in key.excluded }
                if (streams.isEmpty()) { file.delete(); null } else streams
            }
        } catch (_: Exception) {
            file.delete()
            null
        }
    }

    @Synchronized fun write(key: StreamCacheKey, streams: List<StreamOption>, nowMs: Long): Unit {
        val usable = streams.filter { (it.expiresAt == 0L || it.expiresAt > nowMs) && it.source !in key.excluded }
        if (usable.isEmpty()) return
        if (!directory.exists() && !directory.mkdirs()) return
        val body = JSONObject().put("cachedAt", nowMs).put("streams", JSONArray(usable.map { JSONObject(it.json()) }))
        val target = File(directory, key.filename())
        val temporary = File.createTempFile("stream-", ".tmp", directory)
        try {
            temporary.writeText(body.toString())
            try {
                Files.move(temporary.toPath(), target.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
            } catch (_: IOException) {
                Files.move(temporary.toPath(), target.toPath(), StandardCopyOption.REPLACE_EXISTING)
            }
            directory.listFiles()?.filter { it.extension == "json" }?.sortedByDescending { it.lastModified() }?.forEachIndexed { index, file ->
                if (index >= 64 || nowMs - file.lastModified() >= TTL_MS) file.delete()
            }
        } finally {
            temporary.delete()
        }
    }

    companion object { const val TTL_MS: Long = 30 * 60_000L }
}

public class StreamApi(baseUrl: String, context: Context? = null) {
    private val baseUrl = baseUrl.trim().trimEnd('/')
    private val diskCache = context?.applicationContext?.cacheDir?.let { StreamDiskCache(File(it, "cineverse-streams")) }
    public var lastWarnings: List<String> = emptyList()
        private set

    init {
        require(this.baseUrl.toHttpUrlOrNull()?.isHttps == true) { "Configure an HTTPS playback service URL in Settings" }
    }

    public suspend fun status(): ServiceStatus {
        val json = JSONObject(Http.request("$baseUrl/version", requestClient = Http.resolverClient))
        return parseServiceStatus(json)
    }

    public suspend fun streams(media: Media, season: Int = 0, episode: Int = 0,
        exclude: Set<String> = emptySet(), onWake: (() -> Unit)? = null): List<StreamOption> {
        lastWarnings = emptyList()
        val key = StreamCacheKey(baseUrl, media.key, season, episode, exclude)
        val cached = withContext(Dispatchers.IO) { diskCache?.read(key, System.currentTimeMillis()) }
        if (cached != null) return cached
        require(media.kind != "tv" || (season > 0 && episode > 0)) { "Choose a valid season and episode" }
        val path = if (media.kind == "tv") "stream/tv/${media.id}/$season/$episode" else "stream/movie/${media.id}"
        val response = resolverRequest("$baseUrl/$path", mapOf("all" to "1", "exclude" to exclude.sorted().joinToString(",")), onWake)
        val body = try { JSONObject(response) } catch (error: Exception) { throw IOException("Streaming service returned invalid JSON", error) }
        val parsed = parseStreams(body)
        lastWarnings = parsed.warnings
        val streams = parsed.streams.filterNot { it.source in exclude }
        if (streams.isNotEmpty()) {
            withContext(Dispatchers.IO) {
                // A full disk must not turn a valid provider response into a playback failure.
                runCatching { diskCache?.write(key, streams, System.currentTimeMillis()) }
            }
        }
        return streams
    }

    private suspend fun resolverRequest(url: String, params: Map<String, String>, onWake: (() -> Unit)?): String = coroutineScope {
        val wakeNotice = launch { delay(5_000); onWake?.invoke() }
        try {
            try {
                Http.request(url, params, requestClient = Http.resolverClient)
            } catch (error: IOException) {
                if (error is HttpStatusException && error.code != 408 && error.code != 429 && error.code < 500) throw error
                onWake?.invoke()
                delay(1_000)
                Http.request(url, params, requestClient = Http.resolverClient)
            }
        } finally {
            wakeNotice.cancel()
        }
    }
}
