package com.cineverse.tv

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.UUID

public object Telemetry {
    private val session = UUID.randomUUID().toString()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    public var lastError: String? = null
        private set
    public fun event(name: String, path: String, duration: Long = 0, position: Long = 0, label: String = "native"): Unit {
        val id = UUID.randomUUID().toString()
        val payload = JSONObject().put("id", id).put("name", name).put("site", "main").put("path", path.take(240))
            .put("timestamp", JSONObject().put(".sv", "timestamp")).put("sessionId", session)
            .put("device", "desktop").put("platform", "android-tv").put("schemaVersion", 2)
            .put("label", label.take(80)).put("durationMs", duration.coerceIn(0, 30000)).put("mediaPositionMs", position.coerceAtLeast(0))
        scope.launch {
            try {
                val request = Request.Builder().url("https://cine-verse-231ad-default-rtdb.firebaseio.com/analytics/main/events/$id.json")
                    .put(payload.toString().toRequestBody("application/json".toMediaType())).build()
                Http.client.newCall(request).execute().use { if (!it.isSuccessful) error("Telemetry HTTP ${it.code}") }
                lastError = null
            } catch (_: Exception) { lastError = "Telemetry could not be sent" }
        }
    }
}
