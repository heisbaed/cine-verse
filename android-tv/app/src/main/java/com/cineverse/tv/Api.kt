package com.cineverse.tv

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.FormBody
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

public class HttpStatusException(public val code: Int) : IOException("Service returned HTTP $code")

public object Http {
    public val client: OkHttpClient = OkHttpClient.Builder().connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS).callTimeout(35, TimeUnit.SECONDS).build()
    public val resolverClient: OkHttpClient = client.newBuilder().readTimeout(65, TimeUnit.SECONDS).callTimeout(75, TimeUnit.SECONDS).build()
    public val playbackClient: OkHttpClient = client.newBuilder().readTimeout(60, TimeUnit.SECONDS).callTimeout(0, TimeUnit.MILLISECONDS).build()
    public suspend fun request(url: String, params: Map<String, String> = emptyMap(), token: String = "", post: Boolean = false,
        requestClient: OkHttpClient = client): String = withContext(Dispatchers.IO) {
        val builder = Request.Builder()
        if (post) builder.url(url).post(FormBody.Builder().apply { params.forEach { (k, v) -> add(k, v) } }.build())
        else builder.url(url.toHttpUrl().newBuilder().apply { params.forEach { (k, v) -> addQueryParameter(k, v) } }.build())
        if (token.isNotBlank()) builder.header("Authorization", "Bearer $token")
        suspendCancellableCoroutine { continuation ->
            val call = requestClient.newCall(builder.build())
            continuation.invokeOnCancellation { call.cancel() }
            call.enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException): Unit {
                    if (continuation.isActive) continuation.resumeWith(Result.failure(e))
                }
                override fun onResponse(call: Call, response: Response): Unit {
                    val result = runCatching {
                        response.use {
                            if (!it.isSuccessful) throw HttpStatusException(it.code)
                            it.body?.string() ?: throw IOException("Empty response")
                        }
                    }
                    if (continuation.isActive) continuation.resumeWith(result)
                }
            })
        }
    }
}

public fun JSONArray.objects(): List<JSONObject> = (0 until length()).mapNotNull { optJSONObject(it) }
public fun JSONObject.items(key: String): List<JSONObject> = optJSONArray(key)?.objects().orEmpty()

public data class Media(public val id: Int, public val kind: String, public val title: String,
    public val poster: String, public val backdrop: String, public val year: String, public val rating: Double,
    public val overview: String, public val genreIds: List<Int> = emptyList()) {
    public val key: String get() = "$kind:$id"
    public fun json(): String = JSONObject().put("id", id).put("media_type", kind).put("title", title)
        .put("poster_path", poster).put("backdrop_path", backdrop).put("release_date", year)
        .put("vote_average", rating).put("overview", overview).toString()
    public companion object {
        public fun from(j: JSONObject, kind: String = "movie"): Media = Media(j.getInt("id"), j.optString("media_type", kind),
            j.optString("title", j.optString("name")), j.optString("poster_path").takeUnless { it == "null" }.orEmpty(),
            j.optString("backdrop_path").takeUnless { it == "null" }.orEmpty(),
            j.optString("release_date", j.optString("first_air_date")).take(4), j.optDouble("vote_average", 0.0), j.optString("overview"),
            j.optJSONArray("genre_ids")?.let { ids -> (0 until ids.length()).map { ids.optInt(it) } } ?: emptyList())
    }
}

/** Extra detail used only by the rotating home hero: logo art, certification, runtime/seasons. */
public data class HeroMeta(
    public val logoPath: String,
    public val certification: String,
    public val seasons: Int,
    public val runtime: Int,
    public val genres: List<String>,
)

/** Native TMDB calls; the catalog supplies identity, never fuzzy playback matching. */
public class TmdbApi {
    public suspend fun get(path: String, params: Map<String, String> = emptyMap()): JSONObject {
        check(BuildConfig.TMDB_API_KEY.isNotBlank()) { "TMDB key missing. Configure local.properties and rebuild." }
        return JSONObject(Http.request("https://api.themoviedb.org/3/$path", params + ("api_key" to BuildConfig.TMDB_API_KEY)))
    }

    public suspend fun list(path: String, params: Map<String, String> = emptyMap(), kind: String = "movie"): List<Media> =
        get(path, params).items("results").filter { it.optString("media_type") != "person" }.map { Media.from(it, kind) }

    public suspend fun heroMeta(m: Media): HeroMeta {
        val data = get("${m.kind}/${m.id}", mapOf("append_to_response" to "images,release_dates,content_ratings"))
        val logos = data.optJSONObject("images")?.items("logos").orEmpty()
        val logo = logos.firstOrNull { it.optString("iso_639_1") == "en" }?.optString("file_path")
            ?: logos.firstOrNull()?.optString("file_path").orEmpty()
        val certification = when (m.kind) {
            "tv" -> data.optJSONObject("content_ratings")?.items("results")
                ?.firstOrNull { it.optString("iso_3166_1") == "US" }?.optString("rating").orEmpty()
            else -> data.optJSONObject("release_dates")?.items("results")
                ?.firstOrNull { it.optString("iso_3166_1") == "US" }?.items("release_dates")
                ?.firstOrNull { it.optString("certification").isNotBlank() }?.optString("certification").orEmpty()
        }
        val genres = data.items("genres").map { it.optString("name") }.filter { it.isNotBlank() }.take(3)
        return HeroMeta(logo.takeUnless { it == "null" }.orEmpty(), certification, data.optInt("number_of_seasons"), data.optInt("runtime"), genres)
    }
    public suspend fun detail(m: Media): JSONObject = get("${m.kind}/${m.id}", mapOf("append_to_response" to "credits,videos,reviews,similar,recommendations,external_ids,watch/providers"))
    public suspend fun genres(kind: String): List<JSONObject> = get("genre/$kind/list").items("genres")
    public suspend fun season(id: Int, season: Int): List<JSONObject> = get("tv/$id/season/$season").items("episodes")
    public companion object {
        public fun image(path: String, size: String = "w500"): String? = when {
            path.isBlank() || path == "null" -> null
            path.startsWith("https://") -> path
            else -> "https://image.tmdb.org/t/p/$size$path"
        }
    }
}
