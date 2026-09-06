plugins {
    id("com.android.application")
}

android {
    namespace = "com.transportlog.proapp"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.transportlog.proapp"
        minSdk = 29
        targetSdk = 36
        versionCode = 2
        versionName = "1.1.0"
    }

    buildTypes {
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
}
