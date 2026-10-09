package com.cineverse.tv

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.app.AlertDialog
import android.app.Dialog
import android.content.Intent
import android.graphics.Color
import android.graphics.Bitmap
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.Editable
import android.text.TextUtils
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.Window
import android.view.ViewGroup
import android.view.animation.DecelerateInterpolator
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import android.text.TextWatcher
import org.json.JSONObject
import androidx.fragment.app.FragmentActivity
import androidx.leanback.widget.VerticalGridView
import androidx.lifecycle.lifecycleScope
import coil.load
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.time.Year
import java.util.Locale

public class MainActivity : FragmentActivity() {
    private val tmdb = TmdbApi()
    private lateinit var store: LocalStore
    private lateinit var pairing: TvPairing
    private var accountSyncJob: Job? = null
    private lateinit var rootFrame: FrameLayout
    private lateinit var host: FrameLayout
    private lateinit var body: LinearLayout
    private var contentJob: Job? = null
    private var heroJobHandle: Job? = null
    private var page = "Home"
    private var detailMedia: Media? = null
    private var season = 1
    private var episode = 1
    private var searchTerm = ""
    private var searchKind = "movie"
    private var searchQuery = ""
    private var searchGenre = ""
    private var searchYear = ""
    private var userInteracted = false
    private val heroMuted = false
    private val episodeSelections = mutableMapOf<String, Pair<Int, Int>>()
    private val rowPositions = mutableMapOf<String, Int>()
    private var homeTab = "ALL SHOWS"
    private var genreFilter = ""
    private var detailResumeView: TextView? = null
    private var headerNavLinks: LinearLayout? = null
    private var profileButton: Button? = null
    private var streamDialog: Dialog? = null
    private var streamPulse: ValueAnimator? = null

    private data class HeroTitle(val media: Media, val meta: HeroMeta)
    private var heroItems: List<HeroTitle> = emptyList()
    private var heroIndex = 0
    private val navLinks = mutableMapOf<String, View>()

    private lateinit var backdropImage: ImageView
    private lateinit var heroContent: LinearLayout
    private var heroFrame: View? = null
    private lateinit var heroRatingBadge: TextView
    private lateinit var heroSteps: LinearLayout
    private val heroAnimViews = mutableListOf<View>()

    override fun onCreate(savedInstanceState: Bundle?): Unit {
        super.onCreate(savedInstanceState)
        store = LocalStore(this)
        pairing = TvPairing(this)
        CoreConfig.initialize(this)
        lifecycleScope.launch { CoreConfig.refresh(this@MainActivity) }
        rootFrame = FrameLayout(this).apply { setBackgroundColor(Palette.background) }
        
        // Initialize headerNavLinks before buildHeader()
        headerNavLinks = row().apply {
            setBackgroundColor(Color.argb(51, 0, 0, 0))
            minimumHeight = dp(60)
        }
        
        buildHeader()
        host = FrameLayout(this)
        rootFrame.addView(host, FrameLayout.LayoutParams(-1, -1).apply { topMargin = dp(60) })
        setContentView(rootFrame)
        navigate("Home")
        checkForUpdate()
        val install = getSharedPreferences("install", MODE_PRIVATE)
        if (install.getString("version", "") != BuildConfig.VERSION_NAME) {
            Telemetry.event("app_install", "/")
            install.edit().putString("version", BuildConfig.VERSION_NAME).apply()
        }
        val updatePrefs = getSharedPreferences("tv-update", MODE_PRIVATE)
        if (updatePrefs.getString("pendingVersion", "") == BuildConfig.VERSION_NAME) {
            Telemetry.event("cta_click", "/", label = "tv-update-success")
            updatePrefs.edit().remove("pendingVersion").apply()
        }
    }

    private fun buildHeader(): Unit {
        headerNavLinks!!.apply {
            setBackgroundColor(Color.argb(51, 0, 0, 0))
            minimumHeight = dp(60)
            val logo = label("CINE·VERSE", 19f, Palette.gold).apply {
                setTypeface(null, Typeface.BOLD); letterSpacing = -0.015f
                setPadding(dp(16), dp(10), dp(14), dp(10))
                isFocusable = true; isFocusableInTouchMode = true
                setOnFocusChangeListener { _, f -> alpha = if (f) 1f else 0.9f }
                setOnClickListener { navigate("Home") }
            }
            val links = row().apply { gravity = Gravity.CENTER_VERTICAL }
            listOf("Home", "Movies", "TV Shows", "Upcoming", "Watchlist", "Settings").forEach { target ->
                links.addView(navLink(target, page == target) { navigate(target) }.also { navLinks[target] = it })
            }
            addView(logo)
            addView(links, LinearLayout.LayoutParams(0, -1, 1f))
            val right = row().apply { gravity = Gravity.CENTER_VERTICAL }
            val search = searchField("Search titles…").apply {
                setOnEditorActionListener { view, _, _ ->
                    if (view != null && view.text.toString().isNotBlank()) {
                        searchTerm = view.text.toString()
                        navigate("Explore")
                    }
                    true
                }
            }
            right.addView(search, LinearLayout.LayoutParams(dp(145), dp(48)))
            val profile = Button(this@MainActivity).apply {
                text = if (pairing.currentAccount() == null) "Guest" else "Account"; textSize = 14f; isAllCaps = false
                setTextColor(Color.WHITE); setPadding(dp(14), dp(10), dp(14), dp(10))
                background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(Color.rgb(26, 115, 232)) }
                setGravity(Gravity.CENTER); isFocusable = true; isFocusableInTouchMode = true
                setOnFocusChangeListener { v, f ->
                    v.background = GradientDrawable().apply {
                        shape = GradientDrawable.OVAL
                        setColor(if (f) Color.rgb(60, 145, 255) else Color.rgb(26, 115, 232))
                    }
                    v.scaleX = if (f) 1.04f else 1f; v.scaleY = v.scaleX
                }
                layoutParams = LinearLayout.LayoutParams(dp(60), dp(48)).apply { setMargins(dp(8), 0, dp(8), 0) }
                contentDescription = "Account settings"; setOnClickListener { navigate("Settings") }
            }
            profileButton = profile
            right.addView(profile)
            addView(right, LinearLayout.LayoutParams(-2, -1))
        }
        rootFrame.addView(headerNavLinks!!, FrameLayout.LayoutParams(-1, dp(60)).apply { gravity = Gravity.TOP })
    }

    private fun refreshNav(): Unit {
        for ((target, child) in navLinks) {
            if (child is LinearLayout && child.childCount >= 2) {
                val labelView = child.getChildAt(0) as? TextView
                val active = page == target
                child.isSelected = active
                labelView?.setTextColor(if (active) Palette.gold else Color.argb(188, 248, 244, 234))
                labelView?.setTypeface(null, if (active) Typeface.BOLD else Typeface.NORMAL)
                child.getChildAt(1).setBackgroundColor(if (active) Palette.gold else Color.TRANSPARENT)
                child.alpha = if (active || child.hasFocus()) 1f else 0.88f
            }
        }
    }

    override fun onResume(): Unit {
        super.onResume()
        syncAccountWatchlist()
        refreshResume()
        if (page == "Home" && detailMedia == null && heroFrame?.parent == body) startAutoRotate()
    }

    override fun onStop(): Unit {
        cancelAutoRotate()
        streamDialog?.dismiss()
        super.onStop()
    }

    private fun refreshResume(): Unit {
        val media = detailMedia ?: return
        val view = detailResumeView ?: return
        val key = "${media.key}:$season:$episode"
        lifecycleScope.launch {
            val position = store.position(key)
            if (detailMedia?.key == media.key && detailResumeView === view && key == "${media.key}:$season:$episode") {
                view.text = "Resume from ${position / 60_000}:${(position / 1000 % 60).toString().padStart(2, '0')}"
                view.visibility = if (position > 0) View.VISIBLE else View.GONE
            }
        }
    }

    @android.annotation.SuppressLint("RestrictedApi")
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN) {
            if (event.keyCode in listOf(KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_DPAD_DOWN,
                    KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_DPAD_RIGHT, KeyEvent.KEYCODE_DPAD_CENTER)) {
                userInteracted = true
            }
            if (event.keyCode == KeyEvent.KEYCODE_BACK) {
                if (detailMedia != null) navigate(page)
                else if (headerNavLinks?.hasFocus() == true) {
                    AlertDialog.Builder(this).setTitle("Exit Cine-verse TV?")
                        .setNegativeButton("Keep browsing", null).setPositiveButton("Exit") { _, _ -> finish() }.show()
                } else {
                    (getSystemService(android.content.Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager)
                        .hideSoftInputFromWindow(currentFocus?.windowToken, 0)
                    (navLinks[page] ?: navLinks["Home"])?.requestFocus()
                }
                return true
            }
        }
        return super.dispatchKeyEvent(event)
    }

    private fun loading(title: String = "Loading your cinema…"): Unit {
        body.removeAllViews()
        body.addView(label(title, 18f, Palette.gold))
        body.addView(row().apply { repeat(6) { addView(View(this@MainActivity).apply { background = shape(Palette.surface) }, LinearLayout.LayoutParams(dp(136), dp(204)).apply { setMargins(dp(8), dp(8), dp(8), 0) }) } })
    }

    private fun showError(message: String, retry: () -> Unit): Unit {
        val msg = message
        val friendly = when {
            msg.contains("404", true) -> "This page could not be found"
            msg.contains("503", true) || msg.contains("502", true) || msg.contains("504", true) -> "Service is temporarily unavailable. Please try again."
            msg.contains("timeout", true) -> "Request timed out. Check your connection."
            msg.contains("connection", true) || msg.contains("network", true) -> "Unable to connect. Check your internet."
            else -> "Something went wrong. Please try again."
        }
        body.removeAllViews()
        body.addView(label(friendly, 28f).apply { setTypeface(null, Typeface.BOLD); gravity = Gravity.CENTER })
        body.addView(label("We are working on it. Give it another shot.", 16f, Color.argb(190, 248, 244, 234)).apply { gravity = Gravity.CENTER })
        body.addView(action("Retry", true, retry).apply { requestFocus() }.apply { layoutParams = LinearLayout.LayoutParams(-2, dp(52)).apply { gravity = Gravity.CENTER } })
    }

    private fun navigate(name: String): Unit {
        page = name; detailMedia = null; userInteracted = false; reset(); Telemetry.event("page_view", path())
        when (name) {
            "Sports" -> navigate("Movies")
            "Networks" -> navigate("TV Shows")
            "Guides" -> navigate("Upcoming")
            "Settings" -> settings()
            "Explore" -> explore(true)
            "Watchlist" -> watchlist()
            "Upcoming" -> loadSimplePage("Coming soon", "movie/upcoming")
            "Movies" -> browsePage("Movies", "movie")
            "TV Shows" -> browsePage("TV Shows", "tv")
            else -> home()
        }
    }

    // ---------------- Hero ----------------

    private fun renderHero(): Unit {
        if (heroItems.isEmpty()) return
        cancelAutoRotate()
        val heroHeight = ((resources.displayMetrics.heightPixels / resources.displayMetrics.density - 60) * 0.72).toInt().coerceAtLeast(290)
        heroFrame?.let { body.removeView(it) }
        heroSteps = row()
        val frame = FrameLayout(this).apply {
            setBackgroundColor(Palette.background)
            backdropImage = ImageView(this@MainActivity).apply {
                scaleType = ImageView.ScaleType.CENTER_CROP
                load(TmdbApi.image(heroItems[heroIndex].media.backdrop, "w1280"))
                layoutParams = FrameLayout.LayoutParams(-1, -1); alpha = 1f
            }
            addView(backdropImage)
            addView(View(this@MainActivity).apply {
                background = GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,
                    intArrayOf(Color.argb(230, 9, 9, 11), Color.argb(140, 9, 9, 11), Color.argb(30, 9, 9, 11), Color.argb(230, 9, 9, 11)))
                layoutParams = FrameLayout.LayoutParams(-1, -1)
            })
            addView(View(this@MainActivity).apply {
                background = GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
                    intArrayOf(Color.argb(153, 0, 0, 0), Color.argb(0, 0, 0, 0)))
                layoutParams = FrameLayout.LayoutParams(-1, dp((heroHeight * 0.26).toInt()))
            })
            addView(View(this@MainActivity).apply {
                background = GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
                    intArrayOf(Palette.background, Color.argb(80, 9, 9, 11), Color.argb(0, 0, 0, 0)))
                layoutParams = FrameLayout.LayoutParams(-1, dp((heroHeight * 0.34).toInt()))
            })
            heroRatingBadge = TextView(this@MainActivity).apply {
                text = badgeText(heroItems[heroIndex])
                textSize = 14f; setTextColor(Color.WHITE); setGravity(Gravity.CENTER)
                setPadding(dp(10), dp(5), dp(10), dp(5))
                background = GradientDrawable().apply {
                    shape = GradientDrawable.RECTANGLE; cornerRadius = 6f
                    setColor(Color.argb(60, 0, 0, 0)); setStroke(strokePx(1f), Color.argb(32, 255, 255, 255))
                }
                layoutParams = FrameLayout.LayoutParams(-2, -2).apply { setMargins(0, 16, 16, 0); gravity = Gravity.TOP or Gravity.END }
            }
            addView(heroRatingBadge)
            heroContent = column().apply { gravity = Gravity.START }
            addView(heroContent, FrameLayout.LayoutParams(dp(520), -2, Gravity.CENTER_VERTICAL or Gravity.START).apply {
                leftMargin = dp(28); bottomMargin = dp(32)
            })
            val prev = iconPill("◀") { rotateTo((heroIndex - 1 + heroItems.size) % heroItems.size) }
            val next = iconPill("▶") { rotateTo((heroIndex + 1) % heroItems.size) }
            addView(row().apply {
                gravity = Gravity.CENTER_VERTICAL
                addView(heroSteps)
                addView(View(this@MainActivity), LinearLayout.LayoutParams(0, dp(1), 1f))
                addView(prev); addView(next)
            }, FrameLayout.LayoutParams(-1, -2).apply {
                setMargins(dp(18), 0, dp(18), dp(12)); gravity = Gravity.BOTTOM
            })
        }
        heroFrame = frame
        body.addView(frame, 0, LinearLayout.LayoutParams(-1, dp(heroHeight)))
        heroSteps.removeAllViews()
        renderHeroContent(heroItems[heroIndex])
        renderIndicators()
        startAutoRotate()
    }

    private fun renderIndicators(): Unit {
        heroSteps.removeAllViews()
        heroItems.forEachIndexed { i, _ ->
            val active = i == heroIndex
            heroSteps.addView(Button(this@MainActivity).apply {
                text = "${i + 1}."
                textSize = 14f; isAllCaps = false
                setTextColor(if (active) Color.WHITE else Color.argb(160, 255, 255, 255))
                setPadding(dp(8), dp(3), dp(8), dp(3))
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(if (active) Palette.gold else Color.TRANSPARENT)
                    if (!active) setStroke(strokePx(1.2f), Color.argb(90, 255, 255, 255))
                }
                isFocusable = true; isFocusableInTouchMode = true
                setOnFocusChangeListener { v, f ->
                    val gd = GradientDrawable().apply {
                        shape = GradientDrawable.OVAL
                        setColor(if (f || active) Palette.gold else Color.TRANSPARENT)
                        if (!(f || active)) setStroke(strokePx(1.2f), Color.argb(90, 255, 255, 255))
                    }
                    v.background = gd
                    v.scaleX = if (f || active) 1.06f else 1f; v.scaleY = v.scaleX
                }
                layoutParams = LinearLayout.LayoutParams(dp(48), dp(48)).apply { setMargins(dp(4), 0, dp(4), 0) }
                contentDescription = "${heroItems[i].media.title} step ${i + 1}"
                setOnClickListener { rotateTo(i) }
            })
        }
    }

    private fun rotateTo(newIndex: Int): Unit {
        if (newIndex == heroIndex || heroItems.isEmpty()) return
        val next = heroItems[newIndex]
        ObjectAnimator.ofFloat(backdropImage, "alpha", 1f, 0f).apply {
            duration = 300; start()
            addListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    backdropImage.load(TmdbApi.image(next.media.backdrop, "w1280"))
                    ObjectAnimator.ofFloat(backdropImage, "alpha", 0f, 1f).apply {
                        duration = 300; start()
                        ObjectAnimator.ofFloat(backdropImage, "scaleX", 1.05f, 1f).apply {
                            duration = 900; interpolator = DecelerateInterpolator(); start()
                        }
                        ObjectAnimator.ofFloat(backdropImage, "scaleY", 1.05f, 1f).apply {
                            duration = 900; interpolator = DecelerateInterpolator(); start()
                        }
                    }
                }
            })
        }
        heroIndex = newIndex
        heroRatingBadge.text = badgeText(next)
        renderHeroContent(next)
        renderIndicators()
    }

    private fun badgeText(item: HeroTitle): String {
        val m = item.media
        val meta = item.meta
        return meta.certification.ifBlank { "★ ${String.format(Locale.US, "%.1f", m.rating)}" }
    }

    private fun renderHeroContent(item: HeroTitle): Unit {
        heroAnimViews.clear()
        heroContent.removeAllViews()
        val meta = item.meta
        val m = item.media
        val titleView: View = if (meta.logoPath.isNotBlank()) {
            ImageView(this@MainActivity).apply {
                scaleType = ImageView.ScaleType.FIT_START
                load(TmdbApi.image(meta.logoPath, "w500"))
                contentDescription = m.title
            }
        } else {
            label(m.title.uppercase(Locale.getDefault()), 34f).apply {
                typeface = Typeface.create("sans-serif-condensed", Typeface.BOLD)
                maxLines = 2; gravity = Gravity.START
            }
        }
        val btnRow = row().apply { gravity = Gravity.START }
        val play = pill("▶  Play", true) { detail(m, true) }
        val myListBtn = pill("+  My List") {
            lifecycleScope.launch {
                toggleWatchlist(m)
                renderHeroContent(item)
            }
        }
        lifecycleScope.launch {
            val s = store.watchlist().any { it.key == m.key }
            myListBtn.text = if (s) "✓  My List" else "+  My List"
        }
        btnRow.addView(play); btnRow.addView(myListBtn); btnRow.addView(pill("More info") { detail(m) })
        val metaLine = label(buildString {
            append(m.year)
            if (meta.seasons > 0) append(" · ${meta.seasons} Seasons")
            else if (meta.runtime > 0) append(" · ${meta.runtime / 60}h ${meta.runtime % 60}m")
            append(" · ★")
            val filled = Math.round(m.rating / 2.0).toInt().coerceIn(0, 5)
            append("★".repeat(filled)); append("☆".repeat(5 - filled))
        }, 16f, Palette.gold).apply { gravity = Gravity.START }
        val synopsis = label(m.overview, 16f, Color.argb(225, 255, 255, 255)).apply {
            maxLines = 2; gravity = Gravity.START; ellipsize = TextUtils.TruncateAt.END
        }
        val tm = dp(12)
        heroContent.addView(titleView, LinearLayout.LayoutParams(if (titleView is ImageView) dp(360) else -1, if (titleView is ImageView) dp(78) else -2).apply { setMargins(0, 0, 0, tm) })
        heroContent.addView(btnRow, LinearLayout.LayoutParams(-2, -2).apply { setMargins(0, 0, 0, dp(8)) })
        heroContent.addView(metaLine, LinearLayout.LayoutParams(-2, -2).apply { setMargins(0, 0, 0, dp(6)) })
        heroContent.addView(synopsis, LinearLayout.LayoutParams(-1, -2))
        heroAnimViews.add(titleView); heroAnimViews.add(btnRow); heroAnimViews.add(metaLine); heroAnimViews.add(synopsis)
        ObjectAnimator.ofFloat(heroContent, "alpha", 0f, 1f).apply {
            duration = 350; interpolator = DecelerateInterpolator(1.2f); start()
        }
    }

    private fun cancelAutoRotate(): Unit { heroJobHandle?.cancel() }
    private fun startAutoRotate(): Unit {
        cancelAutoRotate()
        if (heroItems.size <= 1 || !ValueAnimator.areAnimatorsEnabled()) return
        heroJobHandle = lifecycleScope.launch {
            while (isActive) {
                delay(9000)
                if (!userInteracted && heroItems.size > 1) {
                    userInteracted = false
                    rotateTo((heroIndex + 1) % heroItems.size)
                }
            }
        }
    }

    private fun makeHero(media: Media): Unit {
        lifecycleScope.launch {
            val meta = try { tmdb.heroMeta(media) } catch (_: Exception) { HeroMeta("", "", 0, 0, emptyList()) }
            heroItems = listOf(HeroTitle(media, meta)) + heroItems.filter { it.media.key != media.key }
            heroIndex = 0
            userInteracted = true
            renderHero()
        }
    }

    // ---------------- Home ----------------

    private fun home(): Unit {
        loading()
        contentJob = lifecycleScope.launch {
            try {
                val daily = async { tmdb.list("trending/all/day").filter { it.kind != "person" }.take(5) }
                val newReleases = async { tmdb.list("movie/upcoming") }
                val trending = async { tmdb.list("trending/movie/week") }
                val popular = async { tmdb.list("movie/popular") }
                val topRated = async { tmdb.list("movie/top_rated") }
                val hTitles = daily.await().map { title ->
                    async { HeroTitle(title, try { tmdb.heroMeta(title) } catch (_: Exception) { HeroMeta("", "", 0, 0, emptyList()) }) }
                }.awaitAll()
                heroItems = hTitles
                heroIndex = 0
                body.removeAllViews()
                renderHero()
                buildSecondaryStrip()
                if (newReleases.await().isNotEmpty()) {
                    body.addView(section6("New Releases", newReleases.await()) { makeHero(it) })
                    body.addView(View(this@MainActivity).apply { layoutParams = LinearLayout.LayoutParams(-1, dp(12)) })
                }
                val sections = listOf("Trending this week" to trending.await(), "Popular" to popular.await(), "Top rated" to topRated.await())
                sections.forEach { (title, items) -> posters(title, applyFilters(items), large = false) }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { showError(e.message ?: "Check your connection") { navigate("Home") } }
        }
    }

    private fun buildSecondaryStrip(): Unit {
        val strip = row().apply {
            background = shape(Color.rgb(19, 22, 28)).apply { setStroke(1, Color.argb(20, 255, 255, 255)) }
            minimumHeight = dp(44)
            listOf("ALL SHOWS", "FAVOURITES", "RECOMMENDED", "WATCH ON TV").forEach { t ->
                addView(tabChip(t, homeTab == t) {
                    homeTab = t
                    when (t) {
                        "FAVOURITES" -> navigate("Watchlist")
                        "RECOMMENDED" -> loadSimplePage("Top rated", "movie/top_rated")
                        "WATCH ON TV" -> navigate("TV Shows")
                        else -> navigate("Home")
                    }
                })
            }
            addView(View(this@MainActivity), LinearLayout.LayoutParams(0, dp(1), 1f))
            addView(action("Genres") { showFilters() })
            addView(action("Browse all") { navigate("Movies") })
        }
        body.addView(strip); body.addView(View(this@MainActivity).apply { layoutParams = LinearLayout.LayoutParams(-1, dp(8)) })
    }

    private fun applyFilters(items: List<Media>): List<Media> {
        var out = items
        if (genreFilter.isNotBlank()) {
            val id = genreFilter.toIntOrNull()
            if (id != null) out = out.filter { m -> m.genreIds.contains(id) }
        }
        if (searchQuery.isNotBlank()) out = out.filter { m -> m.title.contains(searchQuery, ignoreCase = true) }
        return out
    }

    // ---------------- Common pages ----------------

    private fun reset(paddingTop: Int = 20): Unit {
        streamDialog?.dismiss()
        detailResumeView = null; heroFrame = null
        contentJob?.cancel(); heroJobHandle?.cancel()
        host.removeAllViews()
        body = column().apply { setPadding(dp(28), dp(paddingTop), dp(28), dp(48)) }
        host.addView(ScrollView(this@MainActivity).apply { isFillViewport = true; addView(body) }, FrameLayout.LayoutParams(-1, -1))
        refreshNav()
    }

    private fun path(): String = detailMedia?.let { "/${it.kind}/${it.id}" } ?: if (page == "Home") "/" else "/${page.lowercase().replace(' ', '-')}"

    private fun posters(title: String, items: List<Media>, large: Boolean = false): Unit {
        if (items.isEmpty()) return
        body.addView(posterRow(title, if (large) "Fresh on Cine-verse" else "", items, large, ::detail, { gridPage(title, items) }, { }, rowPositions[title] ?: 0))
        body.addView(View(this@MainActivity).apply { layoutParams = LinearLayout.LayoutParams(-1, dp(10)) })
    }

    private fun gridPage(title: String, items: List<Media>): Unit {
        reset(); body.removeAllViews()
        body.addView(label(title, 20f).apply { setTypeface(null, Typeface.BOLD) })
        body.addView(VerticalGridView(this@MainActivity).apply {
            setNumColumns(6); clipChildren = false
            adapter = PosterAdapter(items, ::detail, { })
        }, LinearLayout.LayoutParams(-1, dp(288)))
        body.addView(View(this@MainActivity).apply { layoutParams = LinearLayout.LayoutParams(-1, dp(10)) })
    }

    private fun browsePage(title: String, kind: String): Unit {
        loading("Loading $title…")
        contentJob = lifecycleScope.launch {
            try {
                val items = tmdb.list(if (kind == "movie") "movie/popular" else "tv/popular", kind = kind)
                body.removeAllViews(); body.addView(sectionTitle(title, if (kind == "movie") "Movies to stream now" else "Series to binge now"))
                body.addView(VerticalGridView(this@MainActivity).apply {
                    setNumColumns(6); clipChildren = false
                    adapter = PosterAdapter(items, ::detail, { })
                }, LinearLayout.LayoutParams(-1, dp(288)))
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { showError(e.message ?: "Check your connection") { browsePage(title, kind) } }
        }
    }

    private fun loadSimplePage(title: String, endpoint: String, kind: String = "movie"): Unit {
        loading("Loading $title…")
        contentJob = lifecycleScope.launch {
            try {
                val items = tmdb.list(endpoint, kind = kind); body.removeAllViews()
                body.addView(sectionTitle(title, "Fresh release dates from TMDB"))
                body.addView(VerticalGridView(this@MainActivity).apply {
                    setNumColumns(6); clipChildren = false
                    adapter = PosterAdapter(items, ::detail, { })
                }, LinearLayout.LayoutParams(-1, dp(288)))
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { showError(e.message ?: "Check your connection") { loadSimplePage(title, endpoint, kind) } }
        }
    }

    private fun watchlist(): Unit {
        loading("Opening your watchlist…")
        contentJob = lifecycleScope.launch {
            val items = store.watchlist(); body.removeAllViews()
            body.addView(sectionTitle("Your watchlist", "Saved on this TV · no account needed"))
            if (items.isEmpty()) {
                body.addView(label("◇", 52f, Palette.gold).apply { gravity = Gravity.CENTER })
                body.addView(label("Your watchlist is empty", 22f).apply { gravity = Gravity.CENTER })
                body.addView(label("Keep the stories you want close by.", 16f, Color.argb(170, 248, 244, 234)).apply { gravity = Gravity.CENTER })
                body.addView(row().apply { gravity = Gravity.CENTER; addView(action("Browse trending", true) { navigate("Home") }.apply { requestFocus() }) })
            } else {
                body.addView(VerticalGridView(this@MainActivity).apply {
                    setNumColumns(6); clipChildren = false
                    adapter = PosterAdapter(items, ::detail, { })
                }, LinearLayout.LayoutParams(-1, dp(288)))
            }
        }
    }

    // ---------------- Detail, streaming, player ----------------

    private fun detail(media: Media, autoPlay: Boolean = false): Unit {
        reset(0); detailMedia = media; loading("Opening ${media.title}…"); Telemetry.event("page_view", "/${media.kind}/${media.id}")
        contentJob = lifecycleScope.launch {
            try {
                val data = tmdb.detail(media)
                if (media.kind == "tv") {
                    val seasons = data.items("seasons").filter { it.optInt("season_number") > 0 }
                    val saved = episodeSelections[media.key]
                    val selectedSeason = seasons.firstOrNull { it.optInt("season_number") == saved?.first } ?: seasons.firstOrNull()
                    season = selectedSeason?.optInt("season_number") ?: 1
                    episode = (saved?.takeIf { it.first == season }?.second ?: 1).coerceIn(1, (selectedSeason?.optInt("episode_count") ?: 1).coerceAtLeast(1))
                    episodeSelections[media.key] = season to episode
                } else { season = 0; episode = 0 }
                renderDetail(media, data); if (autoPlay) streamPicker(media)
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { showError(e.message ?: "Details are unavailable") { detail(media) } }
        }
    }

    private suspend fun renderDetail(media: Media, data: JSONObject): Unit {
        body.removeAllViews()
        val hero = FrameLayout(this)
        hero.addView(ImageView(this@MainActivity).apply { scaleType = ImageView.ScaleType.CENTER_CROP; load(TmdbApi.image(media.backdrop, "original")) }, FrameLayout.LayoutParams(-1, -1))
        hero.addView(View(this@MainActivity).apply { background = GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, intArrayOf(0xf209090b.toInt(), 0xcc09090b.toInt(), 0x4409090b, 0xef09090b.toInt())) }, FrameLayout.LayoutParams(-1, -1))
        val content = row().apply { gravity = Gravity.CENTER_VERTICAL; setPadding(dp(28), dp(26), dp(34), dp(22)) }
        content.addView(ImageView(this@MainActivity).apply { scaleType = ImageView.ScaleType.CENTER_CROP; load(TmdbApi.image(media.poster)); contentDescription = "Poster for ${media.title}" }, LinearLayout.LayoutParams(dp(210), dp(315)).apply { setMargins(0, 0, dp(28), 0) })
        val copy = column(); content.addView(copy, LinearLayout.LayoutParams(0, -2, 1f))
        copy.addView(label(media.title.uppercase(Locale.getDefault()), 34f).apply { typeface = Typeface.create("sans-serif-condensed", Typeface.BOLD); maxLines = 2 })
        val runtime = data.optInt("runtime"); val genres = data.items("genres").joinToString(" · ") { it.optString("name") }
        copy.addView(label("${media.year}  ·  ${if (runtime > 0) "${runtime / 60}h ${runtime % 60}m  ·  " else ""}★ ${"%.1f".format(Locale.US, media.rating)}  ·  $genres", 16f, Palette.gold).apply { maxLines = 2 })
        data.optString("tagline").takeIf(String::isNotBlank)?.let { copy.addView(label(it, 17f, Palette.gold)) }
        copy.addView(label(media.overview, 16f, Color.argb(225, 248, 244, 234)).apply { maxLines = 3; ellipsize = TextUtils.TruncateAt.END })
        copy.addView(label("Press Down for the full overview", 13f, Color.argb(140, 248, 244, 234)))
        val actions = row(); actions.addView(action(if (media.kind == "tv") "▶  Play episode" else "▶  Play movie", true) { streamPicker(media) })
        actions.addView(action("Trailer") { openTrailer(data) })
        val isSaved = store.watchlist().any { it.key == media.key }; val save = action(if (isSaved) "✓  Watchlisted" else "+  Watchlist") { }
        save.setOnClickListener { lifecycleScope.launch { save.text = if (toggleWatchlist(media)) "✓  Watchlisted" else "+  Watchlist" } }
        actions.addView(save); copy.addView(actions)
        hero.addView(content, FrameLayout.LayoutParams(-1, -1)); body.addView(hero, LinearLayout.LayoutParams(-1, dp(410)))
        body.addView(action("Read full overview") { AlertDialog.Builder(this).setTitle(media.title).setMessage(media.overview).setPositiveButton("Done", null).show() })
        val resume = store.position("${media.key}:$season:$episode")
        detailResumeView = label("Resume from ${resume / 60_000}:${(resume / 1000 % 60).toString().padStart(2, '0')}", 16f, Palette.emerald).apply {
            background = shape(Color.argb(30, 0, 200, 150)); setPadding(dp(16), dp(10), dp(16), dp(10))
            visibility = if (resume > 0) View.VISIBLE else View.GONE
        }
        body.addView(detailResumeView)
        if (media.kind == "tv") addEpisodePicker(media, data) else { season = 0; episode = 0 }
        val cast = data.optJSONObject("credits")?.items("cast").orEmpty().take(12)
        if (cast.isNotEmpty()) {
            body.addView(label("Cast", 20f).apply { setTypeface(null, Typeface.BOLD) }); val castRow = row()
            cast.forEach { person -> castRow.addView(column().apply {
                addView(ImageView(this@MainActivity).apply { load(TmdbApi.image(person.optString("profile_path"), "w185")); scaleType = ImageView.ScaleType.CENTER_CROP }, LinearLayout.LayoutParams(dp(92), dp(112)))
                addView(label(person.optString("name"), 14f).apply { maxLines = 1 }); addView(label(person.optString("character"), 12f, Palette.gold).apply { maxLines = 1 })
                contentDescription = """${person.optString("name")} as ${person.optString("character")}"""; tvFocus(true)
            }, LinearLayout.LayoutParams(dp(128), dp(170)).apply { setMargins(dp(5), dp(5), dp(5), dp(5)) }) }
            body.addView(android.widget.HorizontalScrollView(this@MainActivity).apply { addView(castRow) })
        }
        data.optJSONObject("reviews")?.items("results").orEmpty().take(3).forEach { review ->
            body.addView(column().apply { background = shape(Palette.surface); setPadding(dp(16), dp(12), dp(16), dp(12)); addView(label(review.optString("author"), 16f, Palette.gold)); addView(label(review.optString("content"), 14f, Color.argb(190, 248, 244, 234)).apply { maxLines = 3; ellipsize = TextUtils.TruncateAt.END }) }, LinearLayout.LayoutParams(-1, -2).apply { setMargins(0, dp(5), 0, dp(5)) })
        }
        for (key in listOf("similar", "recommendations")) posters(key.replaceFirstChar(Char::uppercase), data.optJSONObject(key)?.items("results").orEmpty().map { Media.from(it, media.kind) })
        actions.getChildAt(0).requestFocus()
    }

    private fun addEpisodePicker(media: Media, data: JSONObject): Unit {
        body.addView(label("Choose an episode", 20f).apply { setTypeface(null, Typeface.BOLD) }); val controls = row(); val seasonButton = action("Season $season") { }; val episodeButton = action("Episode $episode") { }
        controls.addView(seasonButton); controls.addView(episodeButton); body.addView(controls)
        seasonButton.setOnClickListener {
            val seasons = data.items("seasons").filter { it.optInt("season_number") > 0 }
            AlertDialog.Builder(this).setTitle("Season").setItems(seasons.map { it.optString("name") }.toTypedArray()) { _, index ->
                season = seasons[index].optInt("season_number"); episode = 1; episodeSelections[media.key] = season to episode
                seasonButton.text = "Season $season"; episodeButton.text = "Episode 1"
            }.show()
        }
        episodeButton.setOnClickListener { lifecycleScope.launch {
            try { val episodes = tmdb.season(media.id, season)
                AlertDialog.Builder(this@MainActivity).setTitle("Episode").setItems(episodes.map { "${it.optInt("episode_number")} · ${it.optString("name")}" }.toTypedArray()) { _, index ->
                    episode = episodes[index].optInt("episode_number"); episodeSelections[media.key] = season to episode
                    episodeButton.text = "Episode $episode"
                }.show()
            } catch (_: Exception) { toast("Episodes are unavailable") }
        } }
    }

    private fun openTrailer(data: JSONObject): Unit {
        val video = data.optJSONObject("videos")?.items("results")?.firstOrNull { it.optString("site") == "YouTube" && it.optString("type") == "Trailer" }
        if (video == null) toast("No trailer is available") else try { startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse("https://www.youtube.com/watch?v=${video.optString("key")}"))) } catch (_: android.content.ActivityNotFoundException) { toast("Install YouTube to watch trailers") }
    }

    private fun playbackLoading(panel: LinearLayout, media: Media): TextView {
        val artwork = FrameLayout(this).apply {
            background = shape(Palette.background)
            clipToOutline = true
        }
        artwork.addView(ImageView(this).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            load(TmdbApi.image(media.backdrop.ifBlank { media.poster }, "w1280"))
            alpha = 0.8f
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }, FrameLayout.LayoutParams(-1, -1))
        artwork.addView(View(this).apply {
            background = GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,
                intArrayOf(Color.argb(245, 13, 15, 18), Color.argb(215, 13, 15, 18), Color.argb(65, 13, 15, 18)))
        }, FrameLayout.LayoutParams(-1, -1))
        val message = label("Settle in. We’re getting it ready.", 17f, Palette.muted).apply {
            accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        }
        val dots = (0 until 4).map {
            View(this).apply {
                background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(Palette.gold) }
                alpha = 0.6f
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            }
        }
        val content = column().apply {
            setPadding(dp(28), dp(22), dp(28), dp(22))
            addView(label("YOUR CINEMA MOMENT", 14f, Palette.gold).apply { letterSpacing = 0.16f })
            addView(label(media.title, 30f).apply { setTypeface(null, Typeface.BOLD); maxLines = 2; ellipsize = TextUtils.TruncateAt.END })
            if (media.kind == "tv") addView(label("Season $season · Episode $episode", 16f, Palette.muted))
            addView(message)
            addView(row().apply {
                setPadding(dp(4), dp(18), 0, dp(4))
                dots.forEach { addView(it, LinearLayout.LayoutParams(dp(8), dp(8)).apply { rightMargin = dp(10) }) }
            })
        }
        artwork.addView(content, FrameLayout.LayoutParams(dp(520), -2, Gravity.CENTER_VERTICAL or Gravity.START))
        panel.addView(artwork, LinearLayout.LayoutParams(-1, dp(304)))
        if (ValueAnimator.areAnimatorsEnabled()) {
            streamPulse = ValueAnimator.ofFloat(0f, (Math.PI * 2).toFloat()).apply {
                duration = 1800
                repeatCount = 63
                addUpdateListener { animator ->
                    val phase = animator.animatedValue as Float
                    dots.forEachIndexed { index, view -> view.alpha = 0.3f + 0.7f * ((kotlin.math.sin(phase - index * 0.7f) + 1f) / 2f) }
                }
                start()
            }
        }
        return message
    }

    private fun stopPlaybackLoading(): Unit {
        streamPulse?.cancel()
        streamPulse = null
    }

    @androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
    private fun streamPicker(media: Media): Unit {
        streamDialog?.dismiss()
        val dialog = Dialog(this); dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        streamDialog = dialog
        val panel = column().apply { setPadding(dp(26), dp(18), dp(26), dp(20)); setBackgroundColor(Palette.surface) }
        val waitingMessage = playbackLoading(panel, media)
        panel.addView(action("Keep browsing") { dialog.dismiss() }.apply { requestFocus() })
        dialog.setContentView(ScrollView(this@MainActivity).apply { addView(panel) }); dialog.show(); dialog.window?.apply { setLayout(-1, dp(440)); setGravity(Gravity.BOTTOM); setBackgroundDrawableResource(android.R.color.transparent) }
        val resolver = lifecycleScope.launch {
            try {
                val base = store.scraperBase(); val api = StreamApi(base, this@MainActivity)
                val coreSettings = CoreConfig.settings(this@MainActivity)
                if (coreSettings.minimumVersion.isNotBlank()) {
                    val service = api.status()
                    check(!TvUpdater.newer(coreSettings.minimumVersion, service.serviceVersion)) { "The streaming server needs a maintenance update. Please try later." }
                }
                val streams = api.streams(media, season, episode, exclude = coreSettings.brokenSources, onWake = {
                    waitingMessage.text = "Thanks for waiting. We’re still getting it ready."
                })
                val status = try { api.status() } catch (e: CancellationException) { throw e } catch (_: Exception) { null }
                stopPlaybackLoading()
                val brokenSources = coreSettings.brokenSources + (status?.brokenSources ?: emptySet())
                var quality = "Auto"; var source = "All"; var selected: StreamOption? = null
                fun render(): Unit {
                    panel.removeAllViews(); panel.addView(label("Choose picture quality", 23f).apply { setTypeface(null, Typeface.BOLD) })
                    if (streams.isEmpty()) {
                        val configured = status?.adapters?.values?.any { it == "configured" || it == "ok" } == true
                        panel.addView(label(if (configured) "This title isn't available right now" else "Playback is temporarily unavailable", 20f))
                        panel.addView(label("Please try again in a moment, or choose another title.", 15f, Color.argb(170, 248, 244, 234)))
                        if (!configured) panel.addView(action("Open Settings", true) { dialog.dismiss(); navigate("Settings") }.apply { requestFocus() })
                        panel.addView(action("Retry", configured) { dialog.dismiss(); streamPicker(media) }.apply { if (configured) requestFocus() })
                        panel.addView(action("Close") { dialog.dismiss() }); return
                    }
                    val qualities = listOf("Auto", "4K", "1080p", "720p").filter { value -> value == "Auto" || streams.any { it.quality.equals(value, true) } }
                    val sources = listOf("All") + streams.map { it.source }.distinct(); val controls = row()
                    controls.addView(action("Quality: $quality") { AlertDialog.Builder(this@MainActivity).setItems(qualities.toTypedArray()) { _, index -> quality = qualities[index]; selected = null; render() }.show() })
                    controls.addView(action("Source: $source") { AlertDialog.Builder(this@MainActivity).setItems(sources.toTypedArray()) { _, index -> source = sources[index]; selected = null; render() }.show() })
                    panel.addView(controls)
                    panel.addView(label("${streams.filter { (quality == "Auto" || it.quality.equals(quality, true)) && (source == "All" || it.source == source) }.size} stream${if (streams.any { (quality == "Auto" || it.quality.equals(quality, true)) && (source == "All" || it.source == source) }) "s" else ""}", 14f, Color.argb(160, 248, 244, 234)))
                    streams.filter { (quality == "Auto" || it.quality.equals(quality, true)) && (source == "All" || it.source == source) }.forEach { stream ->
                        val maintenance = stream.source in brokenSources; val row = action("${if (selected == stream) "✓  " else ""}${stream.quality}   ${stream.source}${if (maintenance) "   · Source under maintenance" else ""}") { if (!maintenance) { selected = stream; render() } }
                        row.isEnabled = !maintenance; row.alpha = if (maintenance) 0.5f else 1f
                        row.layoutParams = LinearLayout.LayoutParams(-1, dp(58)).apply { setMargins(0, dp(3), 0, dp(3)) }
                        panel.addView(row)
                    }
                    val footer = row(); selected?.let { stream -> footer.addView(action("Play now", true) { dialog.dismiss(); startActivity(Intent(this@MainActivity, PlayerActivity::class.java).putExtra("media", media.json()).putExtra("stream", stream.json()).putExtra("scraperBase", base).putExtra("season", season).putExtra("episode", episode).putExtra("muted", heroMuted)) }.apply { requestFocus() }) }
                    footer.addView(action("Close") { dialog.dismiss() }); panel.addView(footer)
                }; render()
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) {
                stopPlaybackLoading()
                panel.removeAllViews(); panel.addView(label("We couldn’t get this title ready", 22f))
                val message = when ((e as? HttpStatusException)?.code) {
                    404 -> "This title isn’t available to watch right now. Try another title or retry later."
                    408, 429, 502, 503, 504 -> "It’s taking longer than expected. Please try again in a moment."
                    else -> "Please check your connection and try again."
                }
                panel.addView(label(message, 15f, Palette.ruby))
                panel.addView(action("Retry", true) { dialog.dismiss(); streamPicker(media) }.apply { requestFocus() })
                panel.addView(action("Settings") { dialog.dismiss(); navigate("Settings") }); panel.addView(action("Close") { dialog.dismiss() })
            }
        }
        dialog.setOnDismissListener {
            resolver.cancel()
            stopPlaybackLoading()
            if (streamDialog === dialog) streamDialog = null
        }
    }

    // ---------------- Settings, filters, updates ----------------

    private fun settings(): Unit {
        profileButton?.text = if (pairing.currentAccount() == null) "Guest" else "Account"
        body.removeAllViews()
        body.addView(sectionTitle("Settings", "Simple, local, and account-free"))
        body.addView(label("Playback service", 20f, Palette.gold).apply { setTypeface(null, Typeface.BOLD) })
        body.addView(label("Browsing, watchlist, and resume work without an account.", 15f, Color.argb(185, 248, 244, 234)))
        val base = searchField("HTTPS playback service").apply { contentDescription = "Playback service URL" }
        body.addView(base, LinearLayout.LayoutParams(-1, dp(54)))
        lifecycleScope.launch { base.setText(store.scraperBase()) }
        val serviceStatus = label("Service not checked", 14f, Color.argb(160, 248, 244, 234)); body.addView(serviceStatus)
        body.addView(row().apply {
            addView(action("Save & test", true) { lifecycleScope.launch {
                try { store.saveScraperBase(base.text.toString()); val status = StreamApi(store.scraperBase(), this@MainActivity).status(); val configured = status.adapters.count { it.value == "configured" || it.value == "ok" }
                    serviceStatus.setTextColor(if (configured > 0) Palette.emerald else Palette.gold)
                    serviceStatus.text = "Service ${status.serviceVersion} · $configured provider${if (configured == 1) "" else "s"} configured${if (status.brokenSources.isEmpty()) "" else " · ${status.brokenSources.size} under maintenance"}" }
                catch (e: Exception) { serviceStatus.setTextColor(Palette.ruby); serviceStatus.text = e.message ?: "Service check failed" }
            } })
            addView(action("Use remote settings") { lifecycleScope.launch {
                store.saveScraperBase(""); CoreConfig.refresh(this@MainActivity, force = true)
                base.setText(store.scraperBase()); serviceStatus.text = CoreConfig.lastStatus
            } })
            addView(action("Refresh settings") { lifecycleScope.launch {
                CoreConfig.refresh(this@MainActivity, force = true); base.setText(store.scraperBase()); serviceStatus.text = CoreConfig.lastStatus
            } })
        })
        body.addView(label("App", 20f, Palette.gold).apply { setTypeface(null, Typeface.BOLD); setPadding(dp(4), dp(20), dp(4), dp(5)) })
        body.addView(action("Check for TV updates", true) { startActivity(Intent(this, UpdateActivity::class.java)) })
        body.addView(label("Account", 20f, Palette.gold).apply { setTypeface(null, Typeface.BOLD); setPadding(dp(4), dp(20), dp(4), dp(5)) })
        val account = pairing.currentAccount()
        body.addView(label(account?.let { "Linked to ${it.displayName}. Your account watchlist syncs with this TV." }
            ?: "Continue as guest, or link your mobile / web account to sync your watchlist.", 15f, Color.argb(185, 248, 244, 234)))
        body.addView(row().apply {
            addView(action(if (account == null) "Link account" else "Sync watchlist") {
                if (account == null) showQRLinkDialog() else syncAccountWatchlist(showResult = true)
            })
            if (account != null) addView(action("Unlink account") { lifecycleScope.launch {
                try { pairing.unlink(); settings(); toast("Account unlinked. Your TV watchlist is retained.") }
                catch (e: CancellationException) { throw e }
                catch (_: Exception) { toast("Could not unlink. Check your connection and retry.") }
            } })
        })
        body.addView(label("Resume is saved on this TV. Account linking is optional. Trailers open in YouTube. Reduced motion follows Android's animation setting.\nCine-verse TV ${BuildConfig.VERSION_NAME}", 15f, Color.argb(170, 248, 244, 234)))
        Telemetry.lastError?.let { body.addView(label(it, 14f, Palette.ruby)) }
    }

    private fun showQRLinkDialog(): Unit {
        val dialog = android.app.Dialog(this); dialog.requestWindowFeature(android.view.Window.FEATURE_NO_TITLE)
        val panel = column().apply { setPadding(dp(40), dp(24), dp(40), dp(24)); setBackgroundColor(Palette.surface) }
        panel.addView(label("Link your Cine-verse account", 24f).apply { setTypeface(null, Typeface.BOLD) })
        panel.addView(label("Scan with your phone camera, sign in to your existing account, then approve this TV.", 15f, Color.argb(185, 248, 244, 234)))
        val qrView = android.widget.ImageView(this@MainActivity).apply { scaleType = android.widget.ImageView.ScaleType.CENTER_INSIDE }
        panel.addView(qrView, LinearLayout.LayoutParams(dp(240), dp(240)).apply { gravity = Gravity.CENTER; setMargins(0, dp(12), 0, dp(12)) })
        val status = label("Creating a private TV request…", 15f, Palette.gold).apply { gravity = Gravity.CENTER }
        panel.addView(status)
        panel.addView(label("Optional · QR expires after 10 minutes · Watchlist sync only", 14f).apply { gravity = Gravity.CENTER })
        panel.addView(row().apply { gravity = Gravity.CENTER; addView(action("Close") { dialog.dismiss() }.apply { requestFocus() }) }.apply { setPadding(0, dp(16), 0, 0) })
        dialog.setContentView(panel); dialog.show(); dialog.window?.setLayout(dp(700), -2)
        var request: PairingRequest? = null
        val job = lifecycleScope.launch {
            try {
                val pending = pairing.begin(); request = pending
                val matrix = QRCodeWriter().encode(pending.url, BarcodeFormat.QR_CODE, 480, 480)
                val pixels = IntArray(480 * 480) { index -> if (matrix[index % 480, index / 480]) Color.BLACK else Color.WHITE }
                qrView.setImageBitmap(Bitmap.createBitmap(pixels, 480, 480, Bitmap.Config.ARGB_8888))
                val linked = pairing.awaitLinked(pending) { status.text = it }
                status.text = "Linked to ${linked.displayName}. Importing your watchlist…"
                store.replaceWatchlist(pairing.syncWatchlist(store.watchlist(), mergeLocal = true))
                settings(); toast("Account linked. Watchlist synced."); dialog.dismiss()
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { status.setTextColor(Palette.ruby); status.text = e.message ?: "Link failed. Close and try again." }
        }
        dialog.setOnDismissListener { job.cancel(); request?.let { pending -> lifecycleScope.launch { runCatching { pairing.cancel(pending) } } } }
    }

    private suspend fun toggleWatchlist(media: Media): Boolean {
        val added = store.toggle(media)
        syncAccountWatchlist()
        return added
    }

    private fun syncAccountWatchlist(showResult: Boolean = false): Unit {
        if (!::pairing.isInitialized || pairing.currentAccount() == null || accountSyncJob?.isActive == true) return
        accountSyncJob = lifecycleScope.launch {
            try {
                if (!store.watchlistNeedsSync()) store.replaceWatchlist(pairing.syncWatchlist(store.watchlist()), onlyIfClean = true)
                while (store.watchlistNeedsSync()) {
                    val pending = store.watchlist(); pairing.pushWatchlist(pending); store.watchlistSynced(pending)
                }
                if (page == "Watchlist" && detailMedia == null) watchlist()
                if (showResult) toast("Account watchlist synced")
            } catch (e: CancellationException) { throw e }
            catch (_: Exception) { if (showResult) toast("Account sync unavailable. Your TV watchlist is saved locally.") }
        }
    }

    private fun showFilters(): Unit {
        contentJob = lifecycleScope.launch {
            try {
                val movieGenres = tmdb.genres("movie")
                val known = movieGenres.map { it.getInt("id") }.toSet()
                val all = movieGenres + tmdb.genres("tv").filterNot { known.contains(it.getInt("id")) }
                val names = listOf("" to "All genres") + all.map { it.getInt("id").toString() to it.getString("name") }
                AlertDialog.Builder(this@MainActivity).setTitle("Filter by genre")
                    .setItems(names.map { it.second }.toTypedArray()) { _, index -> genreFilter = names[index].first; home() }.show()
            } catch (_: Exception) { toast("Genres are unavailable") }
        }
    }

    private fun explore(focusKeyboard: Boolean): Unit {
        body.removeAllViews()
        body.addView(sectionTitle("Find your next story", "Movies and series, made for the big screen"))
        val input = EditText(this).apply {
            hint = "Search movies or series"; setSingleLine(); setText(searchTerm); textSize = 18f; minHeight = dp(56)
            setTextColor(Palette.text); setHintTextColor(Color.argb(150, 248, 244, 234)); background = shape(Palette.surface)
            setPadding(dp(18), 0, dp(18), 0); contentDescription = "Search titles"
        }
        body.addView(input, LinearLayout.LayoutParams(-1, dp(58)).apply { setMargins(0, dp(14), 0, dp(8)) })
        val filters = row(); body.addView(filters); val results = column(); body.addView(results); var searchJob: Job? = null
        fun refresh(): Unit {
            searchJob?.cancel(); searchJob = lifecycleScope.launch {
                delay(500); results.removeAllViews(); results.addView(label("Searching…", 16f, Palette.gold))
                try {
                    val params = mutableMapOf<String, String>(); if (searchTerm.isNotBlank()) params["query"] = searchTerm
                    if (searchGenre.isNotBlank()) params["with_genres"] = searchGenre
                    if (searchYear.isNotBlank()) params[if (searchKind == "tv") "first_air_date_year" else if (searchTerm.isBlank()) "primary_release_year" else "year"] = searchYear
                    val endpoint = if (searchTerm.isBlank()) "discover/$searchKind" else "search/$searchKind"
                    val values = tmdb.get(endpoint, params).items("results").filter { searchGenre.isBlank() || it.optJSONArray("genre_ids")?.let { ids -> (0 until ids.length()).any { i -> ids.optString(i) == searchGenre } } == true }
                        .map { Media.from(it, searchKind) }
                    results.removeAllViews(); if (values.isEmpty()) results.addView(label("No titles found. Try another search or filter.")) else addGrid(results, values)
                    if (searchTerm.isNotBlank()) Telemetry.event("search", "/explore")
                } catch (e: CancellationException) { throw e }
                catch (_: Exception) { results.removeAllViews(); results.addView(action("Search failed · Retry", true) { refresh() }) }
            }; contentJob = searchJob
        }
        filters.addView(action(if (searchKind == "movie") "Movies" else "Series") { searchKind = if (searchKind == "movie") "tv" else "movie"; searchGenre = ""; navigate(page) })
        filters.addView(action("Genre: ${if (searchGenre.isBlank()) "All" else "Selected"}") {
            lifecycleScope.launch {
                try {
                    val genres = tmdb.genres(searchKind); AlertDialog.Builder(this@MainActivity).setTitle("Choose genre")
                        .setItems((listOf("All genres") + genres.map { it.getString("name") }).toTypedArray()) { _, index ->
                            searchGenre = if (index == 0) "" else genres[index - 1].getInt("id").toString(); refresh()
                        }.show()
                } catch (_: Exception) { toast("Genres are unavailable") }
            }
        })
        filters.addView(action("Year: ${searchYear.ifBlank { "All" }}") {
            val years = listOf("All years") + (Year.now().value + 1 downTo 1950).map(Int::toString)
            AlertDialog.Builder(this).setTitle("Choose year").setItems(years.toTypedArray()) { _, index -> searchYear = if (index == 0) "" else years[index]; refresh() }.show()
        })
        input.setOnKeyListener { _, code, event ->
            if (code == KeyEvent.KEYCODE_DPAD_DOWN && event.action == KeyEvent.ACTION_DOWN) {
                filters.getChildAt(0).requestFocus(); true
            } else false
        }
        input.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(value: CharSequence?, start: Int, count: Int, after: Int): Unit = Unit
            override fun onTextChanged(value: CharSequence?, start: Int, count: Int, after: Int): Unit { searchTerm = value.toString(); refresh() }
            override fun afterTextChanged(value: android.text.Editable?): Unit = Unit
        }); refresh(); if (focusKeyboard) input.requestFocus()
    }

    private fun sectionTitle(title: String, subtitle: String = ""): LinearLayout = column().apply {
        addView(label(title, 28f).apply { setTypeface(null, Typeface.BOLD) })
        if (subtitle.isNotBlank()) addView(label(subtitle, 14f, Color.argb(150, 248, 244, 234)))
    }

    private fun addGrid(parent: LinearLayout, items: List<Media>): Unit {
        if (items.isEmpty()) {
            parent.addView(label("No titles match your filters.", 16f, Color.argb(170, 248, 244, 234)).apply { gravity = Gravity.CENTER })
            return
        }
        parent.addView(VerticalGridView(this@MainActivity).apply { setNumColumns(6); clipChildren = false; adapter = PosterAdapter(items, ::detail, { }) }, LinearLayout.LayoutParams(-1, dp(288)))
    }

    private fun checkForUpdate(): Unit {
        lifecycleScope.launch {
            val update = runCatching { TvUpdater.check() }.getOrNull() ?: return@launch
            if (!TvUpdater.eligible(this@MainActivity, update)) return@launch
            val banner = action("Update available · TV ${update.version} · Press OK") { startActivity(Intent(this@MainActivity, UpdateActivity::class.java)) }; banner.setTextColor(Palette.background); banner.background = shape(Palette.gold, true)
            rootFrame.addView(banner, FrameLayout.LayoutParams(-1, dp(52), Gravity.TOP).apply { leftMargin = dp(22); rightMargin = dp(22); topMargin = dp(70) })
        }
    }

    private fun toast(message: String): Unit {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }
}
