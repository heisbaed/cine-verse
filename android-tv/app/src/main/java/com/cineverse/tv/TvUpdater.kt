package com.cineverse.tv

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import okhttp3.Request
import org.json.JSONArray
import java.io.File
import java.security.MessageDigest

public data class TvUpdate(public val version: String, public val versionCode: Long, public val url: String,
    public val sha256: String, public val size: Long, public val notes: String, public val rolloutPercent: Int)

public object TvUpdater {
    private const val LATEST = "https://api.github.com/repos/heisbaed/cine-verse/releases/tags/tv-latest"
    private const val MANIFEST_NAME = "cine-verse-tv-release.json"
    private var cached: Pair<Long, TvUpdate?>? = null
    public fun newer(candidate: String, installed: String): Boolean {
        val regex = Regex("\\d+\\.\\d+\\.\\d+")
        if (!regex.matches(candidate) || !regex.matches(installed)) return false
        val a = candidate.split('.').map { it.toLongOrNull() ?: return false }
        val b = installed.split('.').map { it.toLongOrNull() ?: return false }
        return a.zip(b).firstOrNull { it.first != it.second }?.let { it.first > it.second } ?: false
    }
    public suspend fun check(): TvUpdate? {
        synchronized(this) { cached?.takeIf { it.first > System.currentTimeMillis() }?.let { return it.second } }
        val release = org.json.JSONObject(Http.request(LATEST))
        val manifestAsset = release.items("assets").firstOrNull { it.optString("name") == MANIFEST_NAME }
            ?: error("TV update manifest is missing")
        val manifestUrl = manifestAsset.getString("browser_download_url")
        check(manifestUrl == "https://github.com/heisbaed/cine-verse/releases/download/tv-latest/$MANIFEST_NAME") { "Unexpected update manifest location" }
        val manifest = org.json.JSONObject(Http.request(manifestUrl))
        val version = manifest.getString("version")
        val versionCode = manifest.getLong("versionCode")
        val filename = "cine-verse-tv-v$version.apk"
        val apk = release.items("assets").firstOrNull { it.optString("name") == filename }
            ?: error("TV release APK is missing")
        val url = apk.getString("browser_download_url")
        check(url == "https://github.com/heisbaed/cine-verse/releases/download/tv-latest/$filename") { "Unexpected update location" }
        val digest = manifest.getString("sha256")
        check(digest.matches(Regex("[a-fA-F0-9]{64}"))) { "Release checksum is invalid" }
        check(manifest.optLong("size", apk.getLong("size")) == apk.getLong("size")) { "Release size does not match its manifest" }
        val update = if (versionCode > BuildConfig.VERSION_CODE) TvUpdate(version, versionCode, url, digest.lowercase(),
            apk.getLong("size"), manifest.optString("notes", release.optString("body")), manifest.optInt("rolloutPercent", 100).coerceIn(0, 100)) else null
        synchronized(this) { cached = System.currentTimeMillis() + 5 * 60_000 to update }
        return update
    }

    public fun eligible(context: Context, update: TvUpdate): Boolean {
        val rollout = minOf(update.rolloutPercent, CoreConfig.settings(context).rolloutPercent)
        if (rollout >= 100) return true
        if (rollout <= 0) return false
        val id = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID).orEmpty()
        return Math.floorMod(id.hashCode(), 100) < rollout
    }
    public suspend fun download(context: Context, update: TvUpdate, progress: (Int) -> Unit): File = withContext(Dispatchers.IO) {
        val dir = File(context.filesDir, "updates").apply { mkdirs() }
        check(update.size in 1..500_000_000L && dir.usableSpace > update.size * 2) { "Not enough storage for this update" }
        val partial = File(dir, "candidate.part"); val target = File(dir, "cine-verse-tv-v${update.version}.apk")
        try {
            Http.client.newBuilder().callTimeout(0, java.util.concurrent.TimeUnit.SECONDS).build()
                .newCall(Request.Builder().url(update.url).build()).execute().use { response ->
                    check(response.isSuccessful) { "Download failed: HTTP ${response.code}" }
                    response.body!!.byteStream().use { input -> partial.outputStream().use { output ->
                        val bytes = ByteArray(65536); var total = 0L; var previous = -1
                        while (true) {
                            ensureActive(); val count = input.read(bytes); if (count < 0) break
                            total += count; check(total <= update.size) { "Unexpected download size" }; output.write(bytes, 0, count)
                            val percent = (100 * total / update.size).toInt(); if (percent != previous) { previous = percent; progress(percent) }
                        }; check(total == update.size) { "Download interrupted. Please retry." }
                    } }
                }
            verify(context, partial, update.sha256)
            check(partial.renameTo(target)) { "Could not save verified update" }
            dir.listFiles { file -> file.extension == "apk" && file != target }?.sortedByDescending { it.lastModified() }?.drop(1)?.forEach { it.delete() }
            context.getSharedPreferences("tv-update", Context.MODE_PRIVATE).edit().putString("sha256", update.sha256)
                .putString("version", update.version).putLong("versionCode", update.versionCode).putString("candidate", target.name).apply()
            target
        } finally { partial.delete() }
    }
    @Suppress("DEPRECATION")
    public fun verify(context: Context, file: File, expected: String): Unit {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input -> val buffer = ByteArray(65536); while (true) { val count = input.read(buffer); if (count < 0) break; digest.update(buffer, 0, count) } }
        check(digest.digest().joinToString("") { "%02x".format(it) }.equals(expected, true)) { "Checksum failed. Download the update again." }
        val flags = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
        val archive = context.packageManager.getPackageArchiveInfo(file.path, flags) ?: error("Invalid APK")
        val installed = context.packageManager.getPackageInfo(context.packageName, flags)
        check(archive.packageName == context.packageName) { "This update is for another app" }
        val candidateCode = if (Build.VERSION.SDK_INT >= 28) archive.longVersionCode else archive.versionCode.toLong()
        val currentCode = if (Build.VERSION.SDK_INT >= 28) installed.longVersionCode else installed.versionCode.toLong()
        check(candidateCode > currentCode) { "This version is already installed" }
        val oldSignatures = if (Build.VERSION.SDK_INT >= 28) installed.signingInfo?.apkContentsSigners else installed.signatures
        val newSignatures = if (Build.VERSION.SDK_INT >= 28) archive.signingInfo?.apkContentsSigners else archive.signatures
        check(!oldSignatures.isNullOrEmpty() && oldSignatures.toSet() == newSignatures?.toSet()) { "Update signing certificate does not match this installation" }
        check((archive.applicationInfo?.minSdkVersion ?: 26) <= Build.VERSION.SDK_INT) { "This update requires a newer Android version" }
    }
}
