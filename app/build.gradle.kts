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
        versionCode = 12
        versionName = "1.5.6"
    }

    buildTypes {
        // Install the QR test build beside the original and header-test apps; preserve their data.
        debug {
            applicationIdSuffix = ".qr3"
            versionNameSuffix = "-qr-3formats"
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
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
    implementation("com.google.zxing:core:3.5.3")
    implementation("com.google.android.gms:play-services-code-scanner:16.1.0")
}
