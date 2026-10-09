package com.cineverse.tv

import android.content.Context
import com.google.android.gms.tasks.Task
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.remoteconfig.FirebaseRemoteConfig
import com.google.firebase.remoteconfig.FirebaseRemoteConfigSettings
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import org.json.JSONArray
import org.json.JSONObject

public data class CoreSettings(public val baseUrl: String, public val minimumVersion: String,
    public val brokenSources: Set<String>, public val rolloutPercent: Int)

/** Remote switches use the existing project; no Cine-verse login is needed. */
public object CoreConfig {
    private var remote: FirebaseRemoteConfig? = null
    public var lastStatus: String = "Remote settings not checked"
        private set

    public fun initialize(context: Context): Unit {
        if (remote != null) return
        if (BuildConfig.FIREBASE_APP_ID.isBlank() || BuildConfig.FIREBASE_API_KEY.isBlank()) {
            lastStatus = "Remote settings are not configured for this build"
            return
        }
        val app = FirebaseApp.getApps(context).firstOrNull { it.name == "cineverse-tv" }
            ?: FirebaseApp.initializeApp(context.applicationContext, FirebaseOptions.Builder()
                .setApplicationId(BuildConfig.FIREBASE_APP_ID).setApiKey(BuildConfig.FIREBASE_API_KEY)
                .setProjectId(BuildConfig.FIREBASE_PROJECT_ID).build(), "cineverse-tv")
        remote = FirebaseRemoteConfig.getInstance(app).apply {
            setConfigSettingsAsync(FirebaseRemoteConfigSettings.Builder()
                .setMinimumFetchIntervalInSeconds(300).setFetchTimeoutInSeconds(15).build())
            setDefaultsAsync(mapOf("core_base" to BuildConfig.SCRAPER_BASE, "min_core_version" to "",
                "broken_sources" to "[]", "tv_rollout_pct" to 100))
        }
    }

    public fun settings(context: Context): CoreSettings {
        val saved = context.getSharedPreferences("tv-core-config", Context.MODE_PRIVATE).getString("lastGood", null)
        return saved?.let { runCatching { decode(JSONObject(it)) }.getOrNull() }
            ?: CoreSettings(BuildConfig.SCRAPER_BASE, "", emptySet(), 100)
    }

    public suspend fun refresh(context: Context, force: Boolean = false): CoreSettings {
        initialize(context)
        val config = remote ?: return settings(context)
        try {
            if (force) { config.fetch(0).awaitResult(); config.activate().awaitResult() }
            else config.fetchAndActivate().awaitResult()
            val values = JSONObject().put("core_base", config.getString("core_base"))
                .put("min_core_version", config.getString("min_core_version"))
                .put("broken_sources", config.getString("broken_sources"))
                .put("tv_rollout_pct", config.getLong("tv_rollout_pct"))
            val result = decode(values)
            context.getSharedPreferences("tv-core-config", Context.MODE_PRIVATE).edit()
                .putString("lastGood", values.toString()).apply()
            lastStatus = "Remote settings refreshed"
            return result
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            lastStatus = "Remote refresh failed; saved settings retained"
            return settings(context)
        }
    }

    private fun decode(json: JSONObject): CoreSettings {
        val base = json.getString("core_base").trim().trimEnd('/')
        val url = base.toHttpUrlOrNull()
        require(url?.isHttps == true && url.username.isEmpty() && url.password.isEmpty()) { "Invalid Core URL" }
        val minimum = json.optString("min_core_version").trim()
        require(minimum.isEmpty() || minimum.matches(Regex("\\d+\\.\\d+\\.\\d+"))) { "Invalid Core version" }
        val sources = JSONArray(json.optString("broken_sources", "[]"))
        require(sources.length() <= 100) { "Invalid source settings" }
        val broken = (0 until sources.length()).map { sources.getString(it) }.toSet()
        require(broken.all { it.matches(Regex("[a-zA-Z0-9_-]{1,80}")) }) { "Invalid source identifier" }
        val rollout = json.optInt("tv_rollout_pct", 100)
        require(rollout in 0..100) { "Invalid rollout value" }
        return CoreSettings(base, minimum, broken, rollout)
    }

    private suspend fun <T> Task<T>.awaitResult(): T = suspendCancellableCoroutine { continuation ->
        addOnCompleteListener { task ->
            if (continuation.isActive) continuation.resumeWith(if (task.isSuccessful) Result.success(task.result)
                else Result.failure(task.exception ?: IllegalStateException("Remote settings request failed")))
        }
    }
}
