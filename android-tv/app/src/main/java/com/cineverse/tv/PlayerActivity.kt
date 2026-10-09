package com.cineverse.tv

import android.app.AlertDialog
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.DefaultTimeBar
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONObject

@androidx.media3.common.util.UnstableApi
public class PlayerActivity : FragmentActivity() {
    private lateinit var media: Media
    private lateinit var option: StreamOption
    private lateinit var store: LocalStore
    private lateinit var playerView: PlayerView
    private lateinit var status: TextView
    private lateinit var actions: LinearLayout
    private var player: ExoPlayer? = null
    private var ticker: Job? = null
    private var watchedMs = 0L
    private var lastTick = 0L
    private var started = false
    private var season = 0
    private var episode = 0
    private var scraperBase = ""
    private var muted = false
    private val resumeKey: String get() = "${media.key}:$season:$episode"
    private val analyticsPath: String get() = "/${media.kind}/${media.id}"

    override fun onCreate(savedInstanceState: Bundle?): Unit {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        media = Media.from(JSONObject(intent.getStringExtra("media") ?: run { finish(); return }))
        option = StreamOption.from(JSONObject(intent.getStringExtra("stream") ?: run { finish(); return }))
        scraperBase = intent.getStringExtra("scraperBase").orEmpty()
        season = intent.getIntExtra("season", 0)
        episode = intent.getIntExtra("episode", 0)
        muted = intent.getBooleanExtra("muted", false)
        store = LocalStore(this)

        val root = FrameLayout(this).apply { setBackgroundColor(Palette.background) }
        playerView = PlayerView(this).apply {
            resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
            controllerShowTimeoutMs = 3000
            setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS)
            setShowSubtitleButton(true)
            contentDescription = "Video player for ${media.title}"
        }
        root.addView(playerView, FrameLayout.LayoutParams(-1, -1))
        status = label("Preparing ${option.quality} · ${option.source}", 16f, Palette.gold).apply {
            gravity = Gravity.CENTER
            setBackgroundColor(0xd909090b.toInt())
        }
        root.addView(status, FrameLayout.LayoutParams(-1, dp(54), Gravity.TOP))
        actions = row().apply {
            gravity = Gravity.CENTER
            setBackgroundColor(0xd909090b.toInt())
            addView(action("Audio & subtitles") { showTracks() })
            addView(action("Exit player") { confirmExit() })
        }
        root.addView(actions, FrameLayout.LayoutParams(-2, dp(64), Gravity.TOP or Gravity.RIGHT).apply {
            topMargin = dp(58); rightMargin = dp(20)
        })
        playerView.setControllerVisibilityListener(PlayerView.ControllerVisibilityListener { visibility ->
            if (!actions.hasFocus()) actions.visibility = visibility
        })
        playerView.findViewById<DefaultTimeBar>(androidx.media3.ui.R.id.exo_progress)?.apply {
            setPlayedColor(Palette.gold); setBufferedColor(0x4dffffff); setScrubberColor(Palette.gold)
        }
        setContentView(root)
    }

    override fun onStart(): Unit {
        super.onStart()
        if (player == null) lifecycleScope.launch { start(option, resume = true) }
    }

    private suspend fun start(stream: StreamOption, resume: Boolean): Unit {
        player?.takeIf { started }?.let { exo ->
            store.savePosition(resumeKey, if (exo.playbackState == Player.STATE_ENDED) 0 else exo.currentPosition)
        }
        release(save = false)
        option = stream
        status.setTextColor(Palette.gold)
        status.text = "Preparing ${stream.quality} · ${stream.source}"
        status.visibility = View.VISIBLE
        val subtitleHeaders = stream.subtitles.associate { it.url to it.headers }
        val playbackClient = Http.playbackClient.newBuilder().addInterceptor { chain ->
            val request = chain.request()
            val subtitle = subtitleHeaders[request.url.toString()]
            val builder = request.newBuilder()
            if (subtitle != null) {
                // A subtitle can live on another host and require its own credentials.
                stream.headers.keys.forEach { builder.removeHeader(it) }
                subtitle.forEach { (name, value) -> builder.header(name, value) }
            }
            chain.proceed(builder.build())
        }.build()
        val dataSource = OkHttpDataSource.Factory(playbackClient).setDefaultRequestProperties(stream.headers)
        val exo = ExoPlayer.Builder(this).setMediaSourceFactory(DefaultMediaSourceFactory(dataSource))
            .setSeekBackIncrementMs(10_000).setSeekForwardIncrementMs(10_000).build()
        player = exo
        exo.volume = if (muted) 0f else 1f
        playerView.player = exo
        val subtitleConfigurations = stream.subtitles.map { subtitle ->
            MediaItem.SubtitleConfiguration.Builder(Uri.parse(subtitle.url))
                .setLanguage(subtitle.language).setMimeType(subtitle.mimeType ?: if (Uri.parse(subtitle.url).path?.endsWith(".vtt", true) == true) MimeTypes.TEXT_VTT else MimeTypes.APPLICATION_SUBRIP)
                .setLabel(subtitle.label ?: subtitle.language).build()
        }
        val itemBuilder = MediaItem.Builder().setUri(stream.url).setMediaId(media.key)
            .setSubtitleConfigurations(subtitleConfigurations)
        stream.mimeType?.let { itemBuilder.setMimeType(it) }
        exo.setMediaItem(itemBuilder.build())
        exo.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean): Unit {
                if (isPlaying && !started) {
                    started = true
                    Telemetry.event("media_start", analyticsPath, position = exo.currentPosition)
                }
                if (isPlaying) status.visibility = View.GONE
            }
            override fun onPlaybackStateChanged(state: Int): Unit {
                if (state == Player.STATE_BUFFERING) {
                    status.visibility = View.VISIBLE
                    status.text = "Buffering ${exo.bufferedPercentage}% · ${stream.quality} · ${stream.source}"
                } else if (state == Player.STATE_READY && exo.isPlaying) status.visibility = View.GONE
                else if (state == Player.STATE_ENDED) store.persistPosition(resumeKey, 0)
            }
            override fun onPlayerError(error: PlaybackException): Unit {
                showPlaybackError("This source stopped (${error.errorCodeName}).")
            }
        })
        if (resume) exo.seekTo(store.position(resumeKey))
        exo.prepare()
        exo.playWhenReady = true
        lastTick = SystemClock.elapsedRealtime()
        ticker = lifecycleScope.launch {
            while (isActive) {
                delay(1000)
                val now = SystemClock.elapsedRealtime()
                if (exo.isPlaying) watchedMs += now - lastTick
                lastTick = now
                if (watchedMs >= 30_000) {
                    Telemetry.event("media_progress", analyticsPath, watchedMs, exo.currentPosition)
                    store.savePosition(resumeKey, exo.currentPosition)
                    watchedMs = 0
                }
            }
        }
        playerView.requestFocus()
    }

    private fun showPlaybackError(message: String): Unit {
        status.visibility = View.VISIBLE
        status.setTextColor(Palette.ruby)
        status.text = message
        val dialog = AlertDialog.Builder(this).setTitle("Playback interrupted").setMessage(message)
            .setPositiveButton("Retry") { _, _ -> lifecycleScope.launch { start(option, resume = true) } }
        dialog.setNegativeButton("Try another source") { _, _ -> tryAnotherSource() }
        dialog.setNeutralButton("Back") { _, _ -> finish() }.show()
    }

    private fun tryAnotherSource(): Unit {
        lifecycleScope.launch {
            try {
                status.setTextColor(Palette.gold)
                status.text = "Finding another source…"
                status.visibility = View.VISIBLE
                val next = StreamApi(scraperBase, this@PlayerActivity).streams(media, season, episode, setOf(option.source) + CoreConfig.settings(this@PlayerActivity).brokenSources, onWake = {
                    status.text = "Waking server… (free host sleeps)"
                }).firstOrNull()
                    ?: error("No other source is available")
                start(next, resume = true)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                showPlaybackError(e.message ?: "No other source is available")
            }
        }
    }

    private fun showTracks(): Unit {
        val exo = player ?: return
        val groups = exo.currentTracks.groups.filter { it.type == C.TRACK_TYPE_AUDIO || it.type == C.TRACK_TYPE_TEXT }
        val options = groups.flatMap { group -> (0 until group.length).filter { group.isTrackSupported(it) }.map { group to it } }
        val names = listOf("Subtitles off") + options.map { (group, index) ->
            val format = group.getTrackFormat(index)
            "${if (group.type == C.TRACK_TYPE_AUDIO) "Audio" else "Subtitle"}: ${format.label ?: format.language ?: "Track ${index + 1}"}"
        }
        AlertDialog.Builder(this).setTitle("Audio & subtitles").setItems(names.toTypedArray()) { _, index ->
            val parameters = exo.trackSelectionParameters.buildUpon()
            if (index == 0) parameters.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
            else {
                val (group, track) = options[index - 1]
                parameters.setTrackTypeDisabled(group.type, false)
                    .setOverrideForType(TrackSelectionOverride(group.mediaTrackGroup, track))
            }
            exo.trackSelectionParameters = parameters.build()
        }.show()
    }

    @android.annotation.SuppressLint("RestrictedApi")
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN) {
            val exo = player
            playerView.showController()
            when (event.keyCode) {
                KeyEvent.KEYCODE_BACK -> { confirmExit(); return true }
                KeyEvent.KEYCODE_DPAD_LEFT -> if (!actions.hasFocus()) { exo?.seekBack(); return true }
                KeyEvent.KEYCODE_DPAD_RIGHT -> if (!actions.hasFocus()) { exo?.seekForward(); return true }
                KeyEvent.KEYCODE_DPAD_UP -> { actions.visibility = View.VISIBLE; actions.getChildAt(0).requestFocus(); return true }
                KeyEvent.KEYCODE_DPAD_DOWN -> { actions.visibility = View.GONE; playerView.requestFocus(); return true }
                KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> if (!actions.hasFocus()) {
                    if (exo?.isPlaying == true) exo.pause() else exo?.play(); return true
                }
            }
        }
        return super.dispatchKeyEvent(event)
    }

    private fun confirmExit(): Unit {
        val wasPlaying = player?.isPlaying == true
        player?.pause()
        AlertDialog.Builder(this).setTitle("Return to details?").setMessage("Your position will be saved.")
            .setNegativeButton("Keep watching") { _, _ -> if (wasPlaying) player?.play() }
            .setPositiveButton("Save & exit") { _, _ -> lifecycleScope.launch {
                player?.let { store.savePosition(resumeKey, if (it.playbackState == Player.STATE_ENDED) 0 else it.currentPosition) }
                finish()
            } }
            .setOnCancelListener { if (wasPlaying) player?.play() }.show()
    }

    private fun release(save: Boolean): Unit {
        ticker?.cancel()
        ticker = null
        player?.let { exo ->
            if (started) {
                val position = if (exo.playbackState == Player.STATE_ENDED) 0 else exo.currentPosition
                Telemetry.event("media_end", analyticsPath, watchedMs.coerceAtMost(30_000), position)
                if (save) store.persistPosition(resumeKey, position)
            }
            exo.release()
        }
        player = null
        playerView.player = null
        started = false
        watchedMs = 0
    }

    override fun onStop(): Unit {
        release(save = true)
        super.onStop()
    }
}
