package com.cineverse.tv

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.FileProvider
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

public class UpdateActivity : FragmentActivity() {
    private lateinit var status: TextView
    private lateinit var actions: LinearLayout
    private var busy = false
    private var permissionLaunchInProgress = false
    private val prefs by lazy { getSharedPreferences("tv-update", MODE_PRIVATE) }
    private val candidate: File get() = File(filesDir, "updates/${prefs.getString("candidate", "candidate.apk")}")
    override fun onCreate(savedInstanceState: Bundle?): Unit {
        super.onCreate(savedInstanceState)
        val body = column().apply { setPadding(dp(50), dp(36), dp(50), dp(30)); setBackgroundColor(Palette.background) }
        body.addView(label("Keep your cinema up to date", 30f, Palette.gold))
        status = label("Checking TV releases…", 18f); body.addView(status)
        actions = column(); body.addView(actions); setContentView(body)
        if (prefs.getLong("versionCode", 0) <= BuildConfig.VERSION_CODE) {
            candidate.delete(); prefs.edit().clear().apply()
        }
        if (candidate.exists()) ready() else check()
    }
    override fun onResume(): Unit {
        super.onResume()
        if (!permissionLaunchInProgress && prefs.getBoolean("permissionPending", false)) {
            prefs.edit().putBoolean("permissionPending", false).apply()
            if (packageManager.canRequestPackageInstalls() && candidate.exists()) install()
            else { status.text = "Install permission was not enabled. Your download is saved; retry when ready."; ready() }
        }
    }
    override fun onPause(): Unit { permissionLaunchInProgress = false; super.onPause() }
    private fun check(): Unit {
        actions.removeAllViews(); busy = true
        lifecycleScope.launch {
            try {
                val update = TvUpdater.check()
                if (update == null) { status.text = "You’re up to date · TV ${BuildConfig.VERSION_NAME}"; back() }
                else if (!TvUpdater.eligible(this@UpdateActivity, update)) {
                    status.text = "TV ${update.version} is being released gradually. Your TV will be notified when it is available."
                    back()
                } else {
                    status.text = "TV ${update.version} is available\n${update.notes.take(900)}"
                    actions.addView(action("Download update", true) {
                        if (!busy) { busy = true; actions.removeAllViews(); lifecycleScope.launch {
                            try { TvUpdater.download(this@UpdateActivity, update) { percent -> runOnUiThread { status.text = "Downloading TV update · $percent%" } }; Telemetry.event("cta_click", "/settings", label = "tv-update-downloaded"); status.text = "Download verified. Ready to install."; ready() }
                            catch (e: CancellationException) { throw e } catch (e: Exception) { failure(e.message ?: "Download failed") }
                            finally { busy = false }
                        } }
                    }.apply { requestFocus() }); back()
                }
            } catch (e: CancellationException) { throw e } catch (e: Exception) { failure(e.message ?: "Could not check for updates") }
            finally { busy = false }
        }
    }
    private fun ready(): Unit {
        actions.removeAllViews(); status.text = "Downloaded TV ${prefs.getString("version", "update")} is ready. If installation was cancelled, retry here without downloading again."
        actions.addView(action("Install update", true) { install() }.apply { requestFocus() })
        actions.addView(action("Discard download and check again") { candidate.delete(); prefs.edit().clear().apply(); check() }); back()
    }
    private fun install(): Unit {
        if (busy) return; busy = true
        lifecycleScope.launch {
            try {
                withContext(Dispatchers.IO) { TvUpdater.verify(this@UpdateActivity, candidate, prefs.getString("sha256", "").orEmpty()) }
                if (!packageManager.canRequestPackageInstalls()) {
                    prefs.edit().putBoolean("permissionPending", true).apply()
                    status.text = "Allow Cine-verse TV to install updates, then press Back. Installation will continue automatically."
                    try { permissionLaunchInProgress = true; startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName"))) }
                    catch (_: android.content.ActivityNotFoundException) { prefs.edit().putBoolean("permissionPending", false).apply(); failure("On this TV, enable Install unknown apps for Cine-verse TV in system security settings, then retry.") }
                } else {
                    val uri = FileProvider.getUriForFile(this@UpdateActivity, "$packageName.updates", candidate)
                    prefs.edit().putString("pendingVersion", prefs.getString("version", "")).apply()
                    Telemetry.event("cta_click", "/settings", label = "tv-update-installer-opened")
                    @Suppress("DEPRECATION")
                    startActivityForResult(Intent(Intent.ACTION_INSTALL_PACKAGE).setData(uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION).putExtra(Intent.EXTRA_RETURN_RESULT, true), 41)
                }
            } catch (e: CancellationException) { throw e } catch (e: Exception) { failure(e.message ?: "Could not open installer") }
            finally { busy = false }
        }
    }
    @Deprecated("System installer result API")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?): Unit {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 41) ready()
    }
    private fun failure(message: String): Unit {
        Telemetry.event("cta_click", "/settings", label = "tv-update-failed")
        status.text = message; actions.removeAllViews()
        actions.addView(action(if (candidate.exists()) "Retry installation" else "Retry", true) { if (candidate.exists()) install() else check() }); back()
    }
    private fun back(): Unit { actions.addView(action("Keep browsing") { finish() }) }
}
