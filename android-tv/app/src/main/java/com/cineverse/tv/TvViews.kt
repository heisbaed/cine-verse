package com.cineverse.tv

import android.content.Context
import android.content.res.Resources
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.leanback.widget.HorizontalGridView
import androidx.leanback.widget.VerticalGridView
import androidx.recyclerview.widget.RecyclerView
import coil.load

public object Palette {
    public val background: Int = Color.rgb(13, 15, 18)
    public val surface: Int = Color.rgb(18, 18, 24)
    public val gold: Int = Color.rgb(214, 179, 90)
    public val text: Int = Color.rgb(248, 244, 234)
    public val emerald: Int = Color.rgb(0, 200, 150)
    public val ruby: Int = Color.rgb(169, 54, 70)
    public val muted: Int = Color.argb(160, 248, 244, 234)
}
public fun Context.dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
public fun strokePx(value: Float): Int = (value * Resources.getSystem().displayMetrics.density).toInt()
public fun Context.label(value: String, size: Float = 16f, color: Int = Palette.text): TextView = TextView(this).apply {
    text = value; textSize = size.coerceAtLeast(14f); setTextColor(color); setPadding(dp(4), dp(5), dp(4), dp(5))
}
public fun Context.column(): LinearLayout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
public fun Context.row(): LinearLayout = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
public fun shape(fill: Int = Palette.surface, focused: Boolean = false): GradientDrawable = GradientDrawable().apply {
    setColor(fill); cornerRadius = 12f; setStroke(if (focused) 6 else 1, if (focused) Palette.gold else Color.argb(60, 255, 255, 255))
}
public fun rounded(fill: Int, focused: Boolean = false, radius: Float = 22f): GradientDrawable = GradientDrawable().apply {
    setColor(fill); cornerRadius = radius * Resources.getSystem().displayMetrics.density
    if (focused) setStroke(strokePx(2f), Palette.gold)
}
public fun View.tvFocus(scale: Boolean = false): Unit {
    isFocusable = true; isFocusableInTouchMode = true
    background = shape()
    setOnFocusChangeListener { view, focused ->
        view.background = shape(focused = focused)
        view.elevation = if (focused) 8f else 0f
        if (scale) { view.scaleX = if (focused) 1.06f else 1f; view.scaleY = view.scaleX }
    }
}
public fun Context.action(title: String, primary: Boolean = false, click: () -> Unit): Button = Button(this).apply {
    text = title; textSize = 14f; isAllCaps = false; minHeight = dp(48)
    setTextColor(if (primary) Palette.background else Palette.text)
    setPadding(dp(18), dp(8), dp(18), dp(8)); tvFocus()
    if (primary) {
        background = shape(Palette.gold)
        setOnFocusChangeListener { v, focus -> v.background = shape(if (focus) Color.WHITE else Palette.gold, focus) }
    }
    layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(52)).apply { setMargins(dp(4), dp(5), dp(4), dp(5)) }
    contentDescription = title; setOnClickListener { click() }
}

/** Rounded hero button — the DirecTV-style pill (solid gold primary, glass secondary). */
public fun Context.pill(title: String, primary: Boolean = false, click: () -> Unit): Button = Button(this).apply {
    text = title; textSize = 15f; isAllCaps = false; minHeight = dp(50)
    setTextColor(if (primary) Palette.background else Palette.text)
    setPadding(dp(28), dp(10), dp(28), dp(10))
    background = rounded(if (primary) Palette.gold else Color.argb(72, 255, 255, 255))
    isFocusable = true; isFocusableInTouchMode = true
    setOnFocusChangeListener { view, focused ->
        view.background = rounded(if (primary) { if (focused) Color.WHITE else Palette.gold } else Color.argb(if (focused) 125 else 72, 255, 255, 255), focused)
        view.scaleX = if (focused) 1.05f else 1f; view.scaleY = view.scaleX
        view.elevation = if (focused) 10f else 0f
    }
    layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { setMargins(dp(7), dp(7), dp(7), dp(7)) }
    contentDescription = title; setOnClickListener { click() }
}

/** Circular icon button (mute toggle, hero arrows). */
public fun Context.iconPill(title: String, click: () -> Unit): Button = Button(this).apply {
    text = title; textSize = 18f; isAllCaps = false
    setTextColor(Palette.text)
    minHeight = dp(52); minWidth = dp(52)
    setPadding(dp(10), dp(6), dp(10), dp(6))
    background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(Color.argb(62, 255, 255, 255))
        setStroke(strokePx(1f), Color.argb(70, 255, 255, 255))
    }
    isFocusable = true; isFocusableInTouchMode = true
    setOnFocusChangeListener { view, focused ->
        view.background = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(Color.argb(115, 255, 255, 255))
            if (focused) setStroke(strokePx(2f), Palette.gold)
        }
        view.scaleX = if (focused) 1.09f else 1f; view.scaleY = view.scaleX
        view.elevation = if (focused) 10f else 0f
    }
    layoutParams = LinearLayout.LayoutParams(dp(54), dp(54)).apply { setMargins(dp(6), 0, dp(6), 0) }
    contentDescription = title; setOnClickListener { click() }
}

/** Top-navigation link with a gold underline when active. */
public fun Context.navLink(title: String, active: Boolean, click: () -> Unit): LinearLayout {
    val ctx = this
    return column().apply {
        id = View.generateViewId()
        isFocusable = true; isFocusableInTouchMode = true
        descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS
        gravity = Gravity.CENTER
        minimumHeight = dp(52)
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.MATCH_PARENT)
        background = rounded(Color.TRANSPARENT, radius = 8f)
        alpha = if (active) 1f else 0.76f
        addView(label(title, 15f, if (active) Palette.gold else Color.argb(188, 248, 244, 234)).apply {
            setTypeface(null, if (active) Typeface.BOLD else Typeface.NORMAL)
            setPadding(dp(14), dp(10), dp(14), dp(8))
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        addView(View(ctx).apply { setBackgroundColor(if (active) Palette.gold else Color.TRANSPARENT) }, LinearLayout.LayoutParams(-1, dp(3)))
        setOnFocusChangeListener { view, focused ->
            view.alpha = if (focused || view.isSelected) 1f else 0.88f
            view.background = rounded(if (focused) Color.argb(36, 255, 255, 255) else Color.TRANSPARENT, focused, 8f)
        }
        setOnClickListener { click() }
        contentDescription = title
    }
}

/** Toolbar tab, uppercase with a gold indicator when selected. */
public fun Context.tabChip(title: String, active: Boolean, click: () -> Unit): LinearLayout {
    val ctx = this
    return column().apply {
        id = View.generateViewId()
        isFocusable = true; isFocusableInTouchMode = true
        descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS
        gravity = Gravity.CENTER
        minimumHeight = dp(48)
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        background = rounded(Color.TRANSPARENT, radius = 8f)
        alpha = if (active) 1f else 0.88f
        addView(label(title.uppercase(), 14f, if (active) Palette.gold else Color.argb(168, 248, 244, 234)).apply {
            setTypeface(null, Typeface.BOLD); letterSpacing = 0.14f; setPadding(dp(14), dp(10), dp(14), dp(8))
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        addView(View(ctx).apply { setBackgroundColor(if (active) Palette.gold else Color.TRANSPARENT) }, LinearLayout.LayoutParams(-1, dp(3)))
        setOnFocusChangeListener { view, focused ->
            view.alpha = if (focused || active) 1f else 0.88f
            view.background = rounded(if (focused) Color.argb(36, 255, 255, 255) else Color.TRANSPARENT, focused, 8f)
        }
        setOnClickListener { click() }
        contentDescription = title
    }
}

/** Rounded toolbar search field. */
public fun Context.searchField(hint: String): EditText = EditText(this).apply {
    this.hint = hint; setSingleLine(); textSize = 15f; minHeight = dp(48)
    setTextColor(Palette.text); setHintTextColor(Color.argb(132, 248, 244, 234))
    background = rounded(Color.argb(48, 255, 255, 255), false, 24f)
    setPadding(dp(22), dp(10), dp(22), dp(10))
    isFocusable = true; isFocusableInTouchMode = true
    setOnFocusChangeListener { view, focused -> view.background = rounded(Color.argb(92, 255, 255, 255), focused, 24f) }
    contentDescription = hint
}

/** Five-star glyph row for a 0-10 TMDB score. */
public fun starRow(rating: Double): String {
    val filled = Math.round(rating / 2.0).toInt().coerceIn(0, 5)
    return "★".repeat(filled) + "☆".repeat(5 - filled)
}

public class PosterAdapter(private val items: List<Media>, private val open: (Media) -> Unit, private val focus: (Int) -> Unit, private val large: Boolean = false) : RecyclerView.Adapter<PosterAdapter.Holder>() {
    public class Holder(public val box: LinearLayout, public val image: ImageView, public val title: TextView, public val meta: TextView) : RecyclerView.ViewHolder(box)
    override fun onCreateViewHolder(parent: ViewGroup, type: Int): Holder {
        val c = parent.context; val box = c.column(); box.setPadding(c.dp(5), c.dp(5), c.dp(5), c.dp(5))
        box.layoutParams = RecyclerView.LayoutParams(if (large) c.dp(192) else c.dp(136), if (large) c.dp(348) else c.dp(264)).apply { setMargins(c.dp(8), c.dp(8), c.dp(8), c.dp(8)) }
        val image = ImageView(c).apply { scaleType = ImageView.ScaleType.CENTER_CROP; setBackgroundColor(Palette.surface) }
        box.addView(image, LinearLayout.LayoutParams(-1, if (large) c.dp(273) else c.dp(189)))
        val title = c.label("", if (large) 15f else 14f).apply { maxLines = 1; ellipsize = TextUtils.TruncateAt.END; setTypeface(null, Typeface.BOLD) }
        val meta = c.label("", if (large) 14f else 14f, Palette.gold)
        box.addView(title); box.addView(meta)
        return Holder(box, image, title, meta)
    }
    override fun getItemCount(): Int = items.size
    override fun onBindViewHolder(holder: Holder, position: Int): Unit {
        val m = items[position]; holder.image.load(TmdbApi.image(m.poster)); holder.title.text = m.title
        holder.meta.text = "${m.year} · ★ ${String.format(java.util.Locale.US, "%.1f", m.rating)}"
        holder.box.contentDescription = "View details for ${m.title}"; holder.box.tvFocus(true)
        val base = holder.box.onFocusChangeListener
        holder.box.setOnFocusChangeListener { v, hasFocus -> base?.onFocusChange(v, hasFocus); if (hasFocus) focus(position) }
        holder.box.setOnClickListener { open(m) }
    }
}

/** Six-column grid section with a bold header (New Releases). */
public fun Context.section6(title: String, items: List<Media>, open: (Media) -> Unit): LinearLayout = column().apply {
    addView(label(title, 20f).apply { setTypeface(null, Typeface.BOLD) })
    addView(VerticalGridView(this@section6).apply {
        setNumColumns(6); clipChildren = false
        adapter = PosterAdapter(items, open, focus = { })
    }, LinearLayout.LayoutParams(-1, dp(288)))
}

/** Horizontal poster row with heading and "See all" affordance (New Releases uses large art). */
public fun Context.posterRow(title: String, subtitle: String, items: List<Media>, large: Boolean, open: (Media) -> Unit, onSeeAll: () -> Unit, onFocus: (Int) -> Unit, initialPosition: Int = 0): LinearLayout = column().apply {
    val heading = row(); heading.addView(column().apply {
        addView(label(title, if (large) 24f else 21f).apply { setTypeface(null, Typeface.BOLD) })
        if (subtitle.isNotBlank()) addView(label(subtitle, 14f, Palette.muted))
    }, LinearLayout.LayoutParams(0, -2, 1f))
    heading.addView(action("See all") { onSeeAll() })
    addView(heading)
    addView(HorizontalGridView(this@posterRow).apply {
        setNumRows(1); clipChildren = false; clipToPadding = false; setPadding(dp(8), dp(4), dp(8), dp(4))
        adapter = PosterAdapter(items, open, onFocus, large); setSelectedPosition(initialPosition)
    }, LinearLayout.LayoutParams(-1, if (large) dp(372) else dp(288)))
}
