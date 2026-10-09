package com.cineverse.tv;

import android.app.Activity;
import androidx.core.splashscreen.SplashScreen;

/** Java entry point for the splash screen install; avoids Kotlin companion-scope resolution. */
public final class SplashHelper {
    private SplashHelper() {
    }

    public static SplashScreen install(Activity activity) {
        return SplashScreen.installSplashScreen(activity);
    }
}
