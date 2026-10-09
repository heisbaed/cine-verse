package com.cineverse.tv

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.io.IOException

public class StreamRecoveryTest {
    @get:Rule public val temporaryFolder: TemporaryFolder = TemporaryFolder()
    private val now = 1_700_000_000_000L

    private fun record(url: String = "https://media.example/video.mp4", expiresAt: Long = 0L): JSONObject =
        JSONObject().put("url", url).put("source", "A").put("expiresAt", expiresAt)

    private fun cacheKey(backend: String = "https://core.example", episode: Int = 1, excluded: Set<String> = emptySet()): StreamCacheKey =
        StreamCacheKey(backend, "tv:100", 1, episode, excluded)

    @Test public fun preservesCaseInsensitivePlaybackHeadersAndFullCookie(): Unit {
        val cookie = "session=" + "a".repeat(800)
        val parsed = StreamOption.from(record().put("headers", JSONObject()
            .put("referer", "https://provider.example/").put("ORIGIN", "https://provider.example")
            .put("user-agent", "PlayerAgent").put("cookie", cookie).put("authorization", "Bearer signed-token")
            .put("accept", "*/*").put("accept-language", "en").put("X-Secret", "discard")), now)
        assertEquals("https://provider.example/", parsed.headers["Referer"])
        assertEquals("https://provider.example", parsed.headers["Origin"])
        assertEquals("PlayerAgent", parsed.headers["User-Agent"])
        assertEquals(cookie, parsed.headers["Cookie"])
        assertEquals("Bearer signed-token", parsed.headers["Authorization"])
        assertEquals("*/*", parsed.headers["Accept"])
        assertEquals("en", parsed.headers["Accept-Language"])
        assertFalse(parsed.headers.containsKey("X-Secret"))
    }

    @Test public fun keepsOpaqueHlsMimeAndSignedSubtitleFormatAcrossSerialization(): Unit {
        val response = record("https://media.example/play?token=secret").put("type", "hls")
            .put("subtitles", JSONArray().put(JSONObject().put("url", "https://media.example/subtitle?token=secret")
                .put("language", "en").put("format", "vtt").put("label", "English")
                .put("headers", JSONObject().put("authorization", "Bearer subtitle-token").put("X-Secret", "discard"))))
        val parsed = StreamOption.from(response, now)
        assertEquals("application/x-mpegURL", parsed.mimeType)
        assertEquals("text/vtt", parsed.subtitles.single().mimeType)
        assertEquals("en", parsed.subtitles.single().language)
        assertEquals("English", parsed.subtitles.single().label)
        assertEquals(mapOf("Authorization" to "Bearer subtitle-token"), parsed.subtitles.single().headers)
        assertEquals(parsed, StreamOption.from(JSONObject(parsed.json()), now))
    }

    @Test public fun acceptsMp4MimeTypeWithoutFileExtension(): Unit {
        val parsed = StreamOption.from(record("https://media.example/play?id=100").put("mimeType", "video/mp4"), now)
        assertEquals("video/mp4", parsed.mimeType)
    }

    @Test public fun rejectsHeaderInjectionInsteadOfForwardingIt(): Unit {
        assertThrows(IllegalStateException::class.java) {
            StreamOption.from(record().put("headers", JSONObject().put("referer", "https://provider.example/\r\nX-Injected: value")), now)
        }
    }

    @Test public fun parsesSingleAndArrayResponsesWithoutHidingRejectedProviders(): Unit {
        assertEquals(1, parseStreams(record(), now).streams.size)
        val response = JSONObject().put("streams", JSONArray().put(record())
            .put(record("http://media.example/insecure.mp4")).put(record(expiresAt = now - 1)))
        val parsed = parseStreams(response, now)
        assertEquals(1, parsed.streams.size)
        assertEquals(2, parsed.warnings.size)
        assertTrue(parsed.warnings.any { "expired" in it })
        assertTrue(parsed.warnings.any { "HTTPS" in it })
    }

    @Test public fun failsObservablyWhenEveryReturnedRecordIsInvalid(): Unit {
        val error = assertThrows(IOException::class.java) {
            parseStreams(JSONObject().put("streams", JSONArray().put(record(expiresAt = now))), now)
        }
        assertTrue(error.message.orEmpty().contains("expired"))
        assertTrue(parseStreams(JSONObject().put("streams", JSONArray()), now).streams.isEmpty())
    }

    @Test public fun recognizesOkProviderStatus(): Unit {
        val status = parseServiceStatus(JSONObject().put("version", "1.2.3")
            .put("adapters", JSONObject().put("A", "ok").put("B", "broken")))
        assertEquals("1.2.3", status.serviceVersion)
        assertEquals("configured", status.adapters["A"])
        assertEquals(setOf("B"), status.brokenSources)
    }

    @Test public fun cachedStreamsSurviveRepositoryRecreation(): Unit {
        val directory = temporaryFolder.newFolder("streams")
        val stream = StreamOption.from(record().put("type", "mp4"), now)
        StreamDiskCache(directory).write(cacheKey(), listOf(stream), now)
        assertEquals(listOf(stream), StreamDiskCache(directory).read(cacheKey(), now + 1_000))
    }

    @Test public fun cacheDoesNotCrossBackendEpisodeOrExcludedSource(): Unit {
        val cache = StreamDiskCache(temporaryFolder.newFolder("streams"))
        cache.write(cacheKey(), listOf(StreamOption.from(record(), now)), now)
        assertNotNull(cache.read(cacheKey(), now))
        assertNull(cache.read(cacheKey(backend = "https://other-core.example"), now))
        assertNull(cache.read(cacheKey(episode = 2), now))
        assertNull(cache.read(cacheKey(excluded = setOf("A")), now))
        assertNull(cache.read(cacheKey().copy(season = 2), now))
        assertNull(cache.read(cacheKey().copy(mediaKey = "tv:200"), now))
    }

    @Test public fun expiresCacheAfterThirtyMinutesAndSignedUrlsEarlier(): Unit {
        val cache = StreamDiskCache(temporaryFolder.newFolder("streams"))
        cache.write(cacheKey(), listOf(StreamOption.from(record(), now)), now)
        assertNull(cache.read(cacheKey(), now + StreamDiskCache.TTL_MS))
        cache.write(cacheKey(), listOf(StreamOption.from(record(expiresAt = now + 5_000), now)), now)
        assertNotNull(cache.read(cacheKey(), now + 4_999))
        assertNull(cache.read(cacheKey(), now + 5_000))
    }

    @Test public fun neverCachesEmptyExpiredOrExcludedResults(): Unit {
        val directory = temporaryFolder.newFolder("streams")
        val cache = StreamDiskCache(directory)
        cache.write(cacheKey(), emptyList(), now)
        cache.write(cacheKey(), listOf(StreamOption("https://media.example/a.mp4", emptyMap(), "Auto", emptyList(), "A", now - 1)), now)
        cache.write(cacheKey(excluded = setOf("A")), listOf(StreamOption.from(record(), now)), now)
        assertTrue(directory.listFiles().orEmpty().isEmpty())
        assertNull(cache.read(cacheKey(), now))
    }

    @Test public fun corruptCacheBecomesAMissInsteadOfBlockingPlayback(): Unit {
        val directory = temporaryFolder.newFolder("streams")
        val cacheFile = File(directory, cacheKey().filename()).apply { writeText("invalid json") }
        assertNull(StreamDiskCache(directory).read(cacheKey(), now))
        assertFalse(cacheFile.exists())
    }
}
