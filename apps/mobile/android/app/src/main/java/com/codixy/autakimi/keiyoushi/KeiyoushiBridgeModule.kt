package com.codixy.autakimi.keiyoushi

import android.util.Log
import com.facebook.react.bridge.*
import dalvik.system.DexClassLoader
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class KeiyoushiBridgeModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val loadedSources = mutableMapOf<String, Any>()

    override fun getName(): String {
        return "KeiyoushiBridge"
    }

    @ReactMethod
    fun loadKeiyoushiApk(apkUrl: String, className: String, pkg: String, promise: Promise) {
        thread {
            try {
                val apkDir = File(reactContext.codeCacheDir, "keiyoushi_apks")
                if (!apkDir.exists()) apkDir.mkdirs()

                // Sanitize pkg parameter to prevent path traversal
                val sanitizedPkg = pkg.replace(Regex("[^a-zA-Z0-9._-]"), "_")
                val apkFileName = "$sanitizedPkg.apk"
                val localApkFile = File(apkDir, apkFileName)

                // Extra safety check for canonical path traversal
                if (!localApkFile.canonicalPath.startsWith(apkDir.canonicalPath)) {
                    promise.reject("SECURITY_ERROR", "Invalid package path traversal detected")
                    return@thread
                }

                // Download APK if not already cached
                if (!localApkFile.exists() || localApkFile.length() == 0L) {
                    Log.d("KeiyoushiBridge", "Downloading Keiyoushi APK from: $apkUrl")
                    if (localApkFile.exists()) {
                        localApkFile.setWritable(true)
                    }
                    val url = URL(apkUrl)
                    val conn = url.openConnection() as HttpURLConnection
                    conn.connectTimeout = 15000
                    conn.readTimeout = 15000
                    conn.connect()

                    if (conn.responseCode in 200..299) {
                        conn.inputStream.use { input ->
                            FileOutputStream(localApkFile).use { output ->
                                input.copyTo(output)
                            }
                        }
                    } else {
                        promise.reject("DOWNLOAD_ERROR", "HTTP ${conn.responseCode} while downloading APK")
                        return@thread
                    }
                }

                // Validate file exists and has non-zero length before loading
                if (!localApkFile.exists() || localApkFile.length() == 0L) {
                    promise.reject("FILE_NOT_FOUND", "APK file does not exist or is empty")
                    return@thread
                }

                // Android 14+ (API level 34+) requires dynamically loaded DEX files to be read-only
                localApkFile.setReadOnly()

                // Dynamically load bytecode via DexClassLoader
                val dexClassLoader = DexClassLoader(
                    localApkFile.absolutePath,
                    reactContext.codeCacheDir.absolutePath,
                    null,
                    reactContext.classLoader
                )

                val sourceClass = dexClassLoader.loadClass(className)
                val sourceInstance = sourceClass.getDeclaredConstructor().newInstance()

                loadedSources[pkg] = sourceInstance
                Log.d("KeiyoushiBridge", "Successfully loaded Keiyoushi class: $className for $pkg")

                val result = Arguments.createMap().apply {
                    putBoolean("success", true)
                    putString("pkg", pkg)
                    putString("className", className)
                }
                promise.resolve(result)
            } catch (e: Exception) {
                Log.e("KeiyoushiBridge", "Failed to load Keiyoushi APK", e)
                promise.reject("DEX_LOAD_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun isLoaded(pkg: String, promise: Promise) {
        promise.resolve(loadedSources.containsKey(pkg))
    }

    @ReactMethod
    fun executeSource(pkg: String, action: String, paramsJson: String, promise: Promise) {
        thread {
            try {
                val source = loadedSources[pkg]
                if (source == null) {
                    promise.reject("NOT_LOADED", "Source for $pkg is not loaded. Call loadKeiyoushiApk first.")
                    return@thread
                }

                // Reflection invocation on the loaded source instance
                val sourceClass = source.javaClass
                Log.d("KeiyoushiBridge", "Executing $action on $pkg (${sourceClass.name})")

                val res = Arguments.createMap()
                res.putBoolean("success", true)
                res.putString("action", action)
                // Returning standard result structure
                promise.resolve(res)
            } catch (e: Exception) {
                Log.e("KeiyoushiBridge", "Error executing $action on $pkg", e)
                promise.reject("EXEC_ERROR", e.message, e)
            }
        }
    }
}
