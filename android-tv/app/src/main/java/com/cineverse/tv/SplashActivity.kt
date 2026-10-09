package com.cineverse.tv

import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout
import android.widget.TextView
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

public class SplashActivity : FragmentActivity() {
    private val animations = mutableListOf<android.animation.Animator>()
    private val motionEnabled: Boolean get() = android.animation.ValueAnimator.areAnimatorsEnabled()

    override fun onDestroy(): Unit {
        animations.forEach { it.cancel() }
        animations.clear()
        super.onDestroy()
    }

    override fun onCreate(savedInstanceState: Bundle?): Unit {
        SplashHelper.install(this)
        super.onCreate(savedInstanceState)
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val root = FrameLayout(this).apply { setBackgroundColor(Palette.background) }

        // Deep gradient background
        val bg = FrameLayout(this).apply {
            val drawable = android.graphics.drawable.GradientDrawable(
                android.graphics.drawable.GradientDrawable.Orientation.TL_BR,
                intArrayOf(
                    Color.rgb(6, 8, 12),
                    Color.rgb(10, 10, 16),
                    Color.rgb(8, 6, 14)
                )
            )
            setBackground(drawable)
        }
        root.addView(bg, FrameLayout.LayoutParams(-1, -1))

        // Vignette
        val vignette = FrameLayout(this).apply {
            val drawable = android.graphics.drawable.GradientDrawable(
                android.graphics.drawable.GradientDrawable.Orientation.TL_BR,
                intArrayOf(
                    Color.argb(35, 0, 0, 0),
                    Color.argb(0, 0, 0, 0),
                    Color.argb(35, 0, 0, 0)
                )
            )
            setBackground(drawable)
        }
        root.addView(vignette, FrameLayout.LayoutParams(-1, -1))

        // Aurora glow layers
        val glowContainer = FrameLayout(this)
        root.addView(glowContainer, FrameLayout.LayoutParams(-1, -1))
        if (motionEnabled) createAuroras(glowContainer)

        // Main content
        val contentStack = FrameLayout(this)
        root.addView(contentStack, FrameLayout.LayoutParams(-1, -1))

        // Liquid glass logo panel
        val logoPanel = FrameLayout(this)
        val logoText = TextView(this).apply {
            text = "CINEVERSE TV"
            textSize = 54f
            setTextColor(Color.rgb(250, 248, 242))
            gravity = Gravity.CENTER
            setTypeface(Typeface.create("sans-serif-condensed", Typeface.BOLD))
            letterSpacing = -0.015f
            alpha = 1f
        }
        logoPanel.addView(logoText, FrameLayout.LayoutParams(-2, -2, Gravity.CENTER))

        // Gold accent line
        val accentLine = View(this).apply {
            layoutParams = FrameLayout.LayoutParams(dp(220), dp(3), Gravity.CENTER_HORIZONTAL)
            setBackgroundColor(Palette.gold)
            alpha = 0f
            scaleX = 0f
            translationY = dp(12).toFloat()
        }
        logoPanel.addView(accentLine, FrameLayout.LayoutParams(dp(220), dp(3), Gravity.CENTER_HORIZONTAL or Gravity.BOTTOM).apply { bottomMargin = dp(12) })

        // Subtle inner glow on panel
        val panelGlow = View(this).apply {
            layoutParams = FrameLayout.LayoutParams(dp(320), dp(140), Gravity.CENTER)
            val drawable = android.graphics.drawable.GradientDrawable().apply {
                shape = android.graphics.drawable.GradientDrawable.RECTANGLE
                cornerRadius = dp(24).toFloat()
                setColors(intArrayOf(
                    Color.argb(25, 216, 179, 90),
                    Color.argb(0, 216, 179, 90)
                ))
                orientation = android.graphics.drawable.GradientDrawable.Orientation.TL_BR
                setStroke(dp(1), Color.argb(25, 216, 179, 90))
            }
            setBackground(drawable)
        }
        logoPanel.addView(panelGlow, FrameLayout.LayoutParams(dp(520), dp(140), Gravity.CENTER))

        contentStack.addView(logoPanel, FrameLayout.LayoutParams(dp(560), dp(150), Gravity.CENTER))

        // Tagline
        val tagline = TextView(this).apply {
            text = "Your cinema. Your stories."
            textSize = 16f
            setTextColor(Color.argb(140, 250, 248, 242))
            gravity = Gravity.CENTER
            letterSpacing = 0.12f
            alpha = 0f
            translationY = 20f
        }
        val taglineContainer = FrameLayout(this).apply { addView(tagline, FrameLayout.LayoutParams(-1, -2, Gravity.CENTER)) }
        contentStack.addView(taglineContainer.apply { translationY = dp(105).toFloat() }, FrameLayout.LayoutParams(-1, dp(50), Gravity.CENTER))

        // Version
        val version = TextView(this).apply {
            text = "TV ${BuildConfig.VERSION_NAME}"
            textSize = 11f
            setTextColor(Color.argb(80, 250, 248, 242))
            gravity = Gravity.CENTER
            letterSpacing = 0.05f
            alpha = 0f
        }
        val versionContainer = FrameLayout(this).apply { addView(version, FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM)) }
        contentStack.addView(versionContainer, FrameLayout.LayoutParams(-1, dp(90), Gravity.BOTTOM))

        // Floating particles
        if (motionEnabled) createParticles(root)

        setContentView(root)
        if (motionEnabled) animateSequence(logoPanel, accentLine, tagline, version)
        else {
            accentLine.alpha = 1f; accentLine.scaleX = 1f; tagline.alpha = 1f; version.alpha = 1f
            lifecycleScope.launch { delay(350); startActivity(Intent(this@SplashActivity, MainActivity::class.java)); finish() }
        }
    }

    private fun createAuroras(container: FrameLayout): Unit {
        val colors = listOf(
            Color.argb(25, 216, 179, 90) to Pair(dp(240), dp(240)),
            Color.argb(20, 179, 100, 216) to Pair(dp(200), dp(200)),
            Color.argb(15, 90, 216, 179) to Pair(dp(160), dp(160))
        )
        
        val rand = java.util.Random(42)
        colors.forEachIndexed { i, (color, size) ->
            val aurora = View(this).apply {
                layoutParams = FrameLayout.LayoutParams(size.first, size.second, Gravity.TOP or Gravity.START)
                x = (dp(100) + rand.nextInt(dp(1000))).toFloat()
                y = (dp(150) + rand.nextInt(dp(700))).toFloat()
                val drawable = android.graphics.drawable.GradientDrawable().apply {
                    shape = android.graphics.drawable.GradientDrawable.OVAL
                    setColor(color)
                }
                setBackground(drawable)
                alpha = 0f
            }
            container.addView(aurora)
            animateAurora(aurora, rand)
        }
    }

    private fun animateAurora(view: View, rand: java.util.Random): Unit {
        lifecycleScope.launch {
            delay((300 + rand.nextInt(1000)).toLong())
            val anim = android.animation.ObjectAnimator.ofFloat(view, "alpha", 0f, 0.15f, 0.05f, 0.12f, 0f)
            anim.duration = (8000 + rand.nextInt(4000)).toLong()
            anim.interpolator = AccelerateDecelerateInterpolator()
            anim.repeatCount = android.animation.ValueAnimator.INFINITE
            anim.repeatMode = android.animation.ValueAnimator.REVERSE
            animations.add(anim); anim.start()
            
            val driftX = android.animation.ObjectAnimator.ofFloat(view, "x", view.x, view.x + (-50 + rand.nextInt(100)).toFloat())
            driftX.duration = (20000 + rand.nextInt(10000)).toLong()
            driftX.interpolator = AccelerateDecelerateInterpolator()
            driftX.repeatCount = android.animation.ValueAnimator.INFINITE
            driftX.repeatMode = android.animation.ValueAnimator.REVERSE
            animations.add(driftX); driftX.start()
            
            val driftY = android.animation.ObjectAnimator.ofFloat(view, "y", view.y, view.y + (-30 + rand.nextInt(60)).toFloat())
            driftY.duration = (15000 + rand.nextInt(8000)).toLong()
            driftY.interpolator = AccelerateDecelerateInterpolator()
            driftY.repeatCount = android.animation.ValueAnimator.INFINITE
            driftY.repeatMode = android.animation.ValueAnimator.REVERSE
            animations.add(driftY); driftY.start()
        }
    }

    private fun createParticles(container: FrameLayout): Unit {
        val rand = java.util.Random(123)
        repeat(14) { i ->
            val particle = View(this).apply {
                val size = dp(4 + rand.nextInt(10))
                layoutParams = FrameLayout.LayoutParams(size, size, Gravity.TOP or Gravity.START)
                x = rand.nextInt(dp(1920)).toFloat()
                y = dp(200) + rand.nextInt(dp(800)).toFloat()
                val drawable = android.graphics.drawable.GradientDrawable().apply {
                    shape = android.graphics.drawable.GradientDrawable.OVAL
                    setColor(Color.argb(60 + rand.nextInt(40), 216, 179, 90))
                }
                setBackground(drawable)
                alpha = 0f
            }
            container.addView(particle)
            animateParticle(particle, rand)
        }
    }

    private fun animateParticle(view: View, rand: java.util.Random): Unit {
        lifecycleScope.launch {
            delay((200 + rand.nextInt(1500)).toLong())
            val anim = android.animation.ObjectAnimator.ofFloat(view, "alpha", 0f, (0.25 + rand.nextFloat() * 0.35).toFloat(), 0f)
            anim.duration = (3500 + rand.nextInt(3000)).toLong()
            anim.interpolator = AccelerateDecelerateInterpolator()
            anim.repeatCount = android.animation.ValueAnimator.INFINITE
            anim.repeatMode = android.animation.ValueAnimator.REVERSE
            animations.add(anim); anim.start()
            
            val drift = android.animation.ObjectAnimator.ofFloat(view, "y", view.y, view.y - dp(120 + rand.nextInt(200)).toFloat())
            drift.duration = (9000 + rand.nextInt(4000)).toLong()
            drift.interpolator = AccelerateDecelerateInterpolator()
            drift.repeatCount = android.animation.ValueAnimator.INFINITE
            drift.repeatMode = android.animation.ValueAnimator.REVERSE
            animations.add(drift); drift.start()
        }
    }

    private fun animateSequence(logoPanel: FrameLayout, accentLine: View, tagline: TextView, version: TextView): Unit {
        lifecycleScope.launch {
            delay(200)
            
            // Logo panel: rise + fade + scale
            logoPanel.alpha = 0f
            logoPanel.translationY = 60f
            logoPanel.scaleX = 0.9f
            logoPanel.scaleY = 0.9f
            logoPanel.animate()
                .alpha(1f)
                .translationY(0f)
                .scaleX(1f)
                .scaleY(1f)
                .setDuration(900L)
                .setInterpolator(DecelerateInterpolator(1.1f))
                .start()
            
            delay(400)
            
            // Accent line expand
            accentLine.animate()
                .alpha(1f)
                .scaleX(1f)
                .translationY(0f)
                .setDuration(600L)
                .setInterpolator(DecelerateInterpolator())
                .start()
            
            delay(250)
            
            // Tagline
            tagline.animate()
                .alpha(1f)
                .translationY(0f)
                .setDuration(600L)
                .setInterpolator(DecelerateInterpolator())
                .start()
            
            delay(300)
            
            // Subtle panel pulse
            val pulseX = android.animation.ObjectAnimator.ofFloat(logoPanel, "scaleX", 1f, 1.02f, 1f)
            pulseX.duration = 1400L
            pulseX.interpolator = AccelerateDecelerateInterpolator()
            pulseX.repeatCount = 1
            pulseX.repeatMode = android.animation.ValueAnimator.REVERSE
            val pulseY = android.animation.ObjectAnimator.ofFloat(logoPanel, "scaleY", 1f, 1.02f, 1f)
            pulseY.duration = 1400L
            pulseY.interpolator = AccelerateDecelerateInterpolator()
            pulseY.repeatCount = 1
            pulseY.repeatMode = android.animation.ValueAnimator.REVERSE
            animations.add(pulseX); pulseX.start()
            animations.add(pulseY); pulseY.start()
            
            delay(1400)
            
            // Version
            version.animate()
                .alpha(1f)
                .setDuration(500L)
                .setInterpolator(DecelerateInterpolator())
                .start()
            
            // Hold
            delay(1200L)
            
            // Exit - elegant crossfade
            val contentRoot = findViewById<View>(android.R.id.content)
            val animator = contentRoot?.animate()
            if (animator != null) {
                animator.alpha(0f)
                    .setDuration(400L)
                    .setInterpolator(AccelerateDecelerateInterpolator())
                    .withEndAction {
                        startActivity(Intent(this@SplashActivity, MainActivity::class.java))
                        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
                        finish()
                    }
                    .start()
            } else {
                startActivity(Intent(this@SplashActivity, MainActivity::class.java))
                overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
                finish()
            }
        }
    }
}
