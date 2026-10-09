import java.util.Properties
import groovy.json.JsonSlurper

plugins { id("com.android.application") }
val local = Properties().apply { rootProject.file("local.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) } }
val tmdbKey = local.getProperty("TMDB_API_KEY", System.getenv("TMDB_API_KEY") ?: "")
val scraperBase = local.getProperty("SCRAPER_BASE", System.getenv("SCRAPER_BASE") ?: "")
val signingProperties = Properties().apply { rootProject.file(".signing/signing.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) } }
val firebaseFile = rootProject.file("firebase-sdk.local.json")
val firebase = if (firebaseFile.isFile) JsonSlurper().parse(firebaseFile) as Map<*, *> else emptyMap<Any, Any>()
val firebaseProject = firebase["project_info"] as? Map<*, *>
val firebaseClient = (firebase["client"] as? List<*>)?.filterIsInstance<Map<*, *>>()?.firstOrNull {
    val info = it["client_info"] as? Map<*, *>
    val androidInfo = info?.get("android_client_info") as? Map<*, *>
    androidInfo?.get("package_name") == "com.cineverse.tv"
}
fun configString(value: Any?): String = "\"${value?.toString().orEmpty().replace("\\", "\\\\").replace("\"", "\\\"")}\""
android {
    namespace = "com.cineverse.tv"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.cineverse.tv"
        minSdk = 26
        targetSdk = 34
        versionCode = 4
        versionName = "1.0.3"
        buildConfigField("String", "TMDB_API_KEY", "\"${tmdbKey.replace("\\", "\\\\").replace("\"", "\\\"")}\"")
        buildConfigField("String", "SCRAPER_BASE", "\"${scraperBase.replace("\\", "\\\\").replace("\"", "\\\"")}\"")
        buildConfigField("String", "FIREBASE_PROJECT_ID", configString(firebaseProject?.get("project_id")))
        buildConfigField("String", "FIREBASE_APP_ID", configString((firebaseClient?.get("client_info") as? Map<*, *>)?.get("mobilesdk_app_id")))
        buildConfigField("String", "FIREBASE_API_KEY", configString((firebaseClient?.get("api_key") as? List<*>)?.filterIsInstance<Map<*, *>>()?.firstOrNull()?.get("current_key")))
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    flavorDimensions += "device"
    productFlavors { create("leanback") { dimension = "device" } }
    buildFeatures { buildConfig = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    signingConfigs {
        if (signingProperties.isNotEmpty()) create("personal") {
            storeFile = rootProject.file(".signing/cineverse-tv.jks")
            storePassword = signingProperties.getProperty("storePassword")
            keyAlias = signingProperties.getProperty("keyAlias")
            keyPassword = signingProperties.getProperty("keyPassword")
        }
    }
    buildTypes { release {
        isMinifyEnabled = false
        if (signingProperties.isNotEmpty()) signingConfig = signingConfigs.getByName("personal")
    } }
    packaging { resources.excludes += setOf("META-INF/DEPENDENCIES", "META-INF/LICENSE*", "META-INF/NOTICE*") }
}
dependencies {
    implementation("androidx.leanback:leanback:1.2.0")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.fragment:fragment-ktx:1.8.9")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.1")
    implementation("androidx.datastore:datastore-preferences:1.1.7")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("io.coil-kt:coil:2.7.0")
    implementation("com.google.zxing:core:3.5.3")
    implementation("androidx.media3:media3-exoplayer:1.6.1")
    implementation("androidx.media3:media3-exoplayer-hls:1.6.1")
    implementation("androidx.media3:media3-ui:1.6.1")
    implementation("androidx.media3:media3-datasource-okhttp:1.6.1")
    implementation(platform("com.google.firebase:firebase-bom:34.19.0"))
    implementation("com.google.firebase:firebase-config")
    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.firebase:firebase-database")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20250517")
}
