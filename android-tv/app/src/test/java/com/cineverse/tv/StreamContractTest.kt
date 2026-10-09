package com.cineverse.tv

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

public class StreamContractTest {
    @Test public fun parsesHttpsStreamAndAllowlistedHeaders(): Unit {
        val json = JSONObject()
            .put("url", "https://media.example/video.m3u8")
            .put("quality", "1080p")
            .put("source", "A")
            .put("headers", JSONObject().put("Referer", "https://source.example/").put("X-Secret", "drop-me"))
            .put("subtitles", JSONArray().put(JSONObject().put("lang", "en").put("url", "https://media.example/en.vtt")))
        val stream = StreamOption.from(json)
        assertEquals("1080p", stream.quality)
        assertEquals("https://source.example/", stream.headers["Referer"])
        assertFalse(stream.headers.containsKey("X-Secret"))
        assertEquals(1, stream.subtitles.size)
    }

    @Test public fun rejectsNonHttpsPlayback(): Unit {
        val json = JSONObject().put("url", "http://media.example/video.mp4")
        assertThrows(IllegalStateException::class.java) { StreamOption.from(json) }
    }

    @Test public fun updaterUsesNumericVersions(): Unit {
        assertTrue(TvUpdater.newer("1.10.0", "1.9.9"))
        assertFalse(TvUpdater.newer("1.0.0", "1.0.0"))
        assertFalse(TvUpdater.newer("0.9.9", "1.0.0"))
        assertFalse(TvUpdater.newer("1.1.0-beta", "1.0.0"))
    }

}
