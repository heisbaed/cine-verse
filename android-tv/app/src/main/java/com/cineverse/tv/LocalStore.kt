package com.cineverse.tv

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

private val Context.tvStore by preferencesDataStore("cineverse_tv")
public class LocalStore(context: Context) {
    private val context: Context = context.applicationContext
    public companion object {
        private val persistenceScope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    }
    public suspend fun position(key: String): Long = context.tvStore.data.first()[longPreferencesKey("resume:$key")] ?: 0
    public suspend fun savePosition(key: String, ms: Long): Unit { context.tvStore.edit { it[longPreferencesKey("resume:$key")] = ms.coerceAtLeast(0) } }
    public fun persistPosition(key: String, ms: Long): Job = persistenceScope.launch { savePosition(key, ms) }
    public suspend fun watchlist(): List<Media> = JSONArray(context.tvStore.data.first()[stringPreferencesKey("watchlist")] ?: "[]").objects().map { Media.from(it) }
    public suspend fun replaceWatchlist(items: List<Media>, onlyIfClean: Boolean = false): Unit {
        context.tvStore.edit {
            if (!onlyIfClean || it[booleanPreferencesKey("watchlist_dirty")] != true) {
                it[stringPreferencesKey("watchlist")] = JSONArray(items.map { item -> JSONObject(item.json()) }).toString()
                it[booleanPreferencesKey("watchlist_dirty")] = false
            }
        }
    }
    public suspend fun watchlistNeedsSync(): Boolean = context.tvStore.data.first()[booleanPreferencesKey("watchlist_dirty")] ?: false
    public suspend fun watchlistSynced(items: List<Media>): Unit {
        val uploaded = JSONArray(items.map { JSONObject(it.json()) }).toString()
        context.tvStore.edit { if (it[stringPreferencesKey("watchlist")] == uploaded) it[booleanPreferencesKey("watchlist_dirty")] = false }
    }
    public suspend fun toggle(m: Media): Boolean {
        var added = false
        context.tvStore.edit { prefs ->
            val list = JSONArray(prefs[stringPreferencesKey("watchlist")] ?: "[]").objects().map { Media.from(it) }.toMutableList()
            added = list.none { it.key == m.key }
            list.removeAll { it.key == m.key }; if (added) list.add(m)
            prefs[stringPreferencesKey("watchlist")] = JSONArray(list.map { JSONObject(it.json()) }).toString()
            prefs[booleanPreferencesKey("watchlist_dirty")] = true
        }; return added
    }
    public suspend fun scraperBase(): String = context.tvStore.data.first()[stringPreferencesKey("scraper_base")] ?: CoreConfig.settings(context).baseUrl
    public suspend fun saveScraperBase(value: String): Unit {
        context.tvStore.edit { preferences ->
            val clean = value.trim().trimEnd('/')
            if (clean.isBlank()) preferences.remove(stringPreferencesKey("scraper_base"))
            else preferences[stringPreferencesKey("scraper_base")] = clean
        }
    }
}
