package com.cineverse.tv

import android.content.Context
import com.google.android.gms.tasks.Task
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.FirebaseDatabase
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import org.json.JSONObject
import java.util.UUID

public data class PairingRequest(public val code: String, public val url: String, public val expiresAt: Long)
public data class LinkedAccount(public val uid: String, public val displayName: String)

/** The TV keeps its own anonymous device identity; no phone account token is exported. */
public class TvPairing(context: Context) {
    private val context = context.applicationContext
    private val preferences = this.context.getSharedPreferences("tv-account-link", Context.MODE_PRIVATE)
    private fun app(): FirebaseApp {
        CoreConfig.initialize(context)
        return FirebaseApp.getInstance("cineverse-tv")
    }
    private fun auth(): FirebaseAuth = FirebaseAuth.getInstance(app())
    private fun db(): FirebaseDatabase = FirebaseDatabase.getInstance(app(), "https://cine-verse-231ad-default-rtdb.firebaseio.com")
    public fun currentAccount(): LinkedAccount? = preferences.getString("accountUid", null)?.let {
        LinkedAccount(it, preferences.getString("displayName", "Cine-verse account").orEmpty())
    }

    public suspend fun begin(): PairingRequest {
        val device = auth().currentUser ?: auth().signInAnonymously().awaitPairing().user
            ?: error("Could not create a TV device identity")
        preferences.getString("pendingCode", null)?.let { previous ->
            db().getReference("tvPairings/$previous").removeValue().awaitPairing()
        }
        val code = UUID.randomUUID().toString().replace("-", "")
        val now = System.currentTimeMillis()
        val expires = now + 10 * 60 * 1000
        db().getReference("tvPairings/$code").setValue(mapOf("deviceUid" to device.uid,
            "createdAt" to now, "expiresAt" to expires, "status" to "pending")).awaitPairing()
        preferences.edit().putString("pendingCode", code).apply()
        return PairingRequest(code, "https://ourcineverse.web.app/link?code=$code", expires)
    }

    public suspend fun awaitLinked(request: PairingRequest, onStatus: (String) -> Unit = {}): LinkedAccount {
        while (System.currentTimeMillis() < request.expiresAt) {
            val value = db().getReference("tvPairings/${request.code}").get().awaitPairing()
            val accountUid = value.child("accountUid").getValue(String::class.java)
            if (value.child("status").getValue(String::class.java) == "approved" && !accountUid.isNullOrBlank()) {
                val deviceUid = auth().currentUser?.uid ?: error("TV device signed out")
                val grant = db().getReference("tvDevices/$deviceUid").get().awaitPairing()
                if (grant.child("accountUid").getValue(String::class.java) == accountUid &&
                    grant.child("code").getValue(String::class.java) == request.code) {
                    val name = value.child("displayName").getValue(String::class.java) ?: "Cine-verse account"
                    preferences.edit().putString("accountUid", accountUid).putString("displayName", name)
                        .putString("pairedCode", request.code).remove("pendingCode").apply()
                    return LinkedAccount(accountUid, name)
                }
            }
            onStatus("Waiting for approval on your phone")
            delay(2000)
        }
        error("TV link expired. Generate a new QR code.")
    }

    public suspend fun syncWatchlist(local: List<Media>, mergeLocal: Boolean = false): List<Media> {
        val account = currentAccount() ?: return local
        val snapshot = db().getReference("users/${account.uid}/watchlist").get().awaitPairing()
        val remote = (snapshot.value as? List<*>)?.mapNotNull { item ->
            runCatching {
                val json = JSONObject(item as Map<*, *>)
                Media.from(json, if (json.has("name") && !json.has("title")) "tv" else "movie")
            }.getOrNull()
        }.orEmpty()
        if (!mergeLocal) return remote
        val merged = (local + remote).distinctBy { it.key }
        pushWatchlist(merged)
        return merged
    }

    public suspend fun pushWatchlist(items: List<Media>): Unit {
        val account = currentAccount() ?: return
        val data = items.take(500).map { item ->
            val json = JSONObject(item.json())
            if (item.kind == "tv") {
                json.put("name", item.title).put("first_air_date", item.year)
                json.remove("title"); json.remove("release_date")
            }
            json.keys().asSequence().associateWith { key -> json.get(key).takeUnless { it === JSONObject.NULL } }
        }
        db().getReference("users/${account.uid}/watchlist").setValue(data).awaitPairing()
    }

    public suspend fun unlink(): Unit {
        preferences.getString("pairedCode", null)?.let {
            db().getReference("tvPairings/$it").removeValue().awaitPairing()
        }
        auth().currentUser?.uid?.let { db().getReference("tvDevices/$it").removeValue().awaitPairing() }
        preferences.edit().clear().apply()
    }

    public suspend fun cancel(request: PairingRequest): Unit {
        if (preferences.getString("pairedCode", null) != request.code) {
            db().getReference("tvPairings/${request.code}").removeValue().awaitPairing()
            auth().currentUser?.uid?.let { deviceUid ->
                val grant = db().getReference("tvDevices/$deviceUid")
                if (grant.get().awaitPairing().child("code").getValue(String::class.java) == request.code) {
                    grant.removeValue().awaitPairing()
                }
            }
            preferences.edit().remove("pendingCode").apply()
        }
    }

    private suspend fun <T> Task<T>.awaitPairing(): T = suspendCancellableCoroutine { continuation ->
        addOnCompleteListener { task ->
            if (continuation.isActive) continuation.resumeWith(if (task.isSuccessful) Result.success(task.result)
                else Result.failure(task.exception ?: IllegalStateException("Account linking request failed")))
        }
    }
}
