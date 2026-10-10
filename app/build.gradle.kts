plugins {
    id("com.android.application")
}

android {
    namespace = "com.transportlog.proapp"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.transportlog.proapp"
        minSdk = 24
        targetSdk = 36
        versionCode = 20
        versionName = "1.6.4"
    }

    buildTypes {
        // Separate test package so the existing app and its data stay untouched.
        debug {
            applicationIdSuffix = ".hanilmixed"
            versionNameSuffix = "-hanil-mixed"
        }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.core:core:1.17.0")
    implementation("androidx.activity:activity:1.11.0")
    implementation("androidx.camera:camera-camera2:1.5.0")
    implementation("androidx.camera:camera-lifecycle:1.5.0")
    implementation("androidx.camera:camera-view:1.5.0")
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
    implementation("com.google.zxing:core:3.5.3")
    implementation("com.google.android.gms:play-services-code-scanner:16.1.0")
    implementation("com.yanzhenjie.zbar:camera:1.0.0")
}
